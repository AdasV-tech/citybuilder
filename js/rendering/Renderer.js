// js/rendering/Renderer.js
// Orchestrates drawing order: terrain -> zones -> roads -> buildings -> cars -> overlays.
// Sub-renderers stay focused on one concern each so they're easy to extend later
// (e.g. a future ElectricityRenderer can slot in without touching this file much).

import { TILE_SIZE } from '../utils/Constants.js';
import { drawMap } from './MapRenderer.js';
import { drawRoads } from './RoadRenderer.js';
import { drawBuildings, drawZones } from './BuildingRenderer.js';
import { drawCars } from './CarRenderer.js';

export class Renderer {
    constructor(ctx, canvas, camera) {
        this.ctx = ctx;
        this.canvas = canvas;
        this.camera = camera;
        // Offscreen canvas for static map/road drawing to avoid redrawing
        // expensive terrain/road geometry every frame when nothing changed.
        this._staticCanvas = document.createElement('canvas');
        this._staticCtx = this._staticCanvas.getContext('2d');
        this._staticValid = false;
        this._lastSize = { w: 0, h: 0 };
    }

    invalidateStaticCache() {
        this._staticValid = false;
    }

    resize(displayWidth, displayHeight, dpr = 1) {
        const w = Math.round(displayWidth * dpr);
        const h = Math.round(displayHeight * dpr);
        this._staticCanvas.width = w;
        this._staticCanvas.height = h;
        this._lastSize = { w, h };
        this._staticValid = false;
    }

    /** Returns the visible tile bounding box, with a small margin, for culling. */
    getVisibleTileBounds(cityMap) {
        const cam = this.camera;
        const topLeft = cam.screenToTile(0, 0);
        const bottomRight = cam.screenToTile(this.canvas.width, this.canvas.height);
        return {
            minX: Math.max(0, topLeft.x - 2),
            minY: Math.max(0, topLeft.y - 2),
            maxX: Math.min(cityMap.width - 1, bottomRight.x + 2),
            maxY: Math.min(cityMap.height - 1, bottomRight.y + 2)
        };
    }

    render(state) {
        const { cityMap, roadNetwork, zoneManager, trafficManager, infrastructure, hoverTile, activeTool, dragPreviewTiles } = state;
        const ctx = this.ctx;
        const cam = this.camera;

        // Ensure static cache is valid for current canvas size and viewport
        const pixelW = this.canvas.width, pixelH = this.canvas.height;
        if (this._lastSize.w !== pixelW || this._lastSize.h !== pixelH) {
            this._staticCanvas.width = pixelW;
            this._staticCanvas.height = pixelH;
            this._staticValid = false;
            this._lastSize = { w: pixelW, h: pixelH };
        }

        ctx.save();
        ctx.fillStyle = '#213045';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        const bounds = this.getVisibleTileBounds(cityMap);
        // Draw cached static layer (map + roads) if valid, otherwise rebuild it.
        if (!this._staticValid) {
            const sctx = this._staticCtx;
            sctx.save();
            // same transforms as main context so draw functions can reuse tile coords
            sctx.clearRect(0, 0, this._staticCanvas.width, this._staticCanvas.height);
            sctx.translate(this.canvas.width / 2, this.canvas.height / 2);
            sctx.scale(cam.zoom, cam.zoom);
            sctx.translate(-cam.x, -cam.y);
            drawMap(sctx, cityMap, bounds);
            drawRoads(sctx, cityMap, bounds);
            sctx.restore();
            this._staticValid = true;
        }

        // Blit the static cache into the main context
        ctx.drawImage(this._staticCanvas, 0, 0);

        // Dynamic layers still drawn live
        drawZones(ctx, cityMap, bounds);
        drawRoads(ctx, cityMap, bounds); // small roads redraw kept for lane lines clarity
        this._drawInfrastructure(ctx, cityMap, infrastructure, bounds);
        drawBuildings(ctx, cityMap, bounds, infrastructure);
        drawCars(ctx, trafficManager);

        this._drawHoverAndPreview(ctx, hoverTile, activeTool, dragPreviewTiles, cityMap);

        ctx.restore();
    }

