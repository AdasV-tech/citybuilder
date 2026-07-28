// js/engine/InputHandler.js
// Translates raw DOM mouse/touch/keyboard events into camera pan/zoom calls
// and tool callbacks (onToolDown/Move/Up) expressed in tile coordinates.
// Left mouse button drives the active tool; right mouse button (or space+drag)
// always pans the camera, regardless of the active tool.

import { ZOOM_STEP } from '../utils/Constants.js';

export class InputHandler {
    constructor(canvas, camera, toolController) {
        this.canvas = canvas;
        this.camera = camera;
        this.tools = toolController;

        this._dragging = false;
        this._panning = false;
        this._lastX = 0;
        this._lastY = 0;
        this._spaceHeld = false;

        this._bind();
    }

    _bind() {
        const c = this.canvas;
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('mousedown', this._onMouseDown.bind(this));
        window.addEventListener('mousemove', this._onMouseMove.bind(this));
        window.addEventListener('mouseup', this._onMouseUp.bind(this));
        c.addEventListener('wheel', this._onWheel.bind(this), { passive: false });

        window.addEventListener('keydown', e => { if (e.code === 'Space') this._spaceHeld = true; });
        window.addEventListener('keyup', e => { if (e.code === 'Space') this._spaceHeld = false; });

        // Basic touch support: one-finger drag pans, tap acts as a click.
        c.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: false });
        c.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
        c.addEventListener('touchend', this._onTouchEnd.bind(this));
    }

    _rectPoint(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (clientX - rect.left) * (this.canvas.width / rect.width),
            y: (clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    _onMouseDown(e) {
        const p = this._rectPoint(e.clientX, e.clientY);
        const isPan = e.button === 2 || this._spaceHeld;
        this._lastX = e.clientX;
        this._lastY = e.clientY;

        if (isPan) {
            this._panning = true;
            return;
        }
        if (e.button === 0) {
            this._dragging = true;
            const tile = this.camera.screenToTile(p.x, p.y);
            this.tools.onToolDown(tile.x, tile.y, e);
        }
    }

    _onMouseMove(e) {
        if (this._panning) {
            const dx = (e.clientX - this._lastX) / this.camera.zoom;
            const dy = (e.clientY - this._lastY) / this.camera.zoom;
            this.camera.pan(-dx, -dy);
            this._lastX = e.clientX;
            this._lastY = e.clientY;
            return;
        }
        if (this._dragging) {
            const p = this._rectPoint(e.clientX, e.clientY);
            const tile = this.camera.screenToTile(p.x, p.y);
            this.tools.onToolMove(tile.x, tile.y, e);
        } else {
            const p = this._rectPoint(e.clientX, e.clientY);
            const tile = this.camera.screenToTile(p.x, p.y);
            this.tools.onToolHover?.(tile.x, tile.y, e);
        }
    }

    _onMouseUp(e) {
        if (this._dragging) {
            const p = this._rectPoint(e.clientX, e.clientY);
            const tile = this.camera.screenToTile(p.x, p.y);
            this.tools.onToolUp(tile.x, tile.y, e);
        }
        this._dragging = false;
        this._panning = false;
    }

    _onWheel(e) {
        e.preventDefault();
        const p = this._rectPoint(e.clientX, e.clientY);
        this.camera.zoomAt(p.x, p.y, -e.deltaY * ZOOM_STEP);
    }

    // --- touch (single finger = pan+tap; kept intentionally simple) ---
    _onTouchStart(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        this._lastX = t.clientX; this._lastY = t.clientY;
        this._touchMoved = false;
        this._touchStartClient = { x: t.clientX, y: t.clientY };
    }

    _onTouchMove(e) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = (t.clientX - this._lastX) / this.camera.zoom;
        const dy = (t.clientY - this._lastY) / this.camera.zoom;
        if (Math.abs(t.clientX - this._touchStartClient.x) > 6 || Math.abs(t.clientY - this._touchStartClient.y) > 6) {
            this._touchMoved = true;
        }
        this.camera.pan(-dx, -dy);
        this._lastX = t.clientX; this._lastY = t.clientY;
    }

    _onTouchEnd(e) {
        if (!this._touchMoved && this._touchStartClient) {
            const p = this._rectPoint(this._touchStartClient.x, this._touchStartClient.y);
            const tile = this.camera.screenToTile(p.x, p.y);
            this.tools.onToolDown(tile.x, tile.y, {});
            this.tools.onToolUp(tile.x, tile.y, {});
        }
        this._touchStartClient = null;
    }
}
