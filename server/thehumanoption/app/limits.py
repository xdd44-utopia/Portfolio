from .store import Denied


class ActiveReplies:
    def __init__(self, maximum):
        self.maximum = maximum
        self.sessions = set()

    def enter(self, sid):
        if sid in self.sessions or len(self.sessions) >= self.maximum:
            raise Denied('unavailable')
        self.sessions.add(sid)

    def leave(self, sid):
        self.sessions.discard(sid)
