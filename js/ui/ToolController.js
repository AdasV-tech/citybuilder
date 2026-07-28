// js/ui/ToolController.js
// Bridges raw tile-coordinate pointer events (from InputHandler) into actual
// game actions: dragging a road, painting a zone rectangle, or bulldozing.
// Also exposes the current drag preview so the Renderer can show valid/invalid
// tiles before the player commits.

import { orthogonalPath } from '../utils/MathUtils.js';

export class ToolController {
    constructor(game) {
        this.game = game;
        this.activeTool = 'none'; // 'road' | 'bulldoze' | 'zone-residential' | 'zone-commercial' | 'zone-industrial'
        this._dragStart = null;
        this._dragCurrent = null;
        this.hoverTile = null;
        this.previewTiles = [];
    }

    setTool(tool) {
        this.activeTool = tool;
        this._dragStart = null;
        this.previewTiles = [];
    }

    onToolHover(x, y) {
        this.hoverTile = { x, y };
    }

    onToolDown(x, y) {
        this.hoverTile = { x, y };
        this._dragStart = { x, y };
        this._dragCurrent = { x, y };
        this._updatePreview();
    }

    onToolMove(x, y) {
        this.hoverTile = { x, y };
        if (!this._dragStart) return;
        this._dragCurrent = { x, y };
        this._updatePreview();
    }

    onToolUp(x, y) {
        if (!this._dragStart) return;
        this._dragCurrent = { x, y };
        this._commit();
        this._dragStart = null;
        this.previewTiles = [];
    }

    _tilesForCurrentDrag() {
        if (!this._dragStart || !this._dragCurrent) return [];
        const a = this._dragStart, b = this._dragCurrent;

        if (this.activeTool === 'road') {
            return orthogonalPath(a.x, a.y, b.x, b.y);
        }
        // zone tools and bulldozer paint a filled rectangle
        const tiles = [];
        const minX = Math.min(a.x, b.x), maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y), maxY = Math.max(a.y, b.y);
        for (let ty = minY; ty <= maxY; ty++) {
            for (let tx = minX; tx <= maxX; tx++) {
                tiles.push({ x: tx, y: ty });
            }
        }
        return tiles;
    }

    _updatePreview() {
        const tiles = this._tilesForCurrentDrag();
        this.previewTiles = tiles.map(t => ({
            x: t.x, y: t.y,
            valid: this._isTileValidForTool(t.x, t.y)
        }));
    }

    _isTileValidForTool(x, y) {
        const map = this.game.cityMap;
        const tile = map.getTile(x, y);
        if (!tile) return false;
        switch (this.activeTool) {
            case 'road':
                return !tile.road && !tile.isWater && !tile.building && !tile.zoneType;
            case 'zone-residential':
            case 'zone-commercial':
            case 'zone-industrial':
                return tile.isEmptyZonable;
            case 'bulldoze':
                return tile.isBulldozable;
            default:
                return false;
        }
    }

    _commit() {
        const tiles = this._tilesForCurrentDrag();
        if (this.activeTool === 'road') {
            this.game.placeRoads(tiles);
        } else if (this.activeTool.startsWith('zone-')) {
            const zoneType = this.activeTool.replace('zone-', '');
            this.game.placeZones(tiles, zoneType);
        } else if (this.activeTool === 'bulldoze') {
            this.game.bulldoze(tiles);
        }
    }
}
