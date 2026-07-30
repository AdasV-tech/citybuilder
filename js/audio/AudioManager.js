// js/audio/AudioManager.js
// Tiny WebAudio helper for UI sounds (click, save) and gentle ambient hum.

export class AudioManager {
    constructor() {
        this._ctx = null;
        this._master = null;
        this._ambientOsc = null;
    }

    _ensure() {
        if (this._ctx) return;
        try {
            const C = window.AudioContext || window.webkitAudioContext;
            this._ctx = new C();
            this._master = this._ctx.createGain();
            this._master.gain.value = 0.06;
            this._master.connect(this._ctx.destination);
        } catch (e) {
            // audio not available
            this._ctx = null;
        }
    }

    playClick() {
        this._ensure();
        if (!this._ctx) return;
        const o = this._ctx.createOscillator();
        const g = this._ctx.createGain();
        o.type = 'square';
        o.frequency.value = 880;
        g.gain.value = 0.0001;
        o.connect(g);
        g.connect(this._master);
        const now = this._ctx.currentTime;
        g.gain.linearRampToValueAtTime(0.06, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        o.start(now);
        o.stop(now + 0.15);
    }

    playSave() {
        this._ensure();
        if (!this._ctx) return;
        const now = this._ctx.currentTime;
        const o1 = this._ctx.createOscillator();
        const o2 = this._ctx.createOscillator();
        const g = this._ctx.createGain();
        o1.type = 'sine'; o2.type = 'triangle';
        o1.frequency.value = 660; o2.frequency.value = 880;
        o1.connect(g); o2.connect(g); g.connect(this._master);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        o1.start(now); o2.start(now);
        o1.stop(now + 0.32); o2.stop(now + 0.32);
    }
}
