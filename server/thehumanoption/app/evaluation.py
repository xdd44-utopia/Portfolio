import json
import logging
import os
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler


_run = ContextVar('evaluation_run', default=None)
_diagnostics = logging.getLogger('thehumanoption.evaluation')


class PrivateRotatingHandler(RotatingFileHandler):
    def _open(self):
        descriptor = os.open(self.baseFilename, os.O_WRONLY | os.O_APPEND | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        try:
            os.fchmod(descriptor, 0o600)
            return os.fdopen(descriptor, 'a', encoding='utf-8')
        except BaseException:
            os.close(descriptor)
            raise

    def handleError(self, record):
        if not self.failed:
            self.failed = True
            _diagnostics.warning('Evaluation log write failed; some evaluation events may be missing.')


class EvaluationLog:
    def __init__(self, settings):
        self.handler = None
        self.failed = False
        if not settings.evaluation_logging:
            return
        path = settings.evaluation_log_path
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        if path.parent.is_symlink() or path.parent.stat().st_mode & 0o077:
            raise ValueError('Evaluation log directory must be private (chmod 700) and not a symlink')
        self.handler = PrivateRotatingHandler(path, maxBytes=settings.evaluation_log_max_bytes,
                                             backupCount=settings.evaluation_log_backups, encoding='utf-8')
        self.handler.failed = False
        self.handler.setFormatter(logging.Formatter('%(message)s'))

    def write(self, payload):
        if self.handler is None:
            return
        try:
            line = json.dumps(payload, ensure_ascii=False, allow_nan=False)
            self.handler.handle(logging.LogRecord('evaluation', logging.INFO, '', 0, line, (), None))
        except Exception:
            if not self.failed:
                self.failed = True
                _diagnostics.warning('Evaluation event could not be recorded; event contents omitted.')

    def close(self):
        if self.handler is not None:
            self.handler.close()


def bind(log, turn_id):
    return _run.set((log, turn_id, time.monotonic()))


def unbind(token):
    _run.reset(token)


def record(event, role=None, **data):
    current = _run.get()
    if current is None:
        return
    log, turn_id, started = current
    log.write({'timestamp': datetime.now(timezone.utc).isoformat(), 'turn_id': turn_id,
               'elapsed_seconds': round(time.monotonic() - started, 4),
               'event': event, 'role': role, 'data': data})


def conversation(history):
    entries = []
    for message in history:
        for part in message.get('parts', []):
            kind = part.get('part_kind')
            if kind in {'user-prompt', 'text'} and isinstance(part.get('content'), str):
                entries.append({'role': 'user' if kind == 'user-prompt' else 'assistant',
                                'text': part['content']})
    return entries
