// js/rendering/Renderer.js
// Draw order: terrain -> zones/utilities -> roads -> buildings -> cars ->
// night tint -> data view -> preview/selection.
//
// Two performance ideas do most of the work here:
//
//  1. Ground layers (terrain, zone paint, pipes, roads) are baked into 16x16
//     tile chunk canvases and blitted. A chunk is only redrawn when a tile
//     inside it changes, so panning across a finished city costs a handful of
//     drawImage calls instead of thousands of fills.
//  2. Above zoom ~1.3 the cache is bypassed and tiles are drawn directly —
//     few tiles are visible up close, and it keeps everything pixel sharp.

import { TILE_SIZE, CHUNK_TILES, COLORS } from '../utils/Constants.js';
import { drawTerrainTile, drawZoneTint, drawUtilityTile } from './MapRenderer.js';
import { drawRoadTile } from './RoadRenderer.js';
import { drawBuildings } from './BuildingRenderer.js';
import { drawCars } from './CarRenderer.js';
import { drawDataView, drawPreview, drawHover, drawSelection } from './OverlayRenderer.js';

const CHUNK_PX = CHUNK_TILES * TILE_SIZE;
const DIRECT_DRAW_ZOOM = 1.3;
const MAX_CACHED_CHUNKS = 48;

export class Renderer {
    constructor(ctx, canvas, camera, cityMap) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.camera = camera;
        this.map = cityMap;

