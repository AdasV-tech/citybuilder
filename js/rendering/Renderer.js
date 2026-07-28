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
        const { cityMap, roadNetwork, zoneManager, trafficManager, hoverTile, activeTool, dragPreviewTiles } = state;
        const ctx = this.ctx;
        const cam = this.camera;

        ctx.save();
        ctx.fillStyle = '#213045';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        ctx.scale(cam.zoom, cam.zoom);
        ctx.translate(-cam.x, -cam.y);

        const bounds = this.getVisibleTileBounds(cityMap);

        drawMap(ctx, cityMap, bounds);
        drawZones(ctx, cityMap, bounds);
        drawRoads(ctx, cityMap, bounds);
        drawBuildings(ctx, cityMap, bounds);
        drawCars(ctx, trafficManager);

        this._drawHoverAndPreview(ctx, hoverTile, activeTool, dragPreviewTiles, cityMap);

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
