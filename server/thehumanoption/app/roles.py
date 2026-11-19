from dataclasses import replace
import time

from pydantic_ai import Agent
from pydantic_ai.capabilities import AbstractCapability
from pydantic_ai.exceptions import UsageLimitExceeded
from pydantic_ai.messages import NativeToolCallPart
from pydantic_ai.models.anthropic import AnthropicModel
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.anthropic import AnthropicProvider
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits

from .evaluation import record


class ChatOpenAIResponsesModel(OpenAIResponsesModel):
    async def count_tokens(self, messages, model_settings, model_request_parameters):
        """OpenAI's token-count endpoint rejects generation-only max_tool_calls."""
        settings = dict(model_settings or {})
        extra_body = dict(settings.get("extra_body") or {})
        extra_body.pop("max_tool_calls", None)
        settings["extra_body"] = extra_body
        return await super().count_tokens(messages, settings, model_request_parameters)


class RoleBounds(AbstractCapability):
    def __init__(self, runner):
        self.runner = runner

    async def prepare_model_request(self, ctx, request_context):
        runner = self.runner
        role = runner.role
        if runner.requests >= role.requests:
            raise UsageLimitExceeded("Request limit reached")
        remaining = role.output_total - runner.output_tokens
        if remaining <= 0:
            raise UsageLimitExceeded("Output token limit reached")
        runner.requests += 1
        runner.request_started = time.monotonic()
        record("request_started", role.name, model=runner.model_name, attempt=runner.requests,
               reasoning_effort=role.reasoning)
        model_settings = dict(request_context.model_settings or {})
        if runner.counters is not None and request_context.model.system == "openai":
            model_settings["extra_body"] = {"max_tool_calls": max(1, runner.settings.max_searches - runner.counters["searches"])}
        model_settings["max_tokens"] = min(role.output_per_request, remaining)
        try:
            counted = await request_context.model.count_tokens(
                request_context.messages, model_settings, request_context.model_request_parameters,
            )
        except Exception as error:
            record("token_count_failed", role.name, model=runner.model_name, attempt=runner.requests,
                   error_type=type(error).__name__, generation_started=False, cost_usd=0)
            raise
        record("request_counted", role.name, model=runner.model_name, attempt=runner.requests,
               input_tokens=counted.input_tokens, output_allowance=model_settings["max_tokens"],
               input_total_before=runner.input_tokens, output_total_before=runner.output_tokens)
        if counted.input_tokens > role.input_per_request or runner.input_tokens + counted.input_tokens > role.input_total:
            raise UsageLimitExceeded("Input token limit reached")
        runner.pending = (counted.input_tokens, model_settings["max_tokens"])
        runner.last_input_tokens = counted.input_tokens
        return replace(request_context, model_settings=model_settings)

    async def after_model_request(self, ctx, *, request_context, response):
        runner = self.runner
        usage = response.usage
        previous_cost = runner.cost
        runner.pending = None
        runner.input_tokens += usage.input_tokens
        runner.output_tokens += usage.output_tokens
        input_price, output_price = runner.settings.model_prices[request_context.model.model_name]
        details = usage.details or {}
        cache_read = min(usage.input_tokens, usage.cache_read_tokens)
        long_write = min(usage.cache_write_tokens, details.get("ephemeral_1h_input_tokens", 0))
        input_equivalent = usage.input_tokens - cache_read * 0.95 + usage.cache_write_tokens * 0.25 + long_write * 0.75
        if request_context.model.system == "openai":
            input_equivalent += min(usage.cache_write_tokens, details.get("cache_write_12h_tokens", 0)) * 1.25
        runner.cost += (input_equivalent * input_price
                        + usage.output_tokens * output_price) / 1_000_000
        searches = max(
            sum(isinstance(part, NativeToolCallPart) and "search" in part.tool_name for part in response.parts),
            (usage.details or {}).get("web_search_requests", 0),
        )
        runner.cost += searches * runner.settings.search_usd
        runner.attempt_usage.append({"model": request_context.model.model_name, "input_tokens": usage.input_tokens,
                                     "output_tokens": usage.output_tokens, "cost_usd": runner.cost - previous_cost,
                                     "estimated": False})
        record("request_finished", runner.role.name, attempt=runner.requests,
               **runner.attempt_usage[-1], cache_read_tokens=usage.cache_read_tokens,
               cache_write_tokens=usage.cache_write_tokens, searches=searches,
               finish_reason=response.finish_reason, response_state=response.state,
               duration_seconds=time.monotonic() - runner.request_started)
        for part in response.parts:
            if isinstance(part, NativeToolCallPart):
                record("native_tool_call", runner.role.name, model=runner.model_name,
                       attempt=runner.requests, tool=part.tool_name, call_id=part.tool_call_id,
                       arguments=part.args)
        if runner.input_tokens > runner.role.input_total or runner.output_tokens > runner.role.output_total:
            raise UsageLimitExceeded("Role token limit reached")
        if response.finish_reason in {"length", "error"} or response.state in {"incomplete", "interrupted"}:
            raise RuntimeError("Model response interrupted")
        return response