        this.chunksX = Math.ceil(cityMap.width / CHUNK_TILES);
        this.chunksY = Math.ceil(cityMap.height / CHUNK_TILES);
        this._chunks = new Map();      // chunkIndex -> {canvas, ctx, dirty, lastUsed}
        this._structureScratch = new Set();
        this._frame = 0;
        this.stats = { chunkRedraws: 0, drawnChunks: 0, drawnTiles: 0 };
    }

    /** Point the renderer at a freshly generated map and drop every cache. */
    setMap(cityMap) {
        this.map = cityMap;
        this.chunksX = Math.ceil(cityMap.width / CHUNK_TILES);
        this.chunksY = Math.ceil(cityMap.height / CHUNK_TILES);
        this._chunks.clear();
    }

    /** Mark the chunk containing a tile as needing a redraw. */
    invalidateTile(x, y) {
        const cx = (x / CHUNK_TILES) | 0, cy = (y / CHUNK_TILES) | 0;
        const chunk = this._chunks.get(cy * this.chunksX + cx);
        if (chunk) chunk.dirty = true;
    }

    invalidateArea(x, y, w = 1, h = 1) {
        for (let ty = y; ty < y + h; ty += 1) {
            for (let tx = x; tx < x + w; tx += 1) this.invalidateTile(tx, ty);
        }
    }

    invalidateAll() {
        for (const chunk of this._chunks.values()) chunk.dirty = true;
    }

    /** Visible tile range, padded so lifted sprites don't pop at the edges. */
    getVisibleBounds() {
        const cam = this.camera;
        const topLeft = cam.screenToTile(0, 0);
        const bottomRight = cam.screenToTile(cam.viewWidth, cam.viewHeight);
        return {
            minX: Math.max(0, topLeft.x - 1),
            minY: Math.max(0, topLeft.y - 2),
            maxX: Math.min(this.map.width - 1, bottomRight.x + 1),
            maxY: Math.min(this.map.height - 1, bottomRight.y + 2)
        };
    }

    render(state) {
        const ctx = this.ctx;
        const cam = this.camera;
        this._frame++;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = COLORS.void;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const dpr = cam.dpr;
        const scale = cam.zoom * dpr;
        ctx.setTransform(
            scale, 0, 0, scale,
            dpr * (cam.viewWidth / 2 - cam.x * cam.zoom),
            dpr * (cam.viewHeight / 2 - cam.y * cam.zoom)
        );

        const bounds = this.getVisibleBounds();
        this.stats.drawnChunks = 0;
        this.stats.drawnTiles = 0;

        if (cam.zoom <= DIRECT_DRAW_ZOOM) this._drawGroundFromChunks(ctx, bounds);
        else this._drawGroundDirect(ctx, bounds);

        drawBuildings(ctx, this.map, bounds, {
            night: state.night,
            zoom: cam.zoom,
            structureScratch: this._structureScratch
        });

        drawCars(ctx, state.trafficManager, cam.zoom, state.night);

        if (state.nightFactor > 0.02) {
            ctx.fillStyle = `rgba(16, 24, 48, ${state.nightFactor * 0.45})`;
            ctx.fillRect(
                bounds.minX * TILE_SIZE, bounds.minY * TILE_SIZE,
                (bounds.maxX - bounds.minX + 1) * TILE_SIZE,
                (bounds.maxY - bounds.minY + 1) * TILE_SIZE
            );
        }

        drawDataView(ctx, state.dataView, state, bounds);
        drawPreview(ctx, state.preview);
        if (!state.preview?.tiles?.length) drawHover(ctx, state.hover, this.map);
        drawSelection(ctx, state.selection, performance.now());

        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // --- ground layers ------------------------------------------------------

    _drawGroundFromChunks(ctx, bounds) {
        const minCX = (bounds.minX / CHUNK_TILES) | 0;
        const maxCX = (bounds.maxX / CHUNK_TILES) | 0;
        const minCY = (bounds.minY / CHUNK_TILES) | 0;
        const maxCY = (bounds.maxY / CHUNK_TILES) | 0;

        for (let cy = minCY; cy <= maxCY; cy++) {
            for (let cx = minCX; cx <= maxCX; cx++) {
                const chunk = this._getChunk(cx, cy);
                ctx.drawImage(chunk.canvas, cx * CHUNK_PX, cy * CHUNK_PX, CHUNK_PX, CHUNK_PX);
                this.stats.drawnChunks++;
            }
        }
    }

    _drawGroundDirect(ctx, bounds) {
        const map = this.map;
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const tile = map.getTile(x, y);
                if (!tile) continue;
                const px = x * TILE_SIZE, py = y * TILE_SIZE;
                drawTerrainTile(ctx, tile, px, py);
                drawZoneTint(ctx, tile, px, py);
                drawUtilityTile(ctx, tile, px, py);
                this.stats.drawnTiles++;
            }
        }
        // Roads on a second pass so their kerbs overlap neighbouring ground.
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const tile = map.getTile(x, y);
                if (tile?.road) drawRoadTile(ctx, tile, x * TILE_SIZE, y * TILE_SIZE);
            }
        }
    }

    _getChunk(cx, cy) {
        const key = cy * this.chunksX + cx;
        let chunk = this._chunks.get(key);

        if (!chunk) {
            this._evictIfNeeded();
            const canvas = typeof OffscreenCanvas !== 'undefined'
                ? new OffscreenCanvas(CHUNK_PX, CHUNK_PX)
                : Object.assign(document.createElement('canvas'), { width: CHUNK_PX, height: CHUNK_PX });
            chunk = { canvas, ctx: canvas.getContext('2d'), dirty: true, lastUsed: this._frame, cx, cy };
            this._chunks.set(key, chunk);
        }

        chunk.lastUsed = this._frame;
        if (chunk.dirty) this._paintChunk(chunk);
        return chunk;
    }

    _paintChunk(chunk) {
        const ctx = chunk.ctx;
        const map = this.map;
        const originX = chunk.cx * CHUNK_TILES;
        const originY = chunk.cy * CHUNK_TILES;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = COLORS.void;
        ctx.fillRect(0, 0, CHUNK_PX, CHUNK_PX);

        for (let ty = 0; ty < CHUNK_TILES; ty++) {
            for (let tx = 0; tx < CHUNK_TILES; tx++) {
                const tile = map.getTile(originX + tx, originY + ty);
                if (!tile) continue;
                const px = tx * TILE_SIZE, py = ty * TILE_SIZE;
                drawTerrainTile(ctx, tile, px, py);
                drawZoneTint(ctx, tile, px, py);
                drawUtilityTile(ctx, tile, px, py);
            }
        }
        for (let ty = 0; ty < CHUNK_TILES; ty++) {
            for (let tx = 0; tx < CHUNK_TILES; tx++) {
                const tile = map.getTile(originX + tx, originY + ty);
                if (tile?.road) drawRoadTile(ctx, tile, tx * TILE_SIZE, ty * TILE_SIZE);
            }
        }

        chunk.dirty = false;
        this.stats.chunkRedraws++;
    }

    _evictIfNeeded() {
        if (this._chunks.size < MAX_CACHED_CHUNKS) return;
        let oldestKey = null, oldestFrame = Infinity;
        for (const [key, chunk] of this._chunks) {
            if (chunk.lastUsed < oldestFrame) { oldestFrame = chunk.lastUsed; oldestKey = key; }
        }
        if (oldestKey !== null) this._chunks.delete(oldestKey);
    }
}
