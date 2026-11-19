import asyncio
import json
from contextlib import asynccontextmanager, suppress
from ipaddress import ip_address

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .agent import ReplyUnavailable, run_reply, validate_budget
from .config import Settings
from .limits import ActiveReplies
from .session import COOKIE, ip_hash, new_id, sign, verify
from .store import Denied, Store
from .turnstile import validate


@asynccontextmanager
async def lifespan(app):
    settings = Settings()
    validate_budget(settings)
    app.state.settings = settings
    app.state.store = Store(settings)
    app.state.active = ActiveReplies(settings.max_concurrency)

    async def cleanup():
        while True:
            app.state.store.cleanup()
            await asyncio.sleep(300)

    task = asyncio.create_task(cleanup())
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        app.state.store.db.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(Denied)
async def denied(request, exc):
    status = 401 if exc.code == 'turnstile_required' else 429 if exc.code == 'rate_limited' else 503
    return JSONResponse({'code': exc.code}, status_code=status)


@app.exception_handler(RequestValidationError)
async def invalid(request, exc):
    return JSONResponse({'code': 'invalid_message'}, status_code=400)


@app.middleware('http')
async def guard(request, call_next):
    if request.method == 'POST':
        settings = request.app.state.settings
        if request.headers.get('origin') not in settings.origins:
            return JSONResponse({'code': 'unavailable'}, status_code=403)
        if request.headers.get('content-type', '').split(';')[0] != 'application/json':
            return JSONResponse({'code': 'invalid_message'}, status_code=415)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return JSONResponse({'code': 'invalid_message'}, status_code=413)
        request._body = bytes(body)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    return response


class SessionInput(BaseModel):
    token: str = Field(min_length=1, max_length=2048)


class MessageInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


def visitor_ip(request):
    peer = request.client.host if request.client else ''
    try:
        trusted = ip_address(peer).is_loopback
    except ValueError:
        trusted = False
    if request.app.state.settings.production and trusted:
        value = request.headers.get('x-real-ip', '')
        try:
            return str(ip_address(value))
        except ValueError:
            raise Denied('unavailable')
    return peer


def session_id(request):
    settings = request.app.state.settings
    sid = verify(request.cookies.get(COOKIE), settings.signing_key)
    if not sid or request.headers.get('x-chat-session') != sid:
        raise Denied('turnstile_required')
    request.app.state.store.get(sid)
    return sid


@app.get('/api/chat/status')
async def status(request: Request):
    return {'status': request.app.state.store.status()}


@app.post('/api/chat/session')
async def session(body: SessionInput, request: Request):
    s = request.app.state.settings
    state = request.app.state.store.status()
    if state != 'open':
        raise Denied('off' if state == 'off' else 'budget_exhausted')
    if not await validate(body.token, visitor_ip(request), s):
        raise Denied('turnstile_required')
    sid = new_id()
    request.app.state.store.create(sid)
    response = JSONResponse({'remaining_messages': s.session_messages, 'session_id': sid})
    response.set_cookie(COOKIE, sign(sid, s.signing_key), httponly=True, secure=s.production, samesite='strict', path='/api/chat')
    return response


@app.post('/api/chat/reset')
async def reset(request: Request):
    sid = session_id(request)
    if sid in request.app.state.active.sessions:
        raise Denied('unavailable')
    request.app.state.store.reset(sid)
    row = request.app.state.store.get(sid)
    return {'remaining_messages': request.app.state.settings.session_messages - row['messages']}


def event(name, data):
    return f'event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n'


@app.post('/api/chat')
async def chat(body: MessageInput, request: Request):
    s = request.app.state.settings
    store = request.app.state.store
    active = request.app.state.active
    sid = session_id(request)
    message = body.message.strip()
    if not message or len(message) > s.max_message_chars:
        return JSONResponse({'code': 'invalid_message'}, status_code=400)
    active.enter(sid)
    try:
        history = store.reserve(sid, ip_hash(visitor_ip(request), s.signing_key))
    except BaseException:
        active.leave(sid)
        raise

    async def stream():
        result = None
        try:
            async with asyncio.timeout(240):
                async for name, data in run_reply(history, message, s):
                    if s.off_path.exists():
                        raise Denied('off')
                    if name == 'result':
                        result = data
                    elif name in {'status', 'text', 'images'}:
                        yield event(name, data)
                if result is None:
                    raise Denied('unavailable')
                store.finish(sid, result)
                yield event('done', {'remaining_messages': s.session_messages - store.get(sid)['messages']})
        except Denied as exc:
            yield event('error', {'code': exc.code})
        except ReplyUnavailable as exc:
            yield event('error', {'code': exc.code})
        except Exception:
            yield event('error', {'code': 'unavailable'})
        finally:
            store.finish(sid)
            active.leave(sid)

    return StreamingResponse(stream(), media_type='text/event-stream', headers={'X-Accel-Buffering': 'no'})
