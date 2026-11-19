import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv


@dataclass
class Settings:
    def __init__(self):
        load_dotenv()
        self.production = os.getenv('APP_ENV', 'development') == 'production'
        self.signing_key = os.getenv('SESSION_SIGNING_KEY', '')
        if len(self.signing_key) < 32:
            raise ValueError('Set SESSION_SIGNING_KEY to a random value of at least 32 characters')
        self.prompt = Path(os.getenv('PROMPT_PATH', 'prompt.md')).read_text()
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
            'max_concurrency': 8, 'max_output_tokens': 2048, 'max_requests': 5,
            'max_searches': 3, 'max_fetches': 2, 'max_input_tokens': 16000,
        }.items():
            value = int(os.getenv(name.upper(), str(default)))
            if value <= 0:
                raise ValueError(f'{name} must be positive')
            setattr(self, name, value)
        for name, default in {
            'daily_budget_usd': 10, 'reply_reservation_usd': 1.5,
            'anthropic_input_usd_per_million': 2, 'anthropic_output_usd_per_million': 10,
            'openai_input_usd_per_million': 1, 'openai_output_usd_per_million': 5,
            'search_usd': 0.01,
        }.items():
            value = float(os.getenv(name.upper(), str(default)))
            if not 0 < value < float('inf'):
                raise ValueError(f'{name} must be positive and finite')
            setattr(self, name, value)
        for name, default in {
            'anthropic_model': 'claude-sonnet-5-5', 'openai_model': 'gpt-6.1-terra',
            'anthropic_api_key': '', 'openai_api_key': '',
            'openverse_client_id': '', 'openverse_client_secret': '',
        }.items():
            setattr(self, name, os.getenv(name.upper(), default))
