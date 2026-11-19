import httpx


async def validate(token, ip, settings):
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', data={
                'secret': settings.turnstile_secret, 'response': token, 'remoteip': ip,
            })
            response.raise_for_status()
            result = response.json()
        return bool(result.get('success')) and (
            not settings.production or (
                result.get('hostname') in settings.hostnames and result.get('action') == 'chat'
            )
        )
    except (httpx.HTTPError, ValueError):
        return False