    _drawInfrastructure(ctx, cityMap, infrastructure, bounds) {
        if (!infrastructure) return;
        // Batch service overlay strokes to reduce Canvas state changes and
        // avoid calling stroke() many times per tile.
        const waterPath = new Path2D();
        const powerPath = new Path2D();
        let hasWaterSegment = false;
        let hasPowerSegment = false;

        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const tile = cityMap.getTile(x, y);
                if (!tile) continue;
                const hasWater = tile.waterPipe || (tile.road && tile.road.serviceMask & 1);
                const hasPower = tile.powerLine || (tile.road && tile.road.serviceMask & 2);
                if (hasWater) {
                    hasWaterSegment = true;
                    waterPath.moveTo(x * TILE_SIZE + TILE_SIZE * 0.2, y * TILE_SIZE + TILE_SIZE * 0.8);
                    waterPath.lineTo((x + 1) * TILE_SIZE - TILE_SIZE * 0.2, y * TILE_SIZE + TILE_SIZE * 0.8);
                }
                if (hasPower) {
                    hasPowerSegment = true;
                    powerPath.moveTo(x * TILE_SIZE + TILE_SIZE * 0.2, y * TILE_SIZE + TILE_SIZE * 0.2);
                    powerPath.lineTo((x + 1) * TILE_SIZE - TILE_SIZE * 0.2, y * TILE_SIZE + TILE_SIZE * 0.2);
                }
            }
        }

        if (hasWaterSegment) {
            ctx.strokeStyle = 'rgba(93, 216, 255, 0.95)';
            ctx.lineWidth = 2;
            ctx.stroke(waterPath);
        }
        if (hasPowerSegment) {
            ctx.strokeStyle = 'rgba(255, 220, 90, 0.95)';
            ctx.lineWidth = 2;
            ctx.stroke(powerPath);
        }
*** End Patch
        const nodes = infrastructure.getServiceNodes();
        for (const pump of nodes.waterPumps) {
            this._drawInfrastructureMarker(ctx, pump.x, pump.y, '#5dd8ff', 'W');
        }
        for (const outlet of nodes.wasteWaterOutlets) {
            this._drawInfrastructureMarker(ctx, outlet.x, outlet.y, '#5b8e8b', 'S');
        }
        for (const plant of nodes.powerPlants) {
            this._drawInfrastructureMarker(ctx, plant.x, plant.y, '#ffd166', 'E');
        }
    }

    _drawInfrastructureMarker(ctx, x, y, color, label) {
        const px = x * TILE_SIZE + TILE_SIZE * 0.25;
        const py = y * TILE_SIZE + TILE_SIZE * 0.25;
        const size = TILE_SIZE * 0.5;
        ctx.save();
        ctx.fillStyle = color;
        ctx.fillRect(px, py, size, size);
        ctx.fillStyle = '#102234';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(label, px + 4, py + 14);
        ctx.restore();
    }

    _drawHoverAndPreview(ctx, hoverTile, activeTool, dragPreviewTiles, cityMap) {
        if (dragPreviewTiles && dragPreviewTiles.length) {
            for (const t of dragPreviewTiles) {
                this._drawTileHighlight(ctx, t.x, t.y, t.valid ? 'rgba(255,255,255,0.35)' : 'rgba(220,60,60,0.45)');
            }
        } else if (hoverTile && activeTool && activeTool !== 'none') {
            const inBounds = cityMap.inBounds(hoverTile.x, hoverTile.y);
            this._drawTileHighlight(ctx, hoverTile.x, hoverTile.y, inBounds ? 'rgba(255,255,255,0.25)' : 'rgba(220,60,60,0.35)');
        }
    }

    _drawTileHighlight(ctx, x, y, color) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        ctx.strokeRect(x * TILE_SIZE + 0.75, y * TILE_SIZE + 0.75, TILE_SIZE - 1.5, TILE_SIZE - 1.5);
        ctx.restore();
    }
}
