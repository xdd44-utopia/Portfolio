import hashlib
import hmac
import secrets


COOKIE = 'tho_session'
BROWSER_COOKIE = 'tho_browser'


def sign(value, key):
    digest = hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()
    return f'{value}.{digest}'


def verify(cookie, key):
    if not cookie or len(cookie) > 200:
        return None
    value, separator, _ = cookie.partition('.')
    if not separator or not hmac.compare_digest(cookie.encode(), sign(value, key).encode()):
        return None
    return value


def new_id():
    return secrets.token_urlsafe(32)


def ip_hash(ip, key):
    return hmac.new(key.encode(), ip.encode(), hashlib.sha256).hexdigest()
