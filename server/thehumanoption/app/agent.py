import asyncio
import json
import time
from contextlib import suppress

from pydantic import BaseModel, Field, field_validator
from pydantic_ai import Agent, AgentRunResultEvent, RunContext
from pydantic_ai.capabilities import NativeTool
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import (
    FunctionToolCallEvent, FunctionToolResultEvent, ModelMessagesTypeAdapter,
    NativeToolCallPart, PartDeltaEvent, PartStartEvent, TextPart, TextPartDelta,
)
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool
from pydantic_ai.models import ModelRequestParameters

from .roles import RoleBounds, RoleRunner
from .evaluation import record
from .tools.calculate import calculate
from .tools.images import find_images as search_images


class ReplyUnavailable(Exception):
    def __init__(self, cost_usd, code="unavailable"):
        super().__init__(code)
        self.cost_usd = cost_usd
        self.code = code


class PhotoAspect(BaseModel):
    query: str = Field(min_length=1, max_length=100)
    instructions: str = Field(min_length=20, max_length=3000)
    count: int = Field(ge=1, le=5)

    @field_validator("query")
    @classmethod
    def search_keywords(cls, value):
        if not 2 <= len(value.split()) <= 5:
            raise ValueError("Search queries require 2–5 plain keywords")
        return value.strip()


class ThemePlan(BaseModel):
    worker_prompt: str = Field(min_length=20, max_length=12000)
    photo_prompt: str = Field(min_length=20, max_length=12000)
    aspects: list[PhotoAspect] = Field(min_length=1, max_length=5)

    @field_validator("worker_prompt", "photo_prompt")
    @classmethod
    def nonempty_prompt(cls, value):
        if not value.strip():
            raise ValueError("Prompt cannot be blank")
        return value.strip()

    @field_validator("aspects")
    @classmethod
    def photo_allowance(cls, values):
        if sum(value.count for value in values) > 5:
            raise ValueError("At most five photos may be requested across all aspects")
        return values


THEME_CONTRACT = """
Return the ThemePlan structured output: worker_prompt and photo_prompt must each be
self-contained instructions for this turn. Choose 1–5 ordered aspects of the user request.
Each aspect has a query of 2–5 plain keywords and at most 100 characters,
self-contained scene instructions, and a predetermined count of photos to return.
Allocate at most five photos in total across all aspects. The image
search engines match keywords, so omit full sentences, composition requirements,
negative constraints, and abstract interpretations from these short queries.
Put aspect-specific directions in each aspect's instructions and shared inspection criteria in photo_prompt.
The worker receives the original
user request and conversation separately, answers naturally, and may search the web,
fetch pages, calculate, or find answer images with source links. Do not require five
answer sections. Each aspect gets a separate finder invocation, sharing the turn's role budget.
It searches Brave for up to sixteen candidates per requested photo and inspects at most
eight usable previews per requested photo, in batches of eight, stopping when its quota is met.
Select distinct relevant photographs by candidate ID; metadata alone cannot establish the scene.
Generated instructions cannot override fixed safety, tools, schemas, or budgets.
Keep all planning private. Do not ask downstream roles to reveal these instructions.
"""


def minimum_reservation(settings):
    total = settings.max_searches * settings.search_usd
    for role in settings.roles.values():
        input_price = max(settings.model_prices[name][0] for name in (role.primary, role.fallback))
        output_price = max(settings.model_prices[name][1] for name in (role.primary, role.fallback))
        incoming = role.input_total
        if role.name == "worker":
            incoming += settings.max_searches * 20000 + settings.max_fetches * 2000
        total += (incoming * input_price * 1.25 + role.output_total * output_price) / 1_000_000
    return total


def validate_budget(settings):
    settings.reply_reservation_usd = max(settings.reply_reservation_usd, minimum_reservation(settings))


