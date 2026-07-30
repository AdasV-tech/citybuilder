// js/engine/InputHandler.js
// Turns pointer/keyboard/touch input into camera moves and tool callbacks in
// tile coordinates.
//
// Controls, deliberately close to what a Cities: Skylines player expects:
//   left drag           use the active tool (or select, when no tool is active)
//   right drag / MMB    pan       |  space + drag  pan
//   wheel               zoom at the cursor
//   WASD / arrows       pan       |  Esc  cancel tool  |  Space  pause
//   1-7                 open a toolbar category        |  B  bulldozer

import { ZOOM_STEP, KEY_PAN_SPEED } from '../utils/Constants.js';

export class InputHandler {
    constructor(canvas, camera, tools, hotkeys) {
        this.canvas = canvas;
        this.camera = camera;
        this.tools = tools;
        this.hotkeys = hotkeys;   // { onHotkey(key), onCancel(), onTogglePause() }

        this._dragging = false;
        this._panning = false;
        this._lastX = 0;
        this._lastY = 0;
        this._spaceHeld = false;
        this._keys = new Set();
        this._pinchDistance = 0;

        this._bind();
    }

    /** Keyboard panning, called once per frame from the game loop. */
    update(dtSeconds) {
        const keys = this._keys;
        if (keys.size === 0) return;
        let dx = 0, dy = 0;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
        if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
        if (dx === 0 && dy === 0) return;
        const speed = (KEY_PAN_SPEED * dtSeconds) / this.camera.zoom;
        this.camera.pan(dx * speed, dy * speed);
    }

    _bind() {
        const c = this.canvas;
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        c.addEventListener('wheel', this._onWheel, { passive: false });
        c.addEventListener('mouseleave', () => this.tools.onHoverExit?.());

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', () => this._keys.clear());

        c.addEventListener('touchstart', this._onTouchStart, { passive: false });
        c.addEventListener('touchmove', this._onTouchMove, { passive: false });
        c.addEventListener('touchend', this._onTouchEnd);
    }

    /** Client coords -> CSS pixels relative to the canvas. */
    _localPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    _tileAt(clientX, clientY) {
        const p = this._localPoint(clientX, clientY);
        return this.camera.screenToTile(p.x, p.y);
    }

    _onMouseDown = (e) => {
        this._lastX = e.clientX;
        this._lastY = e.clientY;

        if (e.button === 2 || e.button === 1 || this._spaceHeld) {
            this._panning = true;
            this.canvas.classList.add('grabbing');
            // A right-click while a tool is armed cancels it, like the real game.
            if (e.button === 2) this.hotkeys?.onCancel?.();
            return;
        }
        if (e.button === 0) {
            this._dragging = true;
            const tile = this._tileAt(e.clientX, e.clientY);
            this.tools.onToolDown(tile.x, tile.y, e);
        }
    };

    _onMouseMove = (e) => {
        if (this._panning) {
            this.camera.pan(
                -(e.clientX - this._lastX) / this.camera.zoom,
                -(e.clientY - this._lastY) / this.camera.zoom
            );
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            return;
        }
        const tile = this._tileAt(e.clientX, e.clientY);
        if (this._dragging) this.tools.onToolMove(tile.x, tile.y, e);
        else this.tools.onHover(tile.x, tile.y, e);
    };

    _onMouseUp = (e) => {
        if (this._dragging) {
            const tile = this._tileAt(e.clientX, e.clientY);
            this.tools.onToolUp(tile.x, tile.y, e);
        }
        this._dragging = false;
        this._panning = false;
        this.canvas.classList.remove('grabbing');
    };

    _onWheel = (e) => {
        e.preventDefault();
        const p = this._localPoint(e.clientX, e.clientY);
        this.camera.zoomAt(p.x, p.y, -e.deltaY * ZOOM_STEP);
    };

    _onKeyDown = (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        this._keys.add(e.code);

        if (e.code === 'Space') {
            this._spaceHeld = true;
            if (!e.repeat) { this.hotkeys?.onTogglePause?.(); e.preventDefault(); }
            return;
        }
        if (e.code === 'Escape') { this.hotkeys?.onCancel?.(); return; }
        if (!e.repeat) this.hotkeys?.onHotkey?.(e.key, e);
    };

    _onKeyUp = (e) => {
        this._keys.delete(e.code);
        if (e.code === 'Space') this._spaceHeld = false;
    };

    // --- touch: one finger uses the tool, two fingers pan and pinch-zoom -------

    _onTouchStart = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const t = e.touches[0];
            this._dragging = true;
            const tile = this._tileAt(t.clientX, t.clientY);
            this.tools.onToolDown(tile.x, tile.y, e);
            this._lastX = t.clientX; this._lastY = t.clientY;
        } else if (e.touches.length === 2) {
            this._dragging = false;
            this.tools.onCancelDrag?.();
            this._panning = true;
            this._pinchDistance = touchDistance(e.touches);
            const mid = touchMidpoint(e.touches);
            this._lastX = mid.x; this._lastY = mid.y;
        }
    };

    _onTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && this._dragging) {
            const t = e.touches[0];
            const tile = this._tileAt(t.clientX, t.clientY);
            this.tools.onToolMove(tile.x, tile.y, e);
            return;
        }
        if (e.touches.length === 2) {
            const mid = touchMidpoint(e.touches);
            this.camera.pan(
                -(mid.x - this._lastX) / this.camera.zoom,
                -(mid.y - this._lastY) / this.camera.zoom
            );
            this._lastX = mid.x; this._lastY = mid.y;

            const distance = touchDistance(e.touches);
            if (this._pinchDistance > 0) {
                const local = this._localPoint(mid.x, mid.y);
                this.camera.zoomAt(local.x, local.y, (distance - this._pinchDistance) * 0.006);
            }
            this._pinchDistance = distance;
        }
    };

    _onTouchEnd = (e) => {
        if (this._dragging && e.changedTouches.length > 0) {
            const t = e.changedTouches[0];
            const tile = this._tileAt(t.clientX, t.clientY);
            this.tools.onToolUp(tile.x, tile.y, e);
        }
        this._dragging = false;
        if (e.touches.length === 0) { this._panning = false; this._pinchDistance = 0; }
    };
}

function touchDistance(touches) {
    return Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
}

function touchMidpoint(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}
