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
    const lastMessage = document.getElementById('chat-last-message');
    const accessDialog = document.getElementById('chat-access');
    const accessForm = document.getElementById('chat-access-form');
    const accessKey = document.getElementById('chat-access-key');
    const accessStatus = document.getElementById('chat-access-status');
    const photoPanel = document.getElementById('chat-photos');
    const photoStage = document.getElementById('chat-photo-stage');
    const gallery = document.getElementById('chat-gallery');
    const layout = document.querySelector('.chat-layout');
    const errors = {
        rate_limited: 'Too many messages. Try again later.',
        conversation_full: 'Conversation limit reached. Select New chat to start over.',
        budget_exhausted: 'Daily limit reached. Try again tomorrow.',
        off: 'Chat is offline.',
        unavailable: 'Chat is unavailable. Try again.',
        turnstile_required: 'Verification failed. Try again.',
        allowance_exhausted: 'Browser chat allowance used up.',
        invalid_access_key: 'Access key not accepted.',
        access_required: 'Private access expired. Enter your key again.',
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
    let remainingChats;
    let remainingReplies;
    let sessionId;
    let accessToken;
    let scriptPromise;
    let widget;
    let photoTurn;

    function controls() {
        input.disabled = busy || !ready || closed || full || exhausted;
        send.disabled = input.disabled || !input.value.trim();
        reset.disabled = busy || !ready || closed || remainingChats === 0;
        lastMessage.hidden = busy || !ready || closed || full || exhausted || remainingReplies !== 1;
        input.setAttribute('aria-describedby', lastMessage.hidden ? 'chat-hint' : 'chat-hint chat-last-message');
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
    }

    function fail(code) {
        status.textContent = code === 'conversation_full' && remainingChats === 0
            ? errors.allowance_exhausted : errors[code] || errors.unavailable;
        closed = code === 'off' || code === 'budget_exhausted';
        full = code === 'conversation_full';
        if (code === 'allowance_exhausted') updateUsage({ remaining_chats: 0, chat_started: false, remaining_replies: remainingReplies });
        if (code === 'access_required') {
            accessToken = undefined;
            ready = false;
        }
        retry.hidden = full || (exhausted && ready) || code === 'rate_limited' || !page.dataset.siteKey;
        controls();
    }

    function updateUsage(data) {
        const value = data.remaining_chats;
        if (value !== null && !Number.isInteger(value)) return;
        remainingChats = value;
        remainingReplies = data.remaining_replies;
        full = Number.isInteger(remainingReplies) && remainingReplies <= 0;
        if (value === null) {
            exhausted = false;
            remaining.textContent = 'Private access · browser allowance paused';
            return;
        }
        remaining.textContent = `${value} new chat${value === 1 ? '' : 's'} left for this browser`;
        exhausted = value <= 0 && !data.chat_started;
        if (exhausted) status.textContent = errors.allowance_exhausted;
        else if (full) status.textContent = value === 0 ? errors.allowance_exhausted : errors.conversation_full;
    }

    async function request(path, body) {
        const response = await fetch(`/api/chat${path}`, {
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? {} : {
                'Content-Type': 'application/json',
                ...(sessionId ? { 'X-Chat-Session': sessionId } : {}),
                ...(accessToken ? { 'X-Chat-Access': accessToken } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(15000),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.code || (response.status === 429 ? 'rate_limited' : 'unavailable'));
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
        clearPhotos();
        if (sessionId) messages.replaceChildren();
        sessionId = data.session_id;
        accessToken = undefined;
        ready = true;
        full = false;
        exhausted = false;
        updateUsage(data);
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
            if (!exhausted) status.textContent = '';
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
            if (!source || !thumbnail) continue;
            const figure = document.createElement('figure');
            const link = externalLink(source);
            const image = document.createElement('img');
            image.src = thumbnail;
            image.alt = item.title || 'Image';
            image.loading = 'lazy';
            image.referrerPolicy = 'no-referrer';
            link.append(image);
            const caption = document.createElement('figcaption');
            caption.append(document.createTextNode(`${item.title || 'Image'}${item.creator ? ` — ${item.creator}` : ''} · `),
                externalLink(source, item.source || new URL(source).hostname));
            if (license && item.license) caption.append(document.createTextNode(' · '), externalLink(license, item.license));
            figure.append(link, caption);
            grid.append(figure);
        }
        if (grid.children.length) article.append(grid);
    }

    function clearPhotos() {
        if (photoTurn) {
            photoTurn.cancelled = true;
            photoTurn.controller.abort();
            clearTimeout(photoTurn.timer);
            for (const cancel of photoTurn.loads) cancel();
            photoTurn.resolve();
        }
        photoTurn = undefined;
        photoPanel.hidden = true;
        gallery.classList.remove('is-visible');
        photoStage.replaceChildren();
        gallery.replaceChildren();
        layout.classList.remove('has-photos');
    }

    function startPhotos(reply) {
        clearPhotos();
        const turn = {
            reply, photos: [], loads: new Set(), index: -1, boundary: 0, boundaryAt: 0,
            visibleAt: 0, answerDone: false, photosDone: false, streamDone: false,
            cancelled: false, complete: false, controller: new AbortController(),
        };
        turn.finished = new Promise((resolve) => { turn.resolve = resolve; });
        photoTurn = turn;
        return turn;
    }

    function showPhoto(turn, index) {
        if (turn !== photoTurn || turn.cancelled) return;
        const photo = turn.photos[index];
        if (!photo?.loaded) return;
        const previous = photoStage.querySelector('.chat-photo:not(.chat-photo-leave)');
        const figure = document.createElement('figure');
        figure.className = 'chat-photo';
        const link = externalLink(photo.source);
        link.append(photo.image);
        const caption = document.createElement('figcaption');
        caption.append(document.createTextNode(`${photo.item.title || 'Photograph'}${photo.item.creator ? ` — ${photo.item.creator}` : ''} · `),
            externalLink(photo.source, photo.item.source || new URL(photo.source).hostname));
        if (photo.license && photo.item.license) caption.append(document.createTextNode(' · '), externalLink(photo.license, photo.item.license));
        figure.append(link, caption);
        if (previous) {
            for (const leaving of photoStage.querySelectorAll('.chat-photo-leave')) leaving.remove();
            previous.classList.add('chat-photo-leave');
            previous.setAttribute('aria-hidden', 'true');
            previous.inert = true;
            previous.addEventListener('animationend', () => previous.remove(), { once: true });
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) previous.remove();
            figure.classList.add('chat-photo-enter');
        }
        photoStage.append(figure);
        photoPanel.hidden = false;
        layout.classList.add('has-photos');
        turn.index = index;
        turn.visibleAt = performance.now() + (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400);
        for (const button of gallery.children) button.setAttribute('aria-current', String(Number(button.dataset.index) === index));
    }

    function advancePhotos(turn) {
        if (turn !== photoTurn || turn.cancelled || turn.complete) return;
        clearTimeout(turn.timer);
        if (document.hidden) {
            turn.hiddenAt ??= performance.now();
            return;
        }
        const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
        let next = turn.index + 1;
        while (turn.photos[next]?.failed) next++;
        if (turn.index < 0 && turn.photos[next]?.loaded && (turn.reply.source || turn.answerDone)) showPhoto(turn, next);
        const noneAvailable = turn.photosDone && !turn.loads.size && !turn.photos.some((photo) => photo.loaded);
        if (turn.index >= 0 || noneAvailable) {
            turn.reply.label.hidden = Boolean(turn.reply.source);
            if (turn.rendered !== turn.reply.source) {
                renderReply(turn.reply);
                turn.rendered = turn.reply.source;
                if (follow) messages.scrollTop = messages.scrollHeight;
            }
        }
        const elapsed = performance.now() - turn.visibleAt;
        next = turn.index + 1;
        while (turn.photos[next]?.failed) next++;
        if (turn.index >= 0 && elapsed >= 3000 && turn.photos[next]?.loaded
            && (turn.answerDone || turn.boundaryAt >= turn.visibleAt + 3000 || elapsed >= 4000)) {
            showPhoto(turn, next);
        }
        const noMore = turn.photosDone && !turn.loads.size && next >= turn.photos.length;
        if (turn.streamDone && turn.answerDone && noMore && (noneAvailable || elapsed >= 3000)) {
            turn.complete = true;
            turn.reply.label.hidden = true;
            if (noneAvailable) {
                const note = document.createElement('p');
                note.className = 'chat-speaker';
                note.textContent = 'Photos unavailable for this reply.';
                turn.reply.article.append(note);
            } else {
                gallery.replaceChildren();
                turn.photos.forEach((photo, index) => {
                    if (!photo.loaded) return;
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.dataset.index = index;
                    button.setAttribute('aria-label', `Show photo ${gallery.children.length + 1}: ${photo.item.title || 'Photograph'}`);
                    button.setAttribute('aria-current', String(index === turn.index));
                    button.addEventListener('click', () => { if (turn.complete && index !== turn.index) showPhoto(turn, index); });
                    gallery.append(button);
                });
                gallery.classList.toggle('is-visible', gallery.children.length > 1);
            }
            if (follow) messages.scrollTop = messages.scrollHeight;
            turn.resolve();
            return;
        }
        turn.timer = setTimeout(() => advancePhotos(turn), 100);
    }

    function receivePhoto(turn, item) {
        if (turn.photos.length >= 5 || turn.photosDone || turn.cancelled) return;
        const source = safeUrl(item.source_url);
        const url = safeUrl(item.thumbnail || item.url);
        const license = safeUrl(item.license_url);
        if (!source || !url
            || turn.photos.some((photo) => photo.source === source || photo.image.src === url)) return;
        const image = new Image();
        image.alt = item.title || 'Photograph';
        image.referrerPolicy = 'no-referrer';
        const photo = { item, source, license, image, loaded: false, failed: false };
        turn.photos.push(photo);
        const finish = (loaded) => {
            clearTimeout(timer);
            image.onload = image.onerror = null;
            turn.loads.delete(cancel);
            if (turn !== photoTurn || turn.cancelled) return;
            photo.loaded = loaded;
            photo.failed = !loaded;
            advancePhotos(turn);
        };
        const cancel = () => { finish(false); image.removeAttribute('src'); };
        const timer = setTimeout(cancel, 12000);
        turn.loads.add(cancel);
        image.onload = () => finish(image.naturalWidth > 0);
        image.onerror = () => finish(false);
        image.src = url;
    }

    async function readStream(response, reply, turn) {
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
            if (turn !== photoTurn || turn.cancelled) return;
            if (data.turn_id) {
                if (turn.id && turn.id !== data.turn_id) return;
                turn.id = data.turn_id;
            }
            const follow = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 80;
            if (type === 'error') {
                updateUsage(data);
                throw new Error(data.code || 'unavailable');
            }
            if (type === 'text') {
                reply.source += typeof data === 'string' ? data : data.text || '';
                const boundary = (reply.source.match(/[.!?](?:["')\]]*)\s|\n\s*\n/g) || []).length;
                if (boundary > turn.boundary) turn.boundaryAt = performance.now();
                turn.boundary = boundary;
                advancePhotos(turn);
            }
            if (type === 'status') {
                reply.label.textContent = labels[typeof data === 'string' ? data : data.label] || 'Thinking…';
                reply.label.hidden = false;
            }
            if (type === 'images') addImages(reply.article, data.images || data);
            if (type === 'photo') receivePhoto(turn, data);
            if (type === 'photos_done') turn.photosDone = true;
            if (type === 'answer_done') {
                turn.answerDone = true;
            }
            if (type === 'done') {
                ended = true;
                turn.streamDone = true;
                turn.answerDone = true;
                turn.photosDone = true;
                updateUsage(data);
            }
            advancePhotos(turn);
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
            await turn.finished;
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
        input.value = '';
        retry.hidden = true;
        controls();
        status.textContent = '';
        let userMessage = addMessage('You', message);
        let reply = addMessage('Assistant', '');
        let turn = startPhotos(reply);
        try {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const response = await fetch('/api/chat', {
                        method: 'POST', headers: {
                            'Content-Type': 'application/json', 'X-Chat-Session': sessionId,
                            ...(accessToken ? { 'X-Chat-Access': accessToken } : {}),
                        },
                        body: JSON.stringify({ message }), credentials: 'same-origin',
                        signal: AbortSignal.any([turn.controller.signal, AbortSignal.timeout(270000)]),
                    });
                    if (!response.ok) {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.code || (response.status === 429 ? 'rate_limited' : 'unavailable'));
                    }
                    await readStream(response, reply, turn);
                    break;
                } catch (error) {
                    if (error.message !== 'turnstile_required' || attempt || reply.source) throw error;
                    ready = false;
                    await openSession();
                    messages.replaceChildren();
                    userMessage = addMessage('You', message);
                    reply = addMessage('Assistant', '');
                    turn = startPhotos(reply);
                    reply.label.textContent = 'New chat started. Thinking…';
                    status.textContent = '';
                }
            }
        } catch (error) {
            if (turn.cancelled) return;
            turn.answerDone = true;
            turn.photosDone = true;
            turn.streamDone = true;
            advancePhotos(turn);
            await turn.finished;
            fail(error.message);
            reply.label.hidden = true;
            if (reply.source) {
                const note = document.createElement('p');
                note.className = 'chat-speaker';
                note.textContent = 'This reply was interrupted.';
                reply.article.append(note);
            } else {
                input.value = message;
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
            clearPhotos();
            messages.replaceChildren();
            full = false;
            input.value = '';
            status.textContent = '';
            updateUsage(data);
            retry.hidden = true;
        } catch (error) {
            if (error.message === 'turnstile_required') ready = false;
            fail(error.message);
        } finally {
            busy = false;
            controls();
        }
    });
    function showAccess() {
        if (busy || !ready || closed || accessDialog.open) return;
        accessStatus.textContent = '';
        accessDialog.showModal();
        accessKey.focus();
    }
    document.querySelector('.chat-heading h1').addEventListener('dblclick', showAccess);
    document.addEventListener('keydown', (event) => {
        if (event.altKey && event.shiftKey && event.code === 'KeyU' && !event.repeat) {
            event.preventDefault();
            showAccess();
        }
    });
    document.getElementById('chat-access-cancel').addEventListener('click', () => accessDialog.close());
    accessDialog.addEventListener('close', () => { accessKey.value = ''; });
    accessForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (busy || !ready || !accessKey.value.trim()) return;
        busy = true;
        controls();
        const key = accessKey.value.trim();
        accessKey.value = '';
        accessStatus.textContent = 'Unlocking…';
        try {
            const data = await request('/unlock', { key });
            accessToken = data.access_token;
            full = false;
            updateUsage(data);
            status.textContent = '';
            retry.hidden = true;
            accessDialog.close();
        } catch (error) {
            accessStatus.textContent = errors[error.message] || errors.unavailable;
            if (error.message === 'turnstile_required') {
                ready = false;
                fail(error.message);
                accessDialog.close();
            }
        } finally {
            busy = false;
            controls();
            if (accessDialog.open) accessKey.focus();
            else if (!input.disabled) input.focus();
        }
    });
    input.addEventListener('input', controls);
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        if (!send.disabled) form.requestSubmit();
    });
    retry.addEventListener('click', initialize);
    document.addEventListener('visibilitychange', () => {
        const turn = photoTurn;
        if (!turn || turn.complete) return;
        if (document.hidden) turn.hiddenAt ??= performance.now();
        else if (turn.hiddenAt !== undefined) {
            turn.visibleAt += performance.now() - turn.hiddenAt;
            turn.hiddenAt = undefined;
        }
        advancePhotos(turn);
    });
    window.addEventListener('pagehide', clearPhotos);
    initialize();
})();