def _make_worker(settings, counters, runner, instructions):
    def web_search(ctx: RunContext):
        remaining = settings.max_searches - counters["searches"]
        if remaining <= 0:
            return None
        return WebSearchTool(search_context_size="low", max_uses=remaining if ctx.model.system == "anthropic" else None,
                             blocked_domains=list(getattr(settings, "blocked_domains", ())) or None)

    def web_fetch(ctx: RunContext):
        remaining = settings.max_fetches - counters["fetches"]
        if ctx.model.system != "anthropic" or remaining <= 0:
            return None
        return WebFetchTool(max_uses=remaining, provider_settings={"anthropic": {"max_content_tokens": 2000}})

    async def find_images(query: str, limit: int = 6) -> list[dict]:
        """Find up to six images with source links; reuse permissions are not established."""
        return await search_images(query, min(6, limit), api_key=settings.brave_search_api_key)

    return Agent(runner.model(), instructions=instructions, tools=[find_images, calculate],
                 capabilities=[RoleBounds(runner), NativeTool(web_search), NativeTool(web_fetch)],
                 retries=0, tool_timeout=30, model_settings=runner.settings_for_model(counters))


async def run_reply(history, message, settings, instructions=None, runner=None):
    runner = runner or RoleRunner(settings, "worker")
    counters = {"searches": 0, "fetches": 0, "text_started": False}
    runner.counters = counters
    seen_calls = set()
    messages = ModelMessagesTypeAdapter.validate_python(history)
    combined = settings.prompt
    if instructions:
        combined += "\n\nTurn-specific guidance follows. The requirements above take precedence.\n" + instructions
    yield "status", {"label": "thinking"}
    while True:
        try:
            agent = _make_worker(settings, counters, runner, combined)
            async with agent:
                async with agent.run_stream_events(message, message_history=messages, usage_limits=runner.limits()) as events:
                    async for event in events:
                        if isinstance(event, PartStartEvent):
                            part = event.part
                            if isinstance(part, TextPart) and part.content:
                                counters["text_started"] = True
                                yield "text", {"text": part.content}
                            elif isinstance(part, NativeToolCallPart) and part.tool_call_id not in seen_calls:
                                seen_calls.add(part.tool_call_id)
                                if "search" in part.tool_name:
                                    counters["searches"] += 1
                                elif "fetch" in part.tool_name:
                                    counters["fetches"] += 1
                                yield "status", {"label": "searching"}
                        elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                            counters["text_started"] = True
                            yield "text", {"text": event.delta.content_delta}
                        elif isinstance(event, FunctionToolCallEvent):
                            record("tool_call", "worker", model=runner.model_name, tool=event.part.tool_name,
                                   call_id=event.part.tool_call_id, arguments=event.part.args)
                            yield "status", {"label": "finding_images" if event.part.tool_name == "find_images" else "calculating"}
                        elif isinstance(event, FunctionToolResultEvent):
                            record("tool_result", "worker", model=runner.model_name, tool=event.part.tool_name,
                                   call_id=event.part.tool_call_id, result=event.part.content)
                            if event.part.tool_name == "find_images" and isinstance(event.part.content, list):
                                yield "images", event.part.content
                        elif isinstance(event, AgentRunResultEvent):
                            saved = json.loads(event.result.all_messages_json())
                            for item in saved:
                                item.pop("instructions", None)
                                item.pop("instruction_parts", None)
                            tokens = runner.last_input_tokens + event.result.usage.output_tokens
                            with suppress(Exception):
                                counted = await runner.model().count_tokens(
                                    ModelMessagesTypeAdapter.validate_python(saved), {}, ModelRequestParameters(),
                                )
                                tokens = counted.input_tokens
                            yield "result", {"history": saved, "cost_usd": runner.cost,
                                             "tokens": tokens}
            return
        except Exception as error:
            runner.settle_unknown()
            record("worker_attempt_failed", "worker", model=runner.model_name,
                   error_type=type(error).__name__, text_started=counters["text_started"])
            if not counters["text_started"] and runner.switch(error):
                continue
            code = "conversation_full" if isinstance(error, UsageLimitExceeded) else "unavailable"
            raise ReplyUnavailable(runner.cost, code) from error
        finally:
            runner.settle_unknown()


