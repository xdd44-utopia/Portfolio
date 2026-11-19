import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


@dataclass(frozen=True)
class RoleConfig:
    name: str
    primary: str
    fallback: str
    reasoning: str
    input_per_request: int
    output_per_request: int
    requests: int
    input_total: int
    output_total: int


@dataclass
class Settings:
    def __init__(self):
        load_dotenv()
        self.production = os.getenv('APP_ENV', 'development') == 'production'
        self.evaluation_logging = os.getenv('EVALUATION_LOGGING', 'true').lower()
        if self.evaluation_logging not in {'true', 'false'}:
            raise ValueError('EVALUATION_LOGGING must be true or false')
        self.evaluation_logging = self.evaluation_logging == 'true'
        self.evaluation_log_path = Path(os.getenv(
            'EVALUATION_LOG_PATH',
            '/var/lib/thehumanoption/evaluation/runs.jsonl' if self.production else 'evaluation/runs.jsonl',
        ))
        self.evaluation_log_max_bytes = int(os.getenv('EVALUATION_LOG_MAX_BYTES', '10000000'))
        self.evaluation_log_backups = int(os.getenv('EVALUATION_LOG_BACKUPS', '5'))
        if self.evaluation_log_max_bytes < 10000 or not 1 <= self.evaluation_log_backups <= 100:
            raise ValueError('Evaluation logs require at least 10000 bytes and 1–100 backups')
        self.signing_key = os.getenv('SESSION_SIGNING_KEY', '')
        if len(self.signing_key) < 32:
            raise ValueError('Set SESSION_SIGNING_KEY to a random value of at least 32 characters')
        self.prompt = Path(os.getenv('PROMPT_PATH', 'prompt.md')).read_text()
        self.theme_prompt = Path(os.getenv('THEME_PROMPT_PATH', 'prompts/theme.md')).read_text()
        if not self.prompt.strip() or not self.theme_prompt.strip() or len(self.theme_prompt) > 40000:
            raise ValueError('Private prompts must be nonempty; theme prompt must fit within 40000 characters')
        self.roles = {}
        for role, defaults in {
            'theme': ('claude-opus-5-5', 'gpt-6.2-astra', 'medium', 12000, 8192, 2, 24000, 16384),
            'worker': ('gpt-6.2-sol', 'claude-sonnet-5-5', 'low', 24000, 4096, 6, 96000, 16384),
            'photo': ('gpt-6.1-terra', 'claude-sonnet-5-5', 'low', 16000, 2048, 6, 48000, 8192),
        }.items():
            fields = ('primary', 'fallback', 'reasoning', 'input_per_request', 'output_per_request',
                      'requests', 'input_total', 'output_total')
            values = {field: os.getenv(f'{role}_{field}'.upper(), str(default))
                      for field, default in zip(fields, defaults)}
            for field in fields[3:]:
                values[field] = int(values[field])
                if values[field] <= 0:
                    raise ValueError(f'{role}_{field} must be positive')
            if values['reasoning'] not in {'low', 'medium', 'high'}:
                raise ValueError(f'{role}_reasoning must be low, medium or high')
            if values['primary'].startswith('claude') == values['fallback'].startswith('claude'):
                raise ValueError(f'{role} fallback must use the other provider')
            self.roles[role] = RoleConfig(role, **values)
        self.model_prices = {}
        for model, prices in {
            'claude-opus-5-5': (4, 20), 'claude-sonnet-5-5': (2, 10),
            'gpt-6.2-astra': (8, 40), 'gpt-6.2-sol': (2, 10), 'gpt-6.1-terra': (1, 5),
        }.items():
            prefix = model.upper().replace('-', '_').replace('.', '_')
            configured = tuple(float(os.getenv(f'{prefix}_{kind}_USD_PER_MILLION', str(default)))
                               for kind, default in zip(('INPUT', 'OUTPUT'), prices))
            if any(not 0 < price < float('inf') for price in configured):
                raise ValueError(f'Invalid prices for {model}')
            self.model_prices[model] = configured
        for role in self.roles.values():
            if role.primary not in self.model_prices or role.fallback not in self.model_prices:
                raise ValueError('Configure verified model prices before adding a model')
        self.database_path = os.getenv('DATABASE_PATH', 'chat.sqlite')
        self.off_path = Path(os.getenv('OFF_PATH', 'OFF'))
        self.origins = os.getenv('ALLOWED_ORIGINS', 'http://localhost:4321,http://127.0.0.1:4321').split(',')
        self.hostnames = os.getenv('TURNSTILE_HOSTNAMES', 'localhost,127.0.0.1').split(',')
        self.turnstile_secret = os.getenv('TURNSTILE_SECRET', '')
        if not self.turnstile_secret or (self.production and self.turnstile_secret.startswith(('1x', '2x', '3x'))):
            raise ValueError('Set a real TURNSTILE_SECRET in production')
        self.timezone = ZoneInfo(os.getenv('BUDGET_TIMEZONE', 'America/Los_Angeles'))
        self.private_access_key_hashes = tuple(
            value.strip().lower() for value in os.getenv('PRIVATE_ACCESS_KEY_HASHES', '').split(',') if value.strip()
        )
        if any(len(value) != 64 or any(char not in '0123456789abcdef' for char in value)
               for value in self.private_access_key_hashes):
            raise ValueError('PRIVATE_ACCESS_KEY_HASHES must contain comma-separated SHA-256 hashes')
        for name, default in {
            'session_hours': 1, 'idle_hours': 1,
            'browser_sessions': 10,
            'ip_hourly_messages': 50, 'ip_daily_messages': 500,
            'max_message_chars': 2000, 'max_turns': 5, 'max_conversation_tokens': 24000,
            'max_concurrency': 8, 'max_searches': 3, 'max_fetches': 2,
        }.items():
            value = int(os.getenv(name.upper(), str(default)))
            if value <= 0:
                raise ValueError(f'{name} must be positive')
            setattr(self, name, value)
        for name, default in {
            'daily_budget_usd': 10, 'reply_reservation_usd': 1.5,
            'search_usd': 0.01,
        }.items():
            value = float(os.getenv(name.upper(), str(default)))
            if not 0 < value < float('inf'):
                raise ValueError(f'{name} must be positive and finite')
            setattr(self, name, value)
        for name, default in {
            'anthropic_api_key': '', 'openai_api_key': '',
            'brave_search_api_key': '',
        }.items():
            setattr(self, name, os.getenv(name.upper(), default))
