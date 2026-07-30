// js/audio/AudioManager.js
// Small WebAudio blip generator for UI and construction feedback. No asset
// files, no autoplay warnings: the context is created lazily on the first user
// gesture and every sound is a short synthesised envelope.

export class AudioManager {
    constructor() {
        this._ctx = null;
        this._master = null;
        this.muted = false;
        this._lastPlay = 0;
    }

    setMuted(muted) {
        this.muted = muted;
        if (this._master) this._master.gain.value = muted ? 0 : 0.07;
    }

    toggleMute() {
        this.setMuted(!this.muted);
        return this.muted;
    }

    _ensure() {
        if (this._ctx) return this._ctx;
        try {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            this._ctx = new Ctor();
            this._master = this._ctx.createGain();
            this._master.gain.value = this.muted ? 0 : 0.07;
            this._master.connect(this._ctx.destination);
        } catch {
            this._ctx = null;
        }
        return this._ctx;
    }

    /** @param {{type?, freq, to?, duration?, gain?}} spec */
    _tone({ type = 'sine', freq, to, duration = 0.12, gain = 0.6 }) {
        if (this.muted) return;
        const ctx = this._ensure();
        if (!ctx) return;
        // Rate-limit so dragging a long road doesn't machine-gun the speakers.
        const now = ctx.currentTime;
        if (now - this._lastPlay < 0.045) return;
        this._lastPlay = now;

        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (to) osc.frequency.exponentialRampToValueAtTime(to, now + duration);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(gain, now + 0.012);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(env);
        env.connect(this._master);
        osc.start(now);
        osc.stop(now + duration + 0.02);
    }

    playClick() { this._tone({ type: 'triangle', freq: 660, duration: 0.07, gain: 0.35 }); }
    playOpen() { this._tone({ type: 'sine', freq: 420, to: 720, duration: 0.12, gain: 0.4 }); }
    playBuild() { this._tone({ type: 'square', freq: 320, to: 200, duration: 0.09, gain: 0.3 }); }
    playZone() { this._tone({ type: 'sine', freq: 520, to: 660, duration: 0.08, gain: 0.3 }); }
    playBulldoze() { this._tone({ type: 'sawtooth', freq: 180, to: 90, duration: 0.14, gain: 0.32 }); }
    playSave() { this._tone({ type: 'sine', freq: 720, to: 1080, duration: 0.2, gain: 0.4 }); }
    playError() { this._tone({ type: 'square', freq: 200, to: 140, duration: 0.16, gain: 0.3 }); }
    playChime() { this._tone({ type: 'sine', freq: 880, to: 1320, duration: 0.3, gain: 0.45 }); }
}
