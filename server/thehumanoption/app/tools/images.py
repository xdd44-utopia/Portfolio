import re
from html import unescape
from urllib.parse import urlparse

import httpx


def _text(value):
    return unescape(re.sub(r"<[^>]*>", "", str(value or "")))[:500]


def _url(value):
    value = str(value or "")
    parsed = urlparse(value)
    return value if parsed.scheme == "https" and parsed.hostname and not parsed.username else ""


def _image(url, thumbnail, title, creator, license_name, license_url, source_url):
    image = {
        "url": _url(url), "thumbnail": _url(thumbnail), "title": _text(title),
        "creator": _text(creator) or "Creator not listed", "license": _text(license_name),
        "license_url": _url(license_url), "source_url": _url(source_url),
    }
    return image if all(image[key] for key in ("url", "thumbnail", "license", "license_url", "source_url")) else None


async def find_images(query: str, limit: int = 6, *, client_id: str = "", client_secret: str = "") -> list[dict]:
    query = query.strip()[:200]
    if not query:
        return []
    limit = max(1, min(6, limit))
    async with httpx.AsyncClient(timeout=12, headers={"User-Agent": "TheHumanOption/0.1 (https://xdd44.xyz/thehumanoption)"}) as client:
        try:
            headers = {}
            if client_id and client_secret:
                token = await client.post("https://api.openverse.org/v1/auth_tokens/token/", data={
                    "grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret,
                })
                token.raise_for_status()
                headers["Authorization"] = f"Bearer {token.json()['access_token']}"
            response = await client.get("https://api.openverse.org/v1/images/", params={"q": query, "page_size": limit, "mature": "false"}, headers=headers)
            response.raise_for_status()
            images = []
            for item in response.json().get("results", [])[:limit]:
                image = _image(item.get("url"), item.get("thumbnail"), item.get("title"), item.get("creator"),
                               f"{item.get('license', '')} {item.get('license_version', '')}".strip(), item.get("license_url"), item.get("foreign_landing_url"))
                if image:
                    images.append(image)
            if images:
                return images
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            pass
        try:
            response = await client.get("https://commons.wikimedia.org/w/api.php", params={
                "action": "query", "format": "json", "generator": "search", "gsrsearch": query,
                "gsrnamespace": 6, "gsrlimit": limit, "prop": "imageinfo",
                "iiprop": "url|extmetadata", "iiurlwidth": 600,
            })
            response.raise_for_status()
            images = []
            for page in response.json().get("query", {}).get("pages", {}).values():
                info = page.get("imageinfo", [{}])[0]
                metadata = info.get("extmetadata", {})
                value = lambda name: metadata.get(name, {}).get("value", "")
                license_url = value("LicenseUrl")
                if license_url.startswith("//"):
                    license_url = "https:" + license_url
                image = _image(info.get("url"), info.get("thumburl"), page.get("title"), value("Artist"),
                               value("LicenseShortName"), license_url, info.get("descriptionurl"))
                if image:
                    images.append(image)
            return images[:limit]
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            return []
