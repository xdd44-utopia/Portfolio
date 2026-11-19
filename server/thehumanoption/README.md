# The Human Option

The Human Option is a standalone art experiment temporarily hosted at `/thehumanoption`, separate from the portfolio's design and navigation. Astro serves the page and proxies `/api` to this Python service during development. Production nginx proxies the same routes to port 8787 on the VM.

## Try it locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and use the Node version in the repository README. The backend requires Python 3.12+, but your system Python can stay at 3.11: the commands below install a separate Python through uv.

For first-time setup, run these commands from the repository root (`Portfolio`). Each copy below preserves any existing file:

```sh
test -e .env || cp .env.example .env
test -e server/thehumanoption/.env || cp server/thehumanoption/.env.example server/thehumanoption/.env
test -e server/thehumanoption/prompt.md || cp server/thehumanoption/prompt.example.md server/thehumanoption/prompt.md
mkdir -p server/thehumanoption/prompts
test -e server/thehumanoption/prompts/theme.md || cp server/thehumanoption/theme.example.md server/thehumanoption/prompts/theme.md
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

Put the generated value in `SESSION_SIGNING_KEY` in **`server/thehumanoption/.env`**. Configure funded OpenAI and Anthropic API accounts there. The theme normally uses Claude Opus; the worker uses GPT Sol and the photo inspector uses GPT Terra. Each role has an independent cross-provider fallback, so either provider can also run the piece alone. Set `BRAVE_SEARCH_API_KEY` to a Brave Search API subscription token with Image Search access. Preserve **`server/thehumanoption/prompt.md`** as the ordinary worker requirements and privately author **`server/thehumanoption/prompts/theme.md`** as the theme instructions. Both prompt paths and `.env` are ignored by Git. Never put private keys or real prompts in an Astro page, a `PUBLIC_` variable, or an example file.

Keep these matching Cloudflare test values for local development:

| File | Setting |
| --- | --- |
| Repository-root `.env` | `PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA` |
| `server/thehumanoption/.env` | `TURNSTILE_SECRET=1x0000000000000000000000000000000AA` |

The root `.env` supplies the public key to the local website; the backend `.env` holds the secret. A production widget registered for `xdd44.xyz` does not automatically allow `localhost`. Do not mix a test site key with a production secret or vice versa. The test widget still needs network access to Cloudflare; AI replies use your real provider keys and incur charges.

In terminal 1, start from the repository root and enter the backend folder. This is where `pyproject.toml` lives:

```sh
cd server/thehumanoption
uv python install 3.12
uv sync --python 3.12 --frozen
uv run --frozen uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
```

Leave that terminal running. In terminal 2, start from the repository root:

```sh
npm ci
npm run dev
```

Open **http://localhost:4321/thehumanoption**. If Astro reports another port, update `ALLOWED_ORIGINS` in the backend `.env` to match and restart the backend. The dev proxy handles `/api`; do not open the backend port as the chat page. Keep the backend at one worker. On later starts, you only need the two run commands unless dependencies have changed.

After changing the backend `.env`, `prompt.md`, or `prompts/theme.md`, stop terminal 1's server with Ctrl+C and rerun the `uv run --frozen uvicorn ...` command. `--reload` watches Python code, so do not rely on it for environment or prompt changes. After changing the root `.env`, stop terminal 2's server and rerun `npm run dev`.

For an existing local checkout upgrading to the photo flow, preserve your current keys and `prompt.md`, ensure `prompts/theme.md` exists, run `uv sync --frozen` from this backend folder to install Pillow, and restart the backend. `THEME_PROMPT_PATH` defaults to `prompts/theme.md`. The new role settings have defaults, so you do not need to replace your `.env`. Legacy `OPENAI_MODEL`, `ANTHROPIC_MODEL`, provider-wide token prices, and `MAX_REQUESTS` / `MAX_INPUT_TOKENS` / `MAX_OUTPUT_TOKENS` are no longer used; use the role-specific and model-specific settings in `.env.example` for overrides.

### Common local setup problems

Photo discovery uses Brave Image Search across the web. The theme chooses 1–5 aspects and assigns each a photo quota, with at most five photos total. Each aspect finder requests sixteen candidates per requested photo and inspects at most eight usable previews per requested photo in batches of at most eight, stopping when its quota is met. That permits at most 40 inspected previews across the turn; downloads, duplicates, provider limits, or insufficient results can reduce that number. Finders run sequentially and share the photo role's request and token limits. Captions link to the source website; photographer credits and license links appear only when supplied. Search results do not establish reuse permission. Without `BRAVE_SEARCH_API_KEY`, replies still work but photos are unavailable; evaluation logs record `missing_api_key`. Set the key in the backend `.env` locally and `/etc/thehumanoption/env` in production, then restart the backend. Existing Openverse settings are no longer used. Brave API charges are separate from the model budget ledger.

| What you see | What to check |
| --- | --- |
| `No pyproject.toml found` | Run `uv sync` and `uv run` from `server/thehumanoption`, not the repository root. |
| Your system reports Python 3.11 | Use `uv python install 3.12` and `uv sync --python 3.12 --frozen` above; no system Python replacement is needed. |
| Backend fails with missing `prompts/theme.md` | Create the private theme file or set `THEME_PROMPT_PATH` to its actual location, then restart. |
| Backend cannot import `PIL` | Run `uv sync --frozen` in `server/thehumanoption` to install the locked Pillow dependency. |
| “We could not open the door just yet” | Turnstile verification failed. Check the matching local test keys above, restart both servers after changing them, and make sure Cloudflare is reachable. |
| “The conversation cannot continue just now” after sending | The reply failed or the service is busy. Confirm the backend's provider keys and API credits/quota. An unfunded Claude account cannot provide fallback replies. This message can also indicate a provider outage or request error. |
| Closed for today after failed attempts | Failed replies can retain budget reservations. The local ledger survives restarts; resetting the conversation does not reset the daily budget. See the budget behavior below. |

### Conversation and budget behavior

On startup, the backend deletes saved sessions and transcripts from the legacy database tables. It keeps browser allowances, spending, IP rate-limit records, and the separate private evaluation logs described below.

A new tab starts a new conversation and replaces the shared session cookie. If you return to an older tab, it detects that change, renews its session, and visibly starts fresh so conversations do not get mixed. Active sessions and model conversation history are held in server memory and expire after one hour by default. Restarting the backend clears them, so existing tabs start fresh on their next message. Evaluation logs retain separate copies of conversation text across resets and restarts until rotation removes them.

Each browser has a separate signed, HttpOnly cookie linked to a chat counter in SQLite. `BROWSER_SESSIONS` defaults to 10. A chat consumes one allowance when its first public message is accepted, even if that reply later fails. Opening or refreshing the page and selecting New chat do not consume an allowance until a message is accepted. Later messages in the same chat do not consume more allowances, and the tenth chat can finish even when no new chats remain. Each public chat allows five successful replies; after the fourth reply, a chip above the input warns that one message remains. Failed replies do not consume a reply turn.

The browser allowance has no scheduled renewal. Changing networks and restarting the backend do not restore it. The cookie's 400-day lifetime is refreshed when a new chat session is opened; clearing or losing that cookie, using a different browser, or using private browsing can create a new allowance. Existing message counters are retained but no longer used; on the first startup after this change, existing browsers start with ten chats. `BROWSER_MESSAGES` and `SESSION_MESSAGES` no longer configure the allowance. IP throttling allows 50 accepted messages per rolling hour and 500 per rolling 24 hours, including private messages and replies that later fail. The default limits and budget are in the backend `.env.example`; model names and price settings must be kept in sync when changing providers or models.

Before each reply, the backend reserves the greater of `REPLY_RESERVATION_USD` and the computed allowance for all three roles, including fallback prices and native search context. The $1.50 setting is a floor, not the three-agent allowance. The $10 daily policy is unchanged and resets at midnight in America/Los_Angeles. Known usage is reconciled by model; attempts with unknown usage retain a conservative allowance. Disconnects retain the reservation. The piece closes when the remaining balance cannot cover another reservation. Provider billing controls remain independent.

The theme returns private per-turn worker and photo instructions. The original user message stays intact. Worker and photo retrieval then run concurrently. Photo candidates are visually inspected, deduplicated, and attributed; previews and rejected candidates are not stored in the conversation. The first loaded photo appears with answer text, followed by automatic slides at least three seconds apart. The gallery and composer unlock only after the answer and visible photo sequence finish. Missing or broken photos produce a smaller gallery or an unavailable state. Worker-requested images remain beneath the answer.

Each role permits one provider switch within its shared request/token limits, including preliminary token-count failures. Once worker text has streamed, a failure marks it interrupted instead of joining a second provider's answer. A failed theme permits ordinary chat without a thematic photo run. Reset, session renewal, and disconnect cancel outstanding work.

Role limits and model-specific price overrides are listed in `.env.example`. Prices use standard service rates checked against [OpenAI pricing](https://developers.openai.com/api/docs/pricing) and [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing) on November 19, 2026. Recheck prices when changing models. The token and vision limits are initial tuning values; live quality, latency, and cost measurements are needed before production tuning.

### Private access on the chat page

Press **Alt+Shift+U** or double-click the page title to open the access-key dialog. A valid key bypasses the browser allowance and conversation turn cap, and hides the last-message chip. Private messages do not consume the browser allowance. Conversation-size limits, IP throttling, the daily spending budget, and the off switch still apply. The temporary access token stays only in page memory; refresh, session renewal, or a backend restart locks the page again. For example, starting one public chat, unlocking, sending more messages, and refreshing shows nine new chats remaining. New chat keeps the current page's unlock but clears conversation history.

Generate a separate random key for each person from a trusted terminal:

```sh
python3 - <<'PY'
import hashlib
import secrets
key = secrets.token_urlsafe(32)
print('Give this key privately to the person:', key)
print('Add this hash to PRIVATE_ACCESS_KEY_HASHES:', hashlib.sha256(key.encode()).hexdigest())
PY
```

Put only the generated SHA-256 hashes in `PRIVATE_ACCESS_KEY_HASHES` in the backend `.env` (or `/etc/thehumanoption/env` in production), separated by commas, then restart the backend. An empty setting disables private access. Keep the actual keys out of source, URLs, frontend environment variables, and logs. Removing a person's hash and restarting revokes their key and clears active unlocks. Unlock requests require a verified chat session. There is no unlock-specific attempt cap or key-length cap; the general request-body limit and any installed nginx request limits still apply.

## Upgrading an existing deployment

Before pushing the photo-flow changes to `master`, use an administrator login on the VM to provision the new private prompt. Preserve the existing worker prompt and environment values:

```sh
sudo test -e /etc/thehumanoption/theme.md || sudo install -o root -g thehumanoption -m 640 /dev/null /etc/thehumanoption/theme.md
sudoedit /etc/thehumanoption/theme.md
sudoedit /etc/thehumanoption/env
```

Put the privately authored theme instructions in `theme.md`, and add this setting to the existing environment file:

```dotenv
THEME_PROMPT_PATH=/etc/thehumanoption/theme.md
```

The theme file must be nonempty and readable by the service user. An example prompt is only a generic setup aid; provision the actual private theme separately. Startup requires both private prompts. Keep the server's existing `DAILY_BUDGET_USD`; the new combined reservation is calculated automatically (about $1.69 with default role limits and prices).

Confirm the configured API accounts can use the new role models. New role/model settings have defaults; migrate any intentional legacy model, token-limit, or price overrides using `.env.example`, without replacing secrets. No new GitHub secrets, nginx rules, or systemd settings are required for this feature on an already configured VM. The existing 300-second nginx read timeout covers the backend's 240-second turn timeout.

After this private provisioning, the normal deployment uploads the code, installs the locked dependencies including Pillow with `uv sync --frozen --no-dev`, restarts the backend, and checks `/api/chat/status`. CI excludes `.env`, `prompt.md`, and `prompts/`; it does not create `/etc/thehumanoption/theme.md` or update `/etc/thehumanoption/env`. Deploy the frontend changes too, using the existing website job.

## VM setup

No VM setup or deployment is performed by adding these files. Use an administrator login for initial setup. Install system Python 3.12, `rsync` with `/usr/bin/rrsync`, and `uv` at `/usr/local/bin/uv`. The system Python is necessary because the service cannot read Python installations under home directories.

Create separate service and deployment users:

```sh
sudo useradd --system --home /var/lib/thehumanoption --shell /usr/sbin/nologin thehumanoption
sudo useradd --create-home --shell /bin/sh thehumanoption-deploy
sudo install -d -o thehumanoption-deploy -g thehumanoption -m 755 /opt/thehumanoption
sudo install -d -o thehumanoption -g thehumanoption -m 700 /var/lib/thehumanoption
sudo install -d -o root -g thehumanoption -m 750 /etc/thehumanoption
sudo install -o root -g thehumanoption -m 640 /dev/null /etc/thehumanoption/env
sudo install -o root -g thehumanoption -m 640 /dev/null /etc/thehumanoption/prompt.md
sudo install -o root -g thehumanoption -m 640 /dev/null /etc/thehumanoption/theme.md
sudoedit /etc/thehumanoption/env
sudoedit /etc/thehumanoption/prompt.md
sudoedit /etc/thehumanoption/theme.md
```

Populate `/etc/thehumanoption/env` from `.env.example`, supplying real provider credentials, a newly generated signing key, a real Turnstile secret, and these production values:

```dotenv
APP_ENV=production
PROMPT_PATH=/etc/thehumanoption/prompt.md
THEME_PROMPT_PATH=/etc/thehumanoption/theme.md
DATABASE_PATH=/var/lib/thehumanoption/chat.sqlite
OFF_PATH=/etc/thehumanoption/OFF
ALLOWED_ORIGINS=https://xdd44.xyz,https://www.xdd44.xyz
TURNSTILE_HOSTNAMES=xdd44.xyz,www.xdd44.xyz
DAILY_BUDGET_USD=5
```

Production private prompts belong in `/etc/thehumanoption/prompt.md` and `/etc/thehumanoption/theme.md`, provisioned privately before restarting the service. Both are loaded and validated at startup. Generated downstream prompts apply to one turn and are also recorded in private evaluation logs when enabled. Keep secrets out of shell history and CI. Review limits and provider account spending controls before allowing public traffic. The application budget does not replace provider billing controls.

In Cloudflare, choose **Turnstile → Add widget**, name it `The Human Option`, add hostnames `xdd44.xyz` and `www.xdd44.xyz` without a protocol or path, select **Managed**, and leave pre-clearance off. Create the widget to obtain its matching site key and secret key.

| Production value | Where it goes |
| --- | --- |
| Public Turnstile site key | GitHub **Settings → Secrets and variables → Actions → Variables → New repository variable**, named `PUBLIC_TURNSTILE_SITE_KEY` |
| Turnstile secret key | `TURNSTILE_SECRET` in `/etc/thehumanoption/env` on the VM |
| OpenAI and optional Anthropic API keys, session signing key | Their corresponding settings in `/etc/thehumanoption/env` on the VM |

The GitHub repository variable is passed to the website build as an environment variable; it is not a GitHub environment-scoped variable or a secret. Never put the Turnstile secret in a `PUBLIC_` variable. Local test credentials are not production credentials. Redeploy the website after changing its production site key, and restart the backend after changing its secret.

Upload the backend directory to `/opt/thehumanoption` without `.env`, `prompt.md`, `prompts/`, `.venv`, caches, or SQLite files. CI excludes the private prompt directory. Install dependencies as the deployment user:

```sh
sudo -u thehumanoption-deploy sh -c 'cd /opt/thehumanoption && UV_PYTHON=python3.12 UV_PYTHON_DOWNLOADS=never /usr/local/bin/uv sync --frozen --no-dev'
sudo install -o root -g root -m 644 /opt/thehumanoption/deploy/thehumanoption.service /etc/systemd/system/thehumanoption.service
sudo systemctl daemon-reload
sudo systemctl enable --now thehumanoption.service
curl --fail http://127.0.0.1:8787/api/chat/status
```

Keep port 8787 closed to the internet. Copy the additions from the repository's `nginx_default.conf` into the active nginx configuration: the two `limit_*_zone` directives belong in the `http` context, and the `/api/chat` location belongs in the existing HTTPS server. `deploy/nginx-snippet.conf` illustrates those contexts; it is not an additional standalone virtual host to enable. Then run `sudo nginx -t` before reloading nginx.

nginx overwrites `X-Real-IP` with the connection's actual address. If a CDN or Cloudflare proxy is enabled later, configure trusted proxy address ranges in nginx before relying on IP limits.

## Restricted CI deployment

Use a separate SSH key and the `thehumanoption-deploy` account, leaving the existing static-site deploy login alone. As an administrator, install the forced-command dispatcher:

```sh
sudo install -o root -g root -m 755 /opt/thehumanoption/deploy/ssh-command.sh /usr/local/sbin/thehumanoption-deploy
```

Add the public key to that user's `~/.ssh/authorized_keys` with this prefix:

```text
restrict,command="/usr/local/sbin/thehumanoption-deploy" ssh-ed25519 REPLACE_WITH_PUBLIC_KEY
```

The dispatcher accepts only rsync uploads rooted at `/opt/thehumanoption`, dependency synchronization, and restart. It must remain root-owned outside the writable application folder. Add this exact sudoers rule using `sudo visudo -f /etc/sudoers.d/thehumanoption-deploy`:

```text
thehumanoption-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart thehumanoption.service
```

Set GitHub repository **secrets** `BACKEND_DEPLOY_USER=thehumanoption-deploy` and `BACKEND_DEPLOY_SSH_KEY` to the matching private key. The backend reuses `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS`. Provider credentials and the prompt never go into GitHub Actions.

The backend job runs for pushes to `master` that change `server/thehumanoption/`, or on a manual workflow run. It uploads source, runs `uv sync --frozen --no-dev`, restarts the service, and checks `/api/chat/status`. Changes to the systemd unit, dispatcher, nginx configuration, or secrets still require an administrator to install them; CI cannot edit those system files. Do not push this setup before provisioning the VM and secrets.

## Operations

To close the piece immediately, run `sudo touch /etc/thehumanoption/OFF`. To reopen, remove that file. No restart is needed for the switch. Changes to keys, the prompt, or other environment settings require `sudo systemctl restart thehumanoption.service`.

Inspect service failures with `sudo journalctl -u thehumanoption.service`. The service disables HTTP access logs; the existing nginx access-log policy still applies. Use the dedicated evaluation logs below instead of provider SDK debug logging, which can expose credentials and opaque request data.

### Private run evaluation

Evaluation logging is enabled by default for this experiment in both local development and production. It adds no browser events or UI. Restart the backend after updating code or logging settings.

| Environment | Default log file |
| --- | --- |
| Local, backend working directory | `server/thehumanoption/evaluation/runs.jsonl` relative to the repository root |
| Production (`APP_ENV=production`) | `/var/lib/thehumanoption/evaluation/runs.jsonl` |

Each line is one JSON event with a UTC `timestamp`, `turn_id`, elapsed seconds, agent `role`, event name, and event data. The same turn ID ties together parallel activity. The log includes the full prior public conversation and current message, generated worker/photo prompts, scene queries, tool calls/results, candidate metadata, preview failures, selected-photo evidence notes, model attempts/fallbacks, token/cache usage, costs, and the final answer (including partial answers on cancellation). It records observable decisions and outputs, not hidden chain-of-thought, raw model-message dumps, provider reasoning signatures, static private prompt files, or preview image bytes. No extra model calls are made for logging.

Follow local runs in another terminal from the repository root:

```sh
tail -F server/thehumanoption/evaluation/runs.jsonl
```

On the VM:

```sh
sudo tail -F /var/lib/thehumanoption/evaluation/runs.jsonl
```

`theme_plan` shows the generated instructions. `request_started`, `request_finished`, `request_failed`, and `fallback_selected` explain each agent's attempts. `photo_search_results`, `preview_failed`, `inspection_choices`, and `photo_selected` explain image selection. `generation_finished` summarizes usage and server-side first-pair readiness; it does not measure browser image-load or display time. `turn_finished` reports success, error, timeout, or cancellation and the answer text. Estimated usage is marked separately when a provider's actual usage is unavailable. A process kill or machine failure can leave a run without a final event.

Configuration belongs in the backend `.env` locally or `/etc/thehumanoption/env` in production:

```dotenv
EVALUATION_LOGGING=true
EVALUATION_LOG_MAX_BYTES=10000000
EVALUATION_LOG_BACKUPS=5
```

The log rotates at approximately 10 MB to `runs.jsonl.1` through `.5`, keeping roughly 60 MB in total. Rotation is size-based, not age-based; an individual event can take a file over the threshold. Set `EVALUATION_LOGGING=false` to stop future recording; existing files remain until removed or rotated. You can override `EVALUATION_LOG_PATH` with an absolute file path in a private directory. Leave it unset to use the environment-specific defaults. In production, keep it under `/var/lib/thehumanoption/` so the existing service sandbox permits writes.

The backend creates the log directory with mode `700` and log files with mode `600`. An existing directory must already be private; startup reports an error otherwise. Local evaluation directories are ignored by Git and excluded from deployment uploads. Production logs remain outside the checkout, and no external telemetry service receives them. Disk/serialization failures produce a content-free warning in the terminal or journal without stopping chat or affecting spending reconciliation. Full-content logs contain private conversation and generated prompt text; keep downloaded copies private too.
