// js/utils/EventBus.js
// Minimal publish/subscribe hub so systems (UI, economy, save, etc.) don't need
// direct references to each other. Keeps the architecture loosely coupled.

export class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(eventName, callback) {
        if (!this._listeners.has(eventName)) {
            this._listeners.set(eventName, new Set());
        }
        this._listeners.get(eventName).add(callback);
        return () => this.off(eventName, callback);
    }

    off(eventName, callback) {
        const set = this._listeners.get(eventName);
        if (set) set.delete(callback);
    }

    emit(eventName, payload) {
        const set = this._listeners.get(eventName);
        if (!set) return;
        for (const cb of set) cb(payload);
    }
}

// A single shared bus is convenient for a project this size.
export const eventBus = new EventBus();
