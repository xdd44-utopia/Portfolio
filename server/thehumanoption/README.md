# The Human Option

The Human Option is a standalone art experiment temporarily hosted at `/thehumanoption`, separate from the portfolio's design and navigation. Astro serves the page and proxies `/api` to this Python service during development. Production nginx proxies the same routes to port 8787 on the VM.

## Try it locally

Install [uv](https://docs.astral.sh/uv/getting-started/installation/) and use the Node version in the repository README. The backend requires Python 3.12+, but your system Python can stay at 3.11: the commands below install a separate Python through uv.

For first-time setup, run these commands from the repository root (`Portfolio`). Skip any copy whose destination already exists so you keep your configured keys and prompt:

```sh
cp .env.example .env
cp server/thehumanoption/.env.example server/thehumanoption/.env
cp server/thehumanoption/prompt.example.md server/thehumanoption/prompt.md
python3 -c 'import secrets; print(secrets.token_hex(32))'
```

Put the generated value in `SESSION_SIGNING_KEY` in **`server/thehumanoption/.env`**. Add your `OPENAI_API_KEY` there. OpenAI is the primary provider and needs an API account with available credit or quota. Claude fallback also needs a funded Anthropic API account; a key alone is not enough. You can leave `ANTHROPIC_API_KEY` empty until it is funded and run with OpenAI alone. Optional Openverse credentials also belong in this file. Edit **`server/thehumanoption/prompt.md`** for the private prompt. Both files are ignored by Git. Never put private keys or the real prompt in an Astro page, a `PUBLIC_` variable, or an example file.

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
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8787
```

Leave that terminal running. In terminal 2, start from the repository root:

```sh
npm ci
npm run dev
```

Open **http://localhost:4321/thehumanoption**. If Astro reports another port, update `ALLOWED_ORIGINS` in the backend `.env` to match and restart the backend. The dev proxy handles `/api`; do not open the backend port as the chat page. Keep the backend at one worker. On later starts, you only need the two run commands unless dependencies have changed.

After changing the backend `.env` or `prompt.md`, stop terminal 1's server with Ctrl+C and rerun the `uv run uvicorn ...` command. `--reload` watches Python code, so do not rely on it for environment or prompt changes. After changing the root `.env`, stop terminal 2's server and rerun `npm run dev`.

### Common local setup problems

| What you see | What to check |
| --- | --- |
| `No pyproject.toml found` | Run `uv sync` and `uv run` from `server/thehumanoption`, not the repository root. |
| Your system reports Python 3.11 | Use `uv python install 3.12` and `uv sync --python 3.12 --frozen` above; no system Python replacement is needed. |
| “We could not open the door just yet” | Turnstile verification failed. Check the matching local test keys above, restart both servers after changing them, and make sure Cloudflare is reachable. |
| “The conversation cannot continue just now” after sending | The reply failed or the service is busy. Confirm the backend's provider keys and API credits/quota. An unfunded Claude account cannot provide fallback replies. This message can also indicate a provider outage or request error. |
| Closed for today after failed attempts | Failed replies can retain budget reservations. The local ledger survives restarts; resetting the conversation does not reset the daily budget. See the budget behavior below. |

### Conversation and budget behavior

On startup, the backend deletes the saved sessions and transcripts from earlier versions. It keeps the spending and IP rate-limit records.

A new tab starts a new conversation and replaces the shared session cookie. If you return to an older tab, it detects that change, renews its session, and visibly starts fresh so conversations do not get mixed. Reset clears the current conversation without restoring the session's message allowance. Sessions and conversation history are held only in server memory and expire after the configured session or idle period. Restarting the backend clears them, so existing tabs start fresh on their next message. Spending and IP rate-limit records remain in SQLite across restarts. The default limits and budget are in the backend `.env.example`; model names and price settings must be kept in sync when changing providers or models.

Before each reply, the backend reserves $1.50 of the daily budget. A successful reply is reconciled against the configured token and search prices; failed, interrupted, or fallback replies may retain the full reservation. The piece closes for the day when the remaining balance cannot cover another reservation, which can happen before exactly $5 has been spent. Provider billing caps are independent of this application budget; provider-managed search context makes the reservation an estimate, not a guaranteed billing ceiling.

OpenAI is tried first when its key is configured; Claude is the fallback. Fallback happens only before reply text appears. If a provider fails after streaming starts, the page marks the reply as interrupted so text from different attempts is not joined together.

Known limitation: a failure in OpenAI's preliminary token-count request does not trigger Claude fallback in the current library integration. The OpenAI adapter removes the generation-only tool-limit parameter from that preliminary request while retaining it for reply generation.

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
sudoedit /etc/thehumanoption/env
sudoedit /etc/thehumanoption/prompt.md
```

Populate `/etc/thehumanoption/env` from `.env.example`, supplying real provider credentials, a newly generated signing key, a real Turnstile secret, and these production values:

```dotenv
APP_ENV=production
PROMPT_PATH=/etc/thehumanoption/prompt.md
DATABASE_PATH=/var/lib/thehumanoption/chat.sqlite
OFF_PATH=/etc/thehumanoption/OFF
ALLOWED_ORIGINS=https://xdd44.xyz,https://www.xdd44.xyz
TURNSTILE_HOSTNAMES=xdd44.xyz,www.xdd44.xyz
DAILY_BUDGET_USD=5
```

The private prompt belongs only in `/etc/thehumanoption/prompt.md`. Keep secrets out of shell history and CI. Review limits and provider account spending controls before allowing public traffic. The application budget does not replace provider billing controls.

In Cloudflare, choose **Turnstile → Add widget**, name it `The Human Option`, add hostnames `xdd44.xyz` and `www.xdd44.xyz` without a protocol or path, select **Managed**, and leave pre-clearance off. Create the widget to obtain its matching site key and secret key.

| Production value | Where it goes |
| --- | --- |
| Public Turnstile site key | GitHub **Settings → Secrets and variables → Actions → Variables → New repository variable**, named `PUBLIC_TURNSTILE_SITE_KEY` |
| Turnstile secret key | `TURNSTILE_SECRET` in `/etc/thehumanoption/env` on the VM |
| OpenAI and optional Anthropic API keys, session signing key | Their corresponding settings in `/etc/thehumanoption/env` on the VM |

The GitHub repository variable is passed to the website build as an environment variable; it is not a GitHub environment-scoped variable or a secret. Never put the Turnstile secret in a `PUBLIC_` variable. Local test credentials are not production credentials. Redeploy the website after changing its production site key, and restart the backend after changing its secret.

Upload the backend directory to `/opt/thehumanoption` without `.env`, `prompt.md`, `.venv`, caches, or SQLite files. Install dependencies as the deployment user:

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

Inspect service failures with `sudo journalctl -u thehumanoption.service`. The service disables HTTP access logs; the existing nginx access-log policy still applies. Never enable request-body or model debug logging with real conversations.
