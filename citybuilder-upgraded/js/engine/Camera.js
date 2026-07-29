// js/engine/Camera.js
// Top-down only (no rotation) camera with smoothed pan and zoom, as required
// by the brief. Positions are stored in "world pixels" (tile coords * TILE_SIZE).

import { TILE_SIZE, ZOOM_MIN, ZOOM_MAX } from '../utils/Constants.js';
import { clamp, lerp } from '../utils/MathUtils.js';

export class Camera {
    constructor(canvas, mapWidthTiles, mapHeightTiles) {
        this.canvas = canvas;
        this.mapWidth = mapWidthTiles * TILE_SIZE;
        this.mapHeight = mapHeightTiles * TILE_SIZE;

        // Current (rendered) state
        this.x = this.mapWidth / 2;
        this.y = this.mapHeight / 2;
        this.zoom = 0.9;

        // Target state we smoothly interpolate toward
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetZoom = this.zoom;

        this.smoothing = 10; // higher = snappier
    }

    pan(dxWorld, dyWorld) {
        this.targetX += dxWorld;
        this.targetY += dyWorld;
        this._clampTarget();
    }

    /** Zoom toward a specific screen point so the point under the cursor stays put. */
    zoomAt(screenX, screenY, deltaZoom) {
        const before = this.screenToWorld(screenX, screenY);
        this.targetZoom = clamp(this.targetZoom + deltaZoom, ZOOM_MIN, ZOOM_MAX);
        // apply immediately to target position so the zoom feels anchored
        const after = this.screenToWorld(screenX, screenY, this.targetZoom, this.targetX, this.targetY);
        this.targetX += (before.x - after.x);
        this.targetY += (before.y - after.y);
        this._clampTarget();
    }

    _clampTarget() {
        const halfW = (this.canvas.width / this.targetZoom) / 2;
        const halfH = (this.canvas.height / this.targetZoom) / 2;
        const margin = TILE_SIZE * 6; // let the player scroll a bit past the edge
        this.targetX = clamp(this.targetX, -margin + halfW, this.mapWidth + margin - halfW);
        this.targetY = clamp(this.targetY, -margin + halfH, this.mapHeight + margin - halfH);
    }

    update(dtSeconds) {
        const t = clamp(this.smoothing * dtSeconds, 0, 1);
        this.x = lerp(this.x, this.targetX, t);
        this.y = lerp(this.y, this.targetY, t);
        this.zoom = lerp(this.zoom, this.targetZoom, t);
    }

    /** Convert a screen-space point (canvas px) to world-space (px), given optional overrides. */
    screenToWorld(sx, sy, zoom = this.zoom, cx = this.x, cy = this.y) {
        const wx = (sx - this.canvas.width / 2) / zoom + cx;
        const wy = (sy - this.canvas.height / 2) / zoom + cy;
        return { x: wx, y: wy };
    }

    worldToScreen(wx, wy) {
        const sx = (wx - this.x) * this.zoom + this.canvas.width / 2;
        const sy = (wy - this.y) * this.zoom + this.canvas.height / 2;
        return { x: sx, y: sy };
    }

    worldToTile(wx, wy) {
        return { x: Math.floor(wx / TILE_SIZE), y: Math.floor(wy / TILE_SIZE) };
    }

    screenToTile(sx, sy) {
        const world = this.screenToWorld(sx, sy);
        return this.worldToTile(world.x, world.y);
    }
}