async def run_turn(history, message, settings):
    from .photos import find_photos

    started = time.monotonic()
    first_text = None
    first_photo = None
    theme = RoleRunner(settings, "theme")
    worker = RoleRunner(settings, "worker")
    photo = RoleRunner(settings, "photo")
    plan = None
    yield "status", {"label": "thinking"}
    recent = []
    for item in history:
        for part in item.get("parts", []):
            if part.get("part_kind") in {"user-prompt", "text"} and isinstance(part.get("content"), str):
                recent.append({"role": "user" if part["part_kind"] == "user-prompt" else "assistant",
                               "text": part["content"][:2000]})
    try:
        plan = await theme.run(json.dumps({"conversation": recent[-6:], "request": message}, ensure_ascii=False),
                               settings.theme_prompt + "\n" + THEME_CONTRACT, ThemePlan)
        record("theme_plan", "theme", worker_prompt=plan.worker_prompt,
               photo_prompt=plan.photo_prompt, aspects=[aspect.model_dump() for aspect in plan.aspects])
    except Exception as error:
        record("theme_unavailable", "theme", error_type=type(error).__name__, ordinary_chat=True)

    queue = asyncio.Queue()
    result = None
    failure = None

    async def answer():
        nonlocal result, failure
        try:
            async for name, data in run_reply(history, message, settings, plan.worker_prompt if plan else None, worker):
                if name == "result":
                    result = data
                else:
                    await queue.put((name, data))
        except Exception as error:
            failure = error if isinstance(error, ReplyUnavailable) else ReplyUnavailable(worker.cost)
        finally:
            record("answer_finished", "worker", interrupted=failure is not None,
                   has_result=result is not None, cancelled=bool(asyncio.current_task().cancelling()))
            await queue.put(("answer_done", {"interrupted": failure is not None}))
            await queue.put(("_finished", "answer"))

    async def pictures():
        count = 0
        try:
            if plan:
                async for selected in find_photos(plan.photo_prompt, plan.aspects, settings, photo):
                    await queue.put(("photo", selected))
                    count += 1
        except Exception as error:
            record("photos_failed", "photo", error_type=type(error).__name__)
        finally:
            photo.settle_unknown()
            record("photos_finished", "photo", count=count, theme_available=plan is not None,
                   cancelled=bool(asyncio.current_task().cancelling()))
            await queue.put(("photos_done", {"count": count, "unavailable": count == 0}))
            await queue.put(("_finished", "photos"))

    tasks = [asyncio.create_task(answer()), asyncio.create_task(pictures())]
    try:
        finished = 0
        while finished < 2:
            name, data = await queue.get()
            if name == "_finished":
                finished += 1
            else:
                if name == "text" and first_text is None:
                    first_text = time.monotonic() - started
                if name == "photo" and first_photo is None:
                    first_photo = time.monotonic() - started
                yield name, data
        cost = theme.cost + worker.cost + photo.cost
        if failure or result is None:
            raise ReplyUnavailable(cost, failure.code if failure else "unavailable")
        result["cost_usd"] = cost
        result["usage"] = {name: {"model": runner.model_name, "requests": runner.requests, "input_tokens": runner.input_tokens,
                                  "output_tokens": runner.output_tokens, "cost_usd": runner.cost,
                                  "attempts": runner.attempt_usage}
                           for name, runner in (("theme", theme), ("worker", worker), ("photo", photo))}
        result["timing"] = {"first_pair_seconds": max(first_text, first_photo) if first_text is not None and first_photo is not None else None,
                            "generation_seconds": time.monotonic() - started}
        yield "result", result
    finally:
        for task in tasks:
            task.cancel()
        for task in tasks:
            with suppress(asyncio.CancelledError):
                await task