class RoleRunner:
    def __init__(self, settings, role):
        self.settings = settings
        self.role = settings.roles[role]
        self.requests = 0
        self.request_started = time.monotonic()
        self.input_tokens = 0
        self.output_tokens = 0
        self.cost = 0.0
        self.attempt_usage = []
        self.pending = None
        self.last_input_tokens = 0
        self.switched = False
        self.counters = None
        self.model_name = self.role.primary
        if not self.available(self.model_name):
            self.model_name = self.role.fallback
            self.switched = True
            record("fallback_selected", role, previous_model=self.role.primary,
                   model=self.model_name, reason="primary_not_configured")

    def available(self, name):
        return bool(self.settings.anthropic_api_key if name.startswith("claude") else self.settings.openai_api_key)

    def model(self):
        if not self.available(self.model_name):
            raise RuntimeError("Role provider unavailable")
        if self.model_name.startswith("claude"):
            return AnthropicModel(self.model_name, provider=AnthropicProvider(api_key=self.settings.anthropic_api_key))
        return ChatOpenAIResponsesModel(self.model_name, provider=OpenAIProvider(api_key=self.settings.openai_api_key))

    def settings_for_model(self, counters=None):
        result = {"max_tokens": self.role.output_per_request, "timeout": 60, "max_retries": 0}
        if self.model_name.startswith("claude"):
            result.update(anthropic_thinking={"type": "adaptive"}, anthropic_effort=self.role.reasoning)
        else:
            result.update(openai_store=False, openai_reasoning_effort=self.role.reasoning)
            if counters is not None:
                result["extra_body"] = {"max_tool_calls": max(1, self.settings.max_searches - counters["searches"])}
        return result

    def settle_unknown(self):
        if self.pending is None:
            return
        incoming, outgoing = self.pending
        self.pending = None
        self.input_tokens += incoming
        self.output_tokens += outgoing
        input_price, output_price = self.settings.model_prices[self.model_name]
        estimate = (incoming * input_price * 1.25 + outgoing * output_price) / 1_000_000
        if self.counters is not None:
            searches = max(0, self.settings.max_searches - self.counters["searches"])
            fetches = max(0, self.settings.max_fetches - self.counters["fetches"])
            estimate += (searches * 20000 + fetches * 2000) * input_price * 1.25 / 1_000_000
            estimate += searches * self.settings.search_usd
            self.counters["searches"] = self.settings.max_searches
            self.counters["fetches"] = self.settings.max_fetches
        self.cost += estimate
        self.attempt_usage.append({"model": self.model_name, "input_tokens": incoming,
                                   "output_tokens": outgoing, "cost_usd": estimate, "estimated": True})
        record("request_usage_estimated", self.role.name, attempt=self.requests,
               **self.attempt_usage[-1], duration_seconds=time.monotonic() - self.request_started)

    def switch(self, error):
        self.settle_unknown()
        status = getattr(error, "status_code", None)
        record("request_failed", self.role.name, model=self.model_name, attempt=self.requests,
               error_type=type(error).__name__, status_code=status if isinstance(status, int) else None)
        if isinstance(error, UsageLimitExceeded) or self.switched or not self.available(self.role.fallback):
            return False
        self.switched = True
        previous = self.model_name
        self.model_name = self.role.fallback
        record("fallback_selected", self.role.name, previous_model=previous, model=self.model_name,
               will_retry=self.requests < self.role.requests)
        return self.requests < self.role.requests

    def limits(self):
        return UsageLimits(request_limit=self.role.requests, tool_calls_limit=8)

    async def run(self, prompt, instructions, output_type):
        while True:
            try:
                agent = Agent(self.model(), instructions=instructions, output_type=output_type,
                              capabilities=[RoleBounds(self)], retries=0,
                              model_settings=self.settings_for_model())
                async with agent:
                    result = await agent.run(prompt, usage_limits=self.limits())
                return result.output
            except Exception as error:
                if not self.switch(error):
                    raise
            finally:
                self.settle_unknown()
