// js/ui/Notifications.js
// Two feedback channels: a transient toast for "you just did a thing", and a
// stacked notification feed for city problems and milestones. Notifications
// de-duplicate by id so a persistent problem never stacks up.

const MAX_VISIBLE = 4;
const NOTIFY_TTL_MS = 11000;

export class Notifications {
    constructor(feedEl, toastEl, audio) {
        this.feed = feedEl;
        this.toastEl = toastEl;
        this.audio = audio;
        this._items = new Map();      // id -> {el, expires}
        this._toastTimer = null;
        this._seq = 0;
    }

    toast(payload) {
        const { text, kind = 'info' } = typeof payload === 'string' ? { text: payload } : payload;
        if (!this.toastEl) return;
        this.toastEl.textContent = text;
        this.toastEl.className = `toast visible ${kind}`;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.toastEl.className = 'toast';
        }, 2100);
        if (kind === 'bad') this.audio?.playError();
    }

    notify({ id, icon = 'ℹ️', kind = 'info', title, body }) {
        const key = id ?? `n${this._seq++}`;
        const existing = this._items.get(key);
        if (existing) {
            existing.expires = performance.now() + NOTIFY_TTL_MS;
            existing.el.classList.remove('leaving');
            return;
        }

        const el = document.createElement('div');
        el.className = `notification ${kind}`;
        el.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-text">
                <strong>${escapeHtml(title)}</strong>
                ${body ? `<span>${escapeHtml(body)}</span>` : ''}
            </span>
            <button class="notification-close" aria-label="Dismiss">×</button>`;
        el.querySelector('.notification-close').addEventListener('click', () => this._dismiss(key));

        this.feed.appendChild(el);
        this._items.set(key, { el, expires: performance.now() + NOTIFY_TTL_MS });

        while (this._items.size > MAX_VISIBLE) {
            const oldest = this._items.keys().next().value;
            this._dismiss(oldest);
        }
        if (kind === 'good') this.audio?.playChime();
    }

    resolve(id) {
        if (this._items.has(id)) this._dismiss(id);
    }

    update() {
        const now = performance.now();
        for (const [key, item] of this._items) {
            if (item.expires <= now) this._dismiss(key);
        }
    }

    _dismiss(key) {
        const item = this._items.get(key);
        if (!item) return;
        this._items.delete(key);
        item.el.classList.add('leaving');
        setTimeout(() => item.el.remove(), 220);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}
