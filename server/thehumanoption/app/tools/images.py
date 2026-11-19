import re
from html import unescape
from urllib.parse import urlparse

import httpx

from ..evaluation import record


def _text(value):
    return unescape(re.sub(r"<[^>]*>", "", str(value or "")))[:500]


def _url(value):
    value = str(value or "")
    parsed = urlparse(value)
    return value if parsed.scheme == "https" and parsed.hostname and not parsed.username else ""


async def find_images(query: str, limit: int = 6, *, api_key: str = "") -> list[dict]:
    query = query.strip()[:200]
    if not query:
        return []
    if not api_key:
        record("source_search_failed", "image_source", source="brave", reason="missing_api_key")
        return []
    limit = max(1, min(80, limit))
    record("source_search_started", "image_source", source="brave", query=query, limit=limit)
    images = []
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                "https://api.search.brave.com/res/v1/images/search",
                params={"q": query, "count": limit, "safesearch": "strict", "country": "ALL"},
                headers={"X-Subscription-Token": api_key, "Accept": "application/json"},
            )
            response.raise_for_status()
            for item in response.json().get("results", []):
                image = {
                    "url": _url((item.get("properties") or {}).get("url")),
                    "thumbnail": _url((item.get("thumbnail") or {}).get("src")),
                    "title": _text(item.get("title")), "creator": "",
                    "source": _text(item.get("source")),
                    "license": "", "license_url": "",
                    "source_url": _url(item.get("url")),
                }
                if all(image[key] for key in ("url", "thumbnail", "source_url")):
                    if not any(found["url"] == image["url"] for found in images):
                        images.append(image)
        record("source_search_finished", "image_source", source="brave", query=query,
               usable_count=len(images))
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as error:
        record("source_search_failed", "image_source", source="brave", query=query,
               error_type=type(error).__name__,
               status_code=error.response.status_code if isinstance(error, httpx.HTTPStatusError) else None)
    return images[:limit]
