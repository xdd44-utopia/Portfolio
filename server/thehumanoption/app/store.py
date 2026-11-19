import hashlib
import hmac
import json
import sqlite3
import time
from datetime import datetime


class Denied(Exception):
    def __init__(self, code):
        self.code = code


class Store:
    def __init__(self, settings):
        self.settings = settings
        self.db = sqlite3.connect(settings.database_path)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
            PRAGMA journal_mode=WAL;
            PRAGMA temp_store=MEMORY;
            PRAGMA secure_delete=ON;
            DROP TABLE IF EXISTS main.sessions;
            CREATE TEMP TABLE sessions (
                id TEXT PRIMARY KEY, browser TEXT, created REAL, touched REAL,
                access_hash TEXT, started INTEGER DEFAULT 0, turns INTEGER DEFAULT 0,
                tokens INTEGER DEFAULT 0, history TEXT DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS allowances (browser TEXT PRIMARY KEY, sessions INTEGER DEFAULT 0);
            CREATE TABLE IF NOT EXISTS requests (ip TEXT, at REAL);
            CREATE INDEX IF NOT EXISTS requests_ip_at ON requests(ip, at);
            CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, spent REAL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, day TEXT, amount REAL);
        ''')
        with self.db:
            if 'sessions' not in {row['name'] for row in self.db.execute('PRAGMA table_info(allowances)')}:
                self.db.execute('ALTER TABLE allowances ADD COLUMN sessions INTEGER DEFAULT 0')
            self.db.execute('DELETE FROM reservations')
        self.db.execute('PRAGMA wal_checkpoint(TRUNCATE)')

    def day(self):
        return datetime.now(self.settings.timezone).date().isoformat()

    def cleanup(self):
        now = time.time()
        with self.db:
            self.db.execute('DELETE FROM sessions WHERE touched < ? OR created < ?', (
                now - self.settings.idle_hours * 3600, now - self.settings.session_hours * 3600))
            self.db.execute('DELETE FROM requests WHERE at < ?', (now - 86400,))
            self.db.execute('DELETE FROM budget WHERE day < ?', (self.day(),))

    def status(self):
        if self.settings.off_path.exists():
            return 'off'
        row = self.db.execute('SELECT spent FROM budget WHERE day=?', (self.day(),)).fetchone()
        spent = row['spent'] if row else 0
        return 'closed_for_today' if spent + self.settings.reply_reservation_usd > self.settings.daily_budget_usd else 'open'

    def get(self, sid):
        row = self.db.execute('SELECT * FROM sessions WHERE id=?', (sid,)).fetchone()
        now = time.time()
        if not row or now - row['created'] >= self.settings.session_hours * 3600 or now - row['touched'] >= self.settings.idle_hours * 3600:
            raise Denied('turnstile_required')
        return row

    def create(self, sid, browser):
        self.cleanup()
        with self.db:
            self.db.execute('INSERT OR IGNORE INTO allowances(browser) VALUES (?)', (browser,))
            self.db.execute('INSERT INTO sessions(id,browser,created,touched) VALUES (?,?,?,?)', (sid, browser, time.time(), time.time()))

    def remaining(self, sid, access_token=None):
        row = self.get(sid)
        if self.private_access(sid, access_token):
            return None
        used = self.db.execute('SELECT sessions FROM allowances WHERE browser=?', (row['browser'],)).fetchone()
        return max(0, self.settings.browser_sessions - used['sessions'])

    def usage(self, sid, access_token=None):
        row = self.get(sid)
        private = self.private_access(sid, access_token)
        return {
            'remaining_chats': self.remaining(sid, access_token),
            'remaining_replies': None if private else max(0, self.settings.max_turns - row['turns']),
            'chat_started': bool(row['started']),
        }

    def private_access(self, sid, access_token):
        row = self.get(sid)
        if not access_token:
            return False
        if len(access_token) > 200 or not row['access_hash'] or not hmac.compare_digest(
            row['access_hash'], hashlib.sha256(access_token.encode()).hexdigest()
        ):
            raise Denied('access_required')
        return True

    def unlock(self, sid, access_token):
        self.get(sid)
        with self.db:
            self.db.execute('UPDATE sessions SET access_hash=? WHERE id=?', (
                hashlib.sha256(access_token.encode()).hexdigest(), sid))

    def reserve(self, sid, ip, access_token=None):
        s = self.settings
        now = time.time()
        with self.db:
            row = self.get(sid)
            private = self.private_access(sid, access_token)
            status = self.status()
            if status != 'open':
                raise Denied('off' if status == 'off' else 'budget_exhausted')
            if not private and not row['started'] and self.remaining(sid) <= 0:
                raise Denied('allowance_exhausted')
            if (not private and row['turns'] >= s.max_turns) or row['tokens'] >= s.max_conversation_tokens:
                raise Denied('conversation_full')
            counts = self.db.execute('SELECT COUNT(*) AS daily, SUM(at > ?) AS hourly FROM requests WHERE ip=? AND at > ?', (now - 3600, ip, now - 86400)).fetchone()
            if counts['daily'] >= s.ip_daily_messages or (counts['hourly'] or 0) >= s.ip_hourly_messages:
                raise Denied('rate_limited')
            self.db.execute('INSERT INTO requests VALUES (?,?)', (ip, now))
            if not private and not row['started']:
                self.db.execute('UPDATE allowances SET sessions=sessions+1 WHERE browser=?', (row['browser'],))
                self.db.execute('UPDATE sessions SET started=1 WHERE id=?', (sid,))
            self.db.execute('UPDATE sessions SET touched=? WHERE id=?', (now, sid))
            self.db.execute('INSERT INTO budget(day,spent) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET spent=spent+excluded.spent', (self.day(), s.reply_reservation_usd))
            self.db.execute('INSERT INTO reservations VALUES (?,?,?)', (sid, self.day(), s.reply_reservation_usd))
        return json.loads(row['history'])

    def finish(self, sid, result=None, *, cost_usd=None):
        with self.db:
            reservation = self.db.execute('SELECT * FROM reservations WHERE id=?', (sid,)).fetchone()
            if not reservation:
                return
            if result is not None or cost_usd is not None:
                cost = max(0, result['cost_usd'] if result is not None else cost_usd)
                self.db.execute('UPDATE budget SET spent=MAX(0,spent+?) WHERE day=?', (cost - reservation['amount'], reservation['day']))
            if result is not None:
                self.db.execute('UPDATE sessions SET history=?,tokens=?,turns=turns+1,touched=? WHERE id=?', (json.dumps(result['history']), result['tokens'], time.time(), sid))
            self.db.execute('DELETE FROM reservations WHERE id=?', (sid,))

    def reset(self, sid, access_token=None):
        self.get(sid)
        if not self.private_access(sid, access_token) and self.remaining(sid) <= 0:
            raise Denied('allowance_exhausted')
        with self.db:
            self.db.execute("UPDATE sessions SET history='[]',started=0,turns=0,tokens=0,touched=? WHERE id=?", (time.time(), sid))
