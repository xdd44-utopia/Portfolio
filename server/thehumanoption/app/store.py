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
                id TEXT PRIMARY KEY, created REAL, touched REAL,
                messages INTEGER DEFAULT 0, turns INTEGER DEFAULT 0,
                tokens INTEGER DEFAULT 0, history TEXT DEFAULT '[]'
            );
            CREATE TABLE IF NOT EXISTS requests (ip TEXT, at REAL);
            CREATE INDEX IF NOT EXISTS requests_ip_at ON requests(ip, at);
            CREATE TABLE IF NOT EXISTS budget (day TEXT PRIMARY KEY, spent REAL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, day TEXT, amount REAL);
        ''')
        with self.db:
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

    def create(self, sid):
        self.cleanup()
        with self.db:
            self.db.execute('INSERT INTO sessions(id,created,touched) VALUES (?,?,?)', (sid, time.time(), time.time()))

    def reserve(self, sid, ip):
        s = self.settings
        now = time.time()
        with self.db:
            row = self.get(sid)
            status = self.status()
            if status != 'open':
                raise Denied('off' if status == 'off' else 'budget_exhausted')
            if row['messages'] >= s.session_messages:
                raise Denied('rate_limited')
            if row['turns'] >= s.max_turns or row['tokens'] >= s.max_conversation_tokens:
                raise Denied('conversation_full')
            counts = self.db.execute('SELECT COUNT(*) AS daily, SUM(at > ?) AS hourly FROM requests WHERE ip=? AND at > ?', (now - 3600, ip, now - 86400)).fetchone()
            if counts['daily'] >= s.ip_daily_messages or (counts['hourly'] or 0) >= s.ip_hourly_messages:
                raise Denied('rate_limited')
            self.db.execute('INSERT INTO requests VALUES (?,?)', (ip, now))
            self.db.execute('UPDATE sessions SET messages=messages+1,touched=? WHERE id=?', (now, sid))
            self.db.execute('INSERT INTO budget(day,spent) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET spent=spent+excluded.spent', (self.day(), s.reply_reservation_usd))
            self.db.execute('INSERT INTO reservations VALUES (?,?,?)', (sid, self.day(), s.reply_reservation_usd))
        return json.loads(row['history'])

    def finish(self, sid, result=None):
        with self.db:
            reservation = self.db.execute('SELECT * FROM reservations WHERE id=?', (sid,)).fetchone()
            if not reservation:
                return
            if result is not None:
                cost = max(0, result['cost_usd'])
                self.db.execute('UPDATE budget SET spent=MAX(0,spent+?) WHERE day=?', (cost - reservation['amount'], reservation['day']))
                self.db.execute('UPDATE sessions SET history=?,tokens=?,turns=turns+1,touched=? WHERE id=?', (json.dumps(result['history']), result['tokens'], time.time(), sid))
            self.db.execute('DELETE FROM reservations WHERE id=?', (sid,))

    def reset(self, sid):
        self.get(sid)
        with self.db:
            self.db.execute("UPDATE sessions SET history='[]',turns=0,tokens=0,touched=? WHERE id=?", (time.time(), sid))
