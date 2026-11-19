import asyncio
import hashlib
import hmac
import json
from contextlib import aclosing, asynccontextmanager, suppress
from ipaddress import ip_address

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .agent import ReplyUnavailable, run_turn, validate_budget
from .config import Settings
from .evaluation import EvaluationLog, bind, conversation, record, unbind
from .limits import ActiveReplies
from .session import BROWSER_COOKIE, COOKIE, ip_hash, new_id, sign, verify
from .store import Denied, Store
from .turnstile import validate


@asynccontextmanager
async def lifespan(app):
    settings = Settings()
    validate_budget(settings)
    app.state.settings = settings
    app.state.store = Store(settings)
    app.state.active = ActiveReplies(settings.max_concurrency)
    app.state.evaluation = EvaluationLog(settings)

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
        app.state.evaluation.close()


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(Denied)
async def denied(request, exc):
    status = (401 if exc.code == 'turnstile_required' else 403 if exc.code in {'access_required', 'invalid_access_key'}
              else 429 if exc.code in {'rate_limited', 'allowance_exhausted'} else 503)
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


class UnlockInput(BaseModel):
    key: str = Field(min_length=1)


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
    previous_sid = verify(request.cookies.get(COOKIE), s.signing_key)
    if previous_sid:
        await request.app.state.active.cancel(previous_sid)
    sid = new_id()
    browser = verify(request.cookies.get(BROWSER_COOKIE), s.signing_key)
    if not browser or not browser.startswith('browser:'):
        browser = f'browser:{new_id()}'
    store = request.app.state.store
    store.create(sid, browser)
    response = JSONResponse({**store.usage(sid), 'session_id': sid})
    response.set_cookie(COOKIE, sign(sid, s.signing_key), httponly=True, secure=s.production, samesite='strict', path='/api/chat')
    response.set_cookie(BROWSER_COOKIE, sign(browser, s.signing_key), max_age=34560000,
                        httponly=True, secure=s.production, samesite='strict', path='/api/chat')
    return response


@app.post('/api/chat/unlock')
async def unlock(body: UnlockInput, request: Request):
    sid = session_id(request)
    s = request.app.state.settings
    store = request.app.state.store
    digest = hashlib.sha256(body.key.encode()).hexdigest()
    if not any(hmac.compare_digest(digest, value) for value in s.private_access_key_hashes):
        raise Denied('invalid_access_key')
    access_token = new_id()
    store.unlock(sid, access_token)
    return {'access_token': access_token, **store.usage(sid, access_token)}


@app.post('/api/chat/reset')
async def reset(request: Request):
    sid = session_id(request)
    access_token = request.headers.get('x-chat-access')
    request.app.state.store.private_access(sid, access_token)
    await request.app.state.active.cancel(sid)
    request.app.state.store.reset(sid, access_token)
    return request.app.state.store.usage(sid, access_token)


def event(name, data):
    return f'event: {name}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n'


@app.post('/api/chat')
async def chat(body: MessageInput, request: Request):
    s = request.app.state.settings
    store = request.app.state.store
    active = request.app.state.active
    sid = session_id(request)
    access_token = request.headers.get('x-chat-access')
    message = body.message.strip()
    if not message or len(message) > s.max_message_chars:
        return JSONResponse({'code': 'invalid_message'}, status_code=400)
    active.enter(sid)
    try:
        history = store.reserve(sid, ip_hash(visitor_ip(request), s.signing_key), access_token)
    except BaseException:
        active.leave(sid)
        raise

    async def stream():
        result = None
        turn_id = new_id()
        evaluation_token = bind(request.app.state.evaluation, turn_id)
        outcome = 'cancelled'
        answer = []
        record('turn_started', conversation=conversation(history), message=message,
               reserved_usd=s.reply_reservation_usd)
        active.bind(sid)
        try:
            async with asyncio.timeout(240):
                async with aclosing(run_turn(history, message, s)) as events:
                    async for name, data in events:
                        if s.off_path.exists():
                            raise Denied('off')
                        if name == 'result':
                            result = data
                            record('generation_finished', usage=data.get('usage'), timing=data.get('timing'),
                                   cost_usd=data['cost_usd'])
                        elif name in {'status', 'text', 'images', 'photo', 'photos_done', 'answer_done'}:
                            if name == 'text':
                                if not answer:
                                    record('first_text', role='worker')
                                answer.append(data['text'])
                            elif name != 'status':
                                record(name, role='photo' if name in {'photo', 'photos_done'} else 'worker', payload=data)
                            payload = {'images': data} if name == 'images' else data
                            yield event(name, {**payload, 'turn_id': turn_id})
                if result is None:
                    raise Denied('unavailable')
                store.finish(sid, result)
                outcome = 'success'
                yield event('done', {**store.usage(sid, access_token), 'turn_id': turn_id})
        except Exception as exc:
            outcome = 'timeout' if isinstance(exc, TimeoutError) else 'error'
            data = {'code': exc.code if isinstance(exc, (Denied, ReplyUnavailable)) else 'unavailable', 'turn_id': turn_id}
            record('turn_error', error_type=type(exc).__name__, code=data['code'])
            if isinstance(exc, ReplyUnavailable):
                store.finish(sid, cost_usd=exc.cost_usd)
            with suppress(Denied):
                data.update(store.usage(sid, access_token))
            yield event('error', data)
        finally:
            try:
                store.finish(sid)
            finally:
                active.leave(sid)
                record('turn_finished', outcome=outcome, answer=''.join(answer))
                unbind(evaluation_token)

    return StreamingResponse(stream(), media_type='text/event-stream', headers={'X-Accel-Buffering': 'no'})
