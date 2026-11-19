import asyncio
from contextlib import suppress

from .store import Denied


class ActiveReplies:
    def __init__(self, maximum):
        self.maximum = maximum
        self.sessions = set()
        self.tasks = {}

    def enter(self, sid):
        if sid in self.sessions or len(self.sessions) >= self.maximum:
            raise Denied('unavailable')
        self.sessions.add(sid)

    def leave(self, sid):
        self.tasks.pop(sid, None)
        self.sessions.discard(sid)

    def bind(self, sid):
        self.tasks[sid] = asyncio.current_task()

    async def cancel(self, sid):
        task = self.tasks.get(sid)
        if task is not None:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task
        elif sid in self.sessions:
            raise Denied('unavailable')
