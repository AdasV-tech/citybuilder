// js/engine/GameLoop.js
// requestAnimationFrame driver with a clamped delta (so returning to a
// backgrounded tab doesn't fast-forward the city) and a rolling FPS average
// for the debug readout.

export class GameLoop {
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this._running = false;
        this._lastTime = 0;
        this._tick = this._tick.bind(this);
        this.fps = 60;
        this.frameMs = 16.7;
    }

    start() {
        if (this._running) return;
        this._running = true;
        this._lastTime = performance.now();
        requestAnimationFrame(this._tick);
    }

    stop() { this._running = false; }

    _tick(now) {
        if (!this._running) return;
        let dt = now - this._lastTime;
        this._lastTime = now;
        if (dt > 100) dt = 100;

        const started = performance.now();
        this.updateFn(dt);
        this.renderFn(dt);
        this.frameMs += (performance.now() - started - this.frameMs) * 0.1;
        this.fps += (1000 / Math.max(1, dt) - this.fps) * 0.05;

        requestAnimationFrame(this._tick);
    }
}
