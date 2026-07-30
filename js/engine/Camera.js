// js/engine/Camera.js
// Top-down camera with smoothed pan/zoom. Everything the camera exposes is in
// CSS pixels (the coordinate space DOM events arrive in); device-pixel-ratio is
// applied once, by the renderer, when it builds the canvas transform. Mixing
// those two spaces is the classic source of "my clicks are offset on a HiDPI
// screen" bugs, so they are kept strictly apart here.

import { TILE_SIZE, ZOOM_MIN, ZOOM_MAX, CAMERA_SMOOTHING } from '../utils/Constants.js';
import { clamp, lerp } from '../utils/MathUtils.js';

export class Camera {
    constructor(mapWidthTiles, mapHeightTiles) {
        this.mapWidth = mapWidthTiles * TILE_SIZE;
        this.mapHeight = mapHeightTiles * TILE_SIZE;

        this.viewWidth = 1;   // CSS px
        this.viewHeight = 1;
        this.dpr = 1;

        this.x = this.mapWidth / 2;
        this.y = this.mapHeight / 2;
        this.zoom = 1;

        this.targetX = this.x;
        this.targetY = this.y;
        this.targetZoom = this.zoom;
    }

    resize(viewWidth, viewHeight, dpr) {
        this.viewWidth = viewWidth;
        this.viewHeight = viewHeight;
        this.dpr = dpr;
        this._clampTarget();
    }

    centerOnTile(tileX, tileY, zoom) {
        this.targetX = this.x = (tileX + 0.5) * TILE_SIZE;
        this.targetY = this.y = (tileY + 0.5) * TILE_SIZE;
        if (zoom) this.targetZoom = this.zoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
        this._clampTarget();
    }

    /** Pan by a delta expressed in world pixels. */
    pan(dxWorld, dyWorld) {
        this.targetX += dxWorld;
        this.targetY += dyWorld;
        this._clampTarget();
    }

    /** Zoom anchored on a screen point, so the tile under the cursor stays put. */
    zoomAt(screenX, screenY, deltaZoom) {
        const before = this.screenToWorld(screenX, screenY);
        this.targetZoom = clamp(this.targetZoom * (1 + deltaZoom), ZOOM_MIN, ZOOM_MAX);
        const after = this.screenToWorld(screenX, screenY, this.targetZoom, this.targetX, this.targetY);
        this.targetX += before.x - after.x;
        this.targetY += before.y - after.y;
        this._clampTarget();
    }

    setZoom(zoom) {
        this.targetZoom = clamp(zoom, ZOOM_MIN, ZOOM_MAX);
        this._clampTarget();
    }

    _clampTarget() {
        const margin = TILE_SIZE * 8;
        const halfW = this.viewWidth / this.targetZoom / 2;
        const halfH = this.viewHeight / this.targetZoom / 2;
        this.targetX = clamp(this.targetX, -margin + halfW, this.mapWidth + margin - halfW);
        this.targetY = clamp(this.targetY, -margin + halfH, this.mapHeight + margin - halfH);
    }

    update(dtSeconds) {
        const t = clamp(CAMERA_SMOOTHING * dtSeconds, 0, 1);
        this.x = lerp(this.x, this.targetX, t);
        this.y = lerp(this.y, this.targetY, t);
        this.zoom = lerp(this.zoom, this.targetZoom, t);
    }

    screenToWorld(sx, sy, zoom = this.zoom, cx = this.x, cy = this.y) {
        return {
            x: (sx - this.viewWidth / 2) / zoom + cx,
            y: (sy - this.viewHeight / 2) / zoom + cy
        };
    }

    worldToScreen(wx, wy) {
        return {
            x: (wx - this.x) * this.zoom + this.viewWidth / 2,
            y: (wy - this.y) * this.zoom + this.viewHeight / 2
        };
    }

    screenToTile(sx, sy) {
        const world = this.screenToWorld(sx, sy);
        return { x: Math.floor(world.x / TILE_SIZE), y: Math.floor(world.y / TILE_SIZE) };
    }

    tileToScreen(tileX, tileY) {
        return this.worldToScreen(tileX * TILE_SIZE, tileY * TILE_SIZE);
    }
}
