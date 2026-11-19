import json
from dataclasses import replace

from pydantic_ai import Agent, AgentRunResultEvent, RunContext
from pydantic_ai.capabilities import AbstractCapability, ModelFallback, NativeTool
from pydantic_ai.exceptions import ModelAPIError, UsageLimitExceeded
from pydantic_ai.messages import (
    FunctionToolCallEvent, FunctionToolResultEvent, ModelMessagesTypeAdapter,
    ModelResponse, NativeToolCallPart, PartDeltaEvent, PartStartEvent, TextPart, TextPartDelta,
)
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.native_tools import WebFetchTool, WebSearchTool
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from .tools.calculate import calculate
from .tools.images import find_images as search_images


class ReplyUnavailable(Exception):
    def __init__(self, cost_usd, code="unavailable"):
        super().__init__(code)
        self.cost_usd = cost_usd
        self.code = code


class ChatOpenAIResponsesModel(OpenAIResponsesModel):
    async def count_tokens(self, messages, model_settings, model_request_parameters):
        """OpenAI's token-count endpoint rejects the generation-only max_tool_calls field."""
        settings = dict(model_settings or {})
        extra_body = dict(settings.get("extra_body") or {})
        extra_body.pop("max_tool_calls", None)
        settings["extra_body"] = extra_body
        return await super().count_tokens(messages, settings, model_request_parameters)


def minimum_reservation(settings):
    input_price = max(settings.anthropic_input_usd_per_million, settings.openai_input_usd_per_million)
    output_price = max(settings.anthropic_output_usd_per_million, settings.openai_output_usd_per_million)
    input_allowance = settings.max_input_tokens + settings.max_searches * 20000 + settings.max_fetches * 2000
    return (settings.max_requests * (input_allowance * input_price * 1.25 + settings.max_output_tokens * output_price)
            / 1_000_000 + settings.max_searches * settings.search_usd)


def validate_budget(settings):
    required = minimum_reservation(settings)
    if settings.reply_reservation_usd < required:
        raise ValueError(f"REPLY_RESERVATION_USD must be at least {required:.4f} for the configured limits and prices")


class RequestBounds(AbstractCapability):
    def __init__(self, settings, counters):
        self.settings = settings
        self.counters = counters

    async def prepare_model_request(self, ctx, request_context):
        settings = self.settings
        self.counters["requests"] += 1
        if self.counters["requests"] > settings.max_requests:
            raise UsageLimitExceeded("Request limit reached")
        serialized = ModelMessagesTypeAdapter.dump_json(request_context.messages)
        if len(serialized) + len(settings.prompt.encode()) > settings.max_input_tokens * 3:
            raise UsageLimitExceeded("Conversation limit reached")
        model_settings = dict(request_context.model_settings or {})
        if request_context.model.system == "openai":
            model_settings.update(openai_store=False, openai_reasoning_effort="low",
                                  extra_body={"max_tool_calls": max(1, settings.max_searches - self.counters["searches"])})
        else:
            model_settings.update(anthropic_thinking={"type": "adaptive"}, anthropic_effort="low")
        return replace(request_context, model_settings=model_settings)


def _make_agent(settings, counters):
    models = []
    if settings.openai_api_key:
        models.append(ChatOpenAIResponsesModel(settings.openai_model, provider=OpenAIProvider(api_key=settings.openai_api_key)))
    if settings.anthropic_api_key:
        models.append(AnthropicModel(settings.anthropic_model, provider=AnthropicProvider(api_key=settings.anthropic_api_key)))
    if not models:
        raise ReplyUnavailable(0)

    def fallback(error: Exception):
        allowed = not counters.get("text_started") and isinstance(error, (ModelAPIError, TimeoutError))
        if allowed:
            counters["fallback"] = True
        return allowed

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
        """Find up to six openly licensed images with source links, creator credits and licenses."""
        return await search_images(query, limit, client_id=settings.openverse_client_id, client_secret=settings.openverse_client_secret)

    capabilities = [RequestBounds(settings, counters), NativeTool(web_search), NativeTool(web_fetch)]
    if len(models) > 1:
        capabilities.insert(0, ModelFallback(models[1], fallback_on=fallback, sticky=True))
    return Agent(models[0], instructions=settings.prompt, tools=[find_images, calculate],
                 capabilities=capabilities, retries=0, tool_timeout=30,
                 model_settings={"max_tokens": settings.max_output_tokens, "timeout": 60, "max_retries": 0})


def _cost(messages, settings):
    total = 0.0
    for message in messages:
        if not isinstance(message, ModelResponse):
            continue
        usage = message.usage
        anthropic = message.provider_name == "anthropic" or (message.model_name or "").startswith("claude")
        input_price = settings.anthropic_input_usd_per_million if anthropic else settings.openai_input_usd_per_million
        output_price = settings.anthropic_output_usd_per_million if anthropic else settings.openai_output_usd_per_million
        total += ((usage.input_tokens + usage.cache_write_tokens * 0.25) * input_price + usage.output_tokens * output_price) / 1_000_000
        searches = sum(isinstance(part, NativeToolCallPart) and "search" in part.tool_name for part in message.parts)
        searches = max(searches, (usage.details or {}).get("web_search_requests", 0))
        total += searches * settings.search_usd
    return total


async def run_reply(history: list, message: str, settings):
    counters = {"requests": 0, "searches": 0, "fetches": 0, "fallback": False}
    seen_calls = set()
    try:
        validate_budget(settings)
        agent = _make_agent(settings, counters)
        messages = ModelMessagesTypeAdapter.validate_python(history)
        yield "status", {"label": "thinking"}
        async with agent:
            async with agent.run_stream_events(message, message_history=messages, usage_limits=UsageLimits(
                request_limit=settings.max_requests, tool_calls_limit=8,
                output_tokens_limit=settings.max_output_tokens * settings.max_requests,
                input_tokens_limit=settings.max_input_tokens * settings.max_requests,
                per_request_input_tokens_limit=settings.max_input_tokens,
                count_tokens_before_request=True,
            )) as events:
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
                        label = "finding_images" if event.part.tool_name == "find_images" else "calculating"
                        yield "status", {"label": label}
                    elif isinstance(event, FunctionToolResultEvent) and event.part.tool_name == "find_images":
                        if isinstance(event.part.content, list):
                            yield "images", event.part.content
                    elif isinstance(event, AgentRunResultEvent):
                        result = event.result
                        all_messages = json.loads(result.all_messages_json())
                        cost = settings.reply_reservation_usd if counters["fallback"] else _cost(result.new_messages(), settings)
                        yield "result", {"history": all_messages, "cost_usd": cost,
                                         "tokens": (len(json.dumps(all_messages, ensure_ascii=False).encode()) + 2) // 3}
    except UsageLimitExceeded as exc:
        code = "conversation_full" if "token" in str(exc).lower() or "conversation" in str(exc).lower() else "unavailable"
        raise ReplyUnavailable(settings.reply_reservation_usd if counters["requests"] else 0, code) from exc
    except Exception as exc:
        raise ReplyUnavailable(settings.reply_reservation_usd if counters["requests"] else 0) from exc
