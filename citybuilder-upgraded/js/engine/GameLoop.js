// js/engine/GameLoop.js
// Thin requestAnimationFrame wrapper that hands out real delta-time (ms),
// clamped so a tab coming back from being backgrounded doesn't cause a huge
// simulation jump.

export class GameLoop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this._running = false;
        this._lastTime = 0;
        this._raf = this._tick.bind(this);
    }

    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        requestAnimationFrame(this._raf);
    }

    stop() {
        this._running = false;
    }

    _tick(now) {
        if (!this._running) return;
        let dt = now - this._lastTime;
        this._lastTime = now;
        dt = Math.min(dt, 100); // clamp huge jumps (tab switch, breakpoint, etc.)

        this.updateFn(dt);
        this.renderFn();

        requestAnimationFrame(this._raf);
    }
}
