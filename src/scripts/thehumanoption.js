import { micromark } from 'micromark';
import { gfm, gfmHtml } from 'micromark-extension-gfm';

(() => {
    const page = document.querySelector('.human-option');
    if (!page) return;
    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-message');
    const send = document.getElementById('chat-send');
    const reset = document.getElementById('chat-reset');
    const retry = document.getElementById('chat-retry');
    const status = document.getElementById('chat-status');
    const messages = document.getElementById('chat-messages');
    const remaining = document.getElementById('chat-remaining');
    const errors = {
        rate_limited: 'Too many messages. Try again later.',
        conversation_full: 'Conversation limit reached. Select New chat to start over.',
        budget_exhausted: 'Daily limit reached. Try again tomorrow.',
        off: 'Chat is offline.',
        unavailable: 'Chat is unavailable. Try again.',
        turnstile_required: 'Verification failed. Try again.',
    };
    const labels = {
        thinking: 'Thinking…', searching: 'Looking things up…',
        finding_images: 'Finding images…', calculating: 'Calculating…',
    };
    const markdownOptions = { extensions: [gfm()], htmlExtensions: [gfmHtml()] };
    let busy = false;
    let ready = false;
    let closed = false;
    let full = false;
    let exhausted = false;
    let sessionId;
    let scriptPromise;
    let widget;

    function controls() {
        input.disabled = busy || !ready || closed || full || exhausted;
        send.disabled = input.disabled || !input.value.trim();
        reset.disabled = busy || !ready || closed || exhausted;
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }

    function fail(code) {
        status.textContent = errors[code] || errors.unavailable;
        closed = code === 'off' || code === 'budget_exhausted';
        full = code === 'conversation_full';
        retry.hidden = full || code === 'rate_limited' || !page.dataset.siteKey;
        controls();
    }

    function updateRemaining(value) {
        if (!Number.isInteger(value)) return;
        remaining.textContent = `${value} message${value === 1 ? '' : 's'} left in this session`;
        if (value <= 0) {
            exhausted = true;
            status.textContent = 'Session message limit reached.';
        }
    }

    async function request(path, body) {
        const response = await fetch(`/api/chat${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? {} : {
                'Content-Type': 'application/json',
                ...(path === '/reset' && sessionId ? { 'X-Chat-Session': sessionId } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(response.status === 429 ? 'rate_limited' : data.code || 'unavailable');
        return data;
    }

    function loadTurnstile() {
        if (window.turnstile) return Promise.resolve();
        if (scriptPromise) return scriptPromise;
        scriptPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const timer = setTimeout(() => finish(false), 15000);
            function finish(ok) {
                clearTimeout(timer);
                if (ok) resolve();
                else {
                    script.remove();
                    scriptPromise = undefined;
                    reject(new Error('turnstile_required'));
                }
            }
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
            script.async = true;
            script.onload = () => finish(Boolean(window.turnstile));
            script.onerror = () => finish(false);
            document.head.append(script);
        });
        return scriptPromise;
    }

    async function openSession() {
        if (!page.dataset.siteKey) throw new Error('unavailable');
        status.textContent = 'Connecting…';
        await loadTurnstile();
        if (widget !== undefined) window.turnstile.remove(widget);
        const token = await new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('turnstile_required')), 120000);
            const finish = (value) => {
                clearTimeout(timer);
                if (value) resolve(value);
                else reject(new Error('turnstile_required'));
            };
            widget = window.turnstile.render('#chat-verification', {
                sitekey: page.dataset.siteKey, action: 'chat', theme: 'dark',
                appearance: 'interaction-only',
                callback: finish,
                'error-callback': () => { finish(null); return true; },
                'expired-callback': () => finish(null),
                'timeout-callback': () => finish(null),
            });
        });
        const data = await request('/session', { token });
        if (sessionId) messages.replaceChildren();
        sessionId = data.session_id;
        ready = true;
        full = false;
        exhausted = false;
        updateRemaining(data.remaining_messages);
    }

    async function initialize() {
        busy = true;
        closed = false;
        retry.hidden = true;
        controls();
        try {
            const data = await request('/status');
            if (data.status !== 'open') throw new Error(data.status === 'off' ? 'off' : 'budget_exhausted');
            if (!ready) await openSession();
            status.textContent = '';
        } catch (error) {
            fail(error.message);
        } finally {
            busy = false;
            controls();
        }
    }

    function addMessage(speaker, content) {
        const article = document.createElement('article');
        article.className = `chat-message ${speaker === 'You' ? 'chat-message-user' : 'chat-message-assistant'}`;
        article.setAttribute('aria-label', speaker === 'You' ? 'Your message' : 'Reply');
        const label = document.createElement('p');
        label.className = 'chat-speaker';
        label.textContent = speaker === 'You' ? speaker : 'Thinking…';
        if (speaker !== 'You') label.setAttribute('role', 'status');
        const text = document.createElement(speaker === 'You' ? 'p' : 'div');
        text.className = 'chat-text';
        text.textContent = content;
        article.append(label, text);
        messages.append(article);
        messages.scrollTop = messages.scrollHeight;
        return { article, text, label, source: content };
    }

    function safeUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
        } catch { return null; }
    }

    function externalLink(url, text) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        if (text) link.textContent = text;
        return link;
    }

    function renderReply(reply) {
        const template = document.createElement('template');
        template.innerHTML = micromark(reply.source, markdownOptions);
        for (const image of template.content.querySelectorAll('img')) {
            image.replaceWith(document.createTextNode(image.alt));
        }
        for (const link of template.content.querySelectorAll('a')) {
            const url = safeUrl(link.getAttribute('href'));
            if (!url) {
                link.replaceWith(...link.childNodes);
                continue;
            }
            const safeLink = externalLink(url);
            safeLink.append(...link.childNodes);
            link.replaceWith(safeLink);
        }
        reply.text.replaceChildren(template.content);
    }

    function addImages(article, items) {
        if (!Array.isArray(items)) return;
        const grid = document.createElement('div');
        grid.className = 'chat-images';
        for (const item of items.slice(0, 6)) {
            const source = safeUrl(item.source_url);
            const thumbnail = safeUrl(item.thumbnail || item.url);
            const license = safeUrl(item.license_url);
            if (!source || !thumbnail || !license || !item.creator || !item.license) continue;
            const figure = document.createElement('figure');
            const link = externalLink(source);
            const image = document.createElement('img');
            image.src = thumbnail;
            image.alt = item.title || 'Image';
            image.loading = 'lazy';
            image.referrerPolicy = 'no-referrer';
            link.append(image);
            const caption = document.createElement('figcaption');
            caption.append(document.createTextNode(`${item.title || 'Image'} — ${item.creator} · `), externalLink(license, item.license));
            figure.append(link, caption);
            grid.append(figure);
        }
        if (grid.children.length) article.append(grid);
    }

    async function readStream(response, reply) {
        if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('unavailable');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let ended = false;
        function event(block) {
            let type = 'message';
            const lines = [];
            for (const line of block.split(/\r?\n/)) {
                if (line.startsWith('event:')) type = line.slice(6).trim();
                if (line.startsWith('data:')) lines.push(line.slice(5).replace(/^ /, ''));
            }
            if (!lines.length) return;
            const data = JSON.parse(lines.join('\n'));
            const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
            if (type === 'error') throw new Error(data.code || 'unavailable');
            if (type === 'text') {
                reply.source += typeof data === 'string' ? data : data.text || '';
                renderReply(reply);
                reply.label.hidden = true;
            }
            if (type === 'status') {
                reply.label.textContent = labels[typeof data === 'string' ? data : data.label] || 'Thinking…';
                reply.label.hidden = false;
            }
            if (type === 'images') addImages(reply.article, data);
            if (type === 'done') {
                ended = true;
                reply.label.hidden = true;
                updateRemaining(data.remaining_messages);
            }
            if (follow) messages.scrollTop = messages.scrollHeight;
        }
        try {
            while (!ended) {
                const { value, done } = await reader.read();
                buffer += decoder.decode(value, { stream: !done });
                let boundary;
                while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
                    event(buffer.slice(0, boundary.index));
                    buffer = buffer.slice(boundary.index + boundary[0].length);
                }
                if (done) break;
            }
            if (!ended) throw new Error('unavailable');
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = input.value.trim();
        if (busy || !ready || closed || full || exhausted || !message) return;
        busy = true;
        retry.hidden = true;
        controls();
        status.textContent = '';
        let userMessage = addMessage('You', message);
        let reply = addMessage('Assistant', '');
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST', headers: {
                            'Content-Type': 'application/json', 'X-Chat-Session': sessionId,
                        },
                        body: JSON.stringify({ message }), credentials: 'same-origin',
                        signal: AbortSignal.timeout(270000),
                    });
                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(response.status === 429 ? 'rate_limited' : data.code || 'unavailable');
                    }
                    await readStream(response, reply);
                    input.value = '';
                    break;
                } catch (error) {
                    if (error.message !== 'turnstile_required' || attempt || reply.source) throw error;
                    ready = false;
                    await openSession();
                    messages.replaceChildren();
                    userMessage = addMessage('You', message);
                    reply = addMessage('Assistant', '');
                    reply.label.textContent = 'New chat started. Thinking…';
                    status.textContent = '';
                }
            }
        } catch (error) {
            fail(error.message);
            reply.label.hidden = true;
            if (reply.source) {
                const note = document.createElement('p');
                note.className = 'chat-speaker';
                note.textContent = 'This reply was interrupted.';
                reply.article.append(note);
            } else {
                reply.article.remove();
                userMessage.article.remove();
            }
        } finally {
            busy = false;
            controls();
            if (!input.disabled) input.focus();
        }
    });

    reset.addEventListener('click', async () => {
        if (busy || !ready) return;
        busy = true;
        controls();
        try {
            const data = await request('/reset', {});
            messages.replaceChildren();
            full = false;
            input.value = '';
            status.textContent = '';
            updateRemaining(data.remaining_messages);
            retry.hidden = true;
        } catch (error) {
            if (error.message === 'turnstile_required') ready = false;
            fail(error.message);
        } finally {
            busy = false;
            controls();
        }
    });
    input.addEventListener('input', controls);
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        if (!send.disabled) form.requestSubmit();
    });
    retry.addEventListener('click', initialize);
    initialize();
})();
