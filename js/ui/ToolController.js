// js/ui/ToolController.js
// Turns tile-space pointer events into city edits. It owns the drag preview
// (which tiles would be affected, whether each is legal, and what it would
// cost) so the renderer and the HUD can both show the player the outcome
// *before* they commit — the rules live in one place and are never duplicated.

import { orthogonalPath, rectTiles } from '../utils/MathUtils.js';
import { COST_PER_TILE } from '../utils/Constants.js';
import { getService } from '../data/ServiceCatalog.js';
import { eventBus } from '../utils/EventBus.js';

export class ToolController {
    constructor(game) {
        this.game = game;
        this.activeTool = null;      // item from Toolbox.CATEGORIES
        this.hover = null;           // {x, y}
        this.preview = null;         // {tiles:[{x,y,valid}], footprint?, cost}
        this.selection = null;       // {kind, x, y, size, radius, ref}
        this._dragStart = null;
        this._dragEnd = null;
    }

    setTool(item) {
        this.activeTool = item ?? null;
        this._dragStart = null;
        this.preview = null;
        if (item) this.selection = null;
        eventBus.emit('tool:changed', item);
    }

    clearTool() { this.setTool(null); }

    select(selection) {
        this.selection = selection;
        eventBus.emit('ui:selection', selection);
    }

    clearSelection() { this.select(null); }

    // --- pointer events -------------------------------------------------------

    onHover(x, y) {
        this.hover = { x, y };
        if (this.activeTool && !this._dragStart) this._rebuildPreview(x, y, x, y);
    }

    onHoverExit() {
        this.hover = null;
        if (!this._dragStart) this.preview = null;
    }

    onToolDown(x, y) {
        this.hover = { x, y };
        if (!this.activeTool) { this._selectAt(x, y); return; }
        this._dragStart = { x, y };
        this._dragEnd = { x, y };
        this._rebuildPreview(x, y, x, y);
    }

    onToolMove(x, y) {
        this.hover = { x, y };
        if (!this.activeTool || !this._dragStart) return;
        this._dragEnd = { x, y };
        this._rebuildPreview(this._dragStart.x, this._dragStart.y, x, y);
    }

    onToolUp(x, y) {
        if (!this.activeTool || !this._dragStart) { this._dragStart = null; return; }
        this._dragEnd = { x, y };
        this._commit();
        this._dragStart = null;
        this._rebuildPreview(x, y, x, y);
    }

    onCancelDrag() {
        this._dragStart = null;
        this.preview = null;
    }

    // --- preview ---------------------------------------------------------------

    _tilesForDrag(x0, y0, x1, y1) {
        const kind = this.activeTool?.kind;
        if (kind === 'road' || kind === 'utility') return orthogonalPath(x0, y0, x1, y1);
        if (kind === 'service') return [{ x: x1, y: y1 }];
        return rectTiles(x0, y0, x1, y1);
    }

    _rebuildPreview(x0, y0, x1, y1) {
        const tool = this.activeTool;
        if (!tool) { this.preview = null; return; }

        if (tool.kind === 'service') {
            const def = getService(tool.serviceId);
            const origin = this._serviceOrigin(x1, y1, def.size);
            const check = this.game.services.checkPlacement(def.id, origin.x, origin.y);
            this.preview = {
                tiles: [],
                footprint: { x: origin.x, y: origin.y, size: def.size, radius: def.radius, valid: check.ok },
                cost: def.cost,
                reason: check.reason ?? null
            };
            return;
        }

        const tiles = this._tilesForDrag(x0, y0, x1, y1);
        let cost = 0;
        const marked = tiles.map(t => {
            const valid = this._isValid(t.x, t.y);
            if (valid) cost += this._tileCost(t.x, t.y);
            return { x: t.x, y: t.y, valid };
        });
        this.preview = { tiles: marked, cost, reason: null };
    }

    /** Centre a multi-tile footprint on the cursor. */
    _serviceOrigin(x, y, size) {
        const half = Math.floor((size - 1) / 2);
        return { x: x - half, y: y - half };
    }

    _isValid(x, y) {
        const tile = this.game.cityMap.getTile(x, y);
        if (!tile) return false;
        const tool = this.activeTool;

        switch (tool.kind) {
            case 'road':
                if (tile.isWater || tile.isRock || tile.building || tile.structure) return false;
                return !tile.road || tile.road.type !== tool.roadType;
            case 'zone':
                return tile.isZonable && tile.zone !== tool.zone;
            case 'dezone':
                return !!tile.zone;
            case 'utility':
                if (tile.isWater || tile.isRock || tile.road || tile.building || tile.structure) return false;
                return tool.utility === 'pipe' ? !tile.pipe : !tile.wire;
            case 'bulldoze':
                return tile.hasAnything;
            default:
                return false;
        }
    }

    _tileCost(x, y) {
        const tool = this.activeTool;
        const tile = this.game.cityMap.getTile(x, y);
        switch (tool.kind) {
            case 'road': return COST_PER_TILE[tool.roadType] * (tile.road ? 0.6 : 1);
            case 'zone': return COST_PER_TILE.zone;
            case 'utility': return COST_PER_TILE[tool.utility];
            case 'bulldoze': return COST_PER_TILE.bulldoze;
            default: return 0;
        }
    }

    // --- commit -----------------------------------------------------------------

    _commit() {
        const tool = this.activeTool;
        const preview = this.preview;
        if (!tool || !preview) return;

        if (tool.kind === 'service') {
            const footprint = preview.footprint;
            if (!footprint?.valid) {
                eventBus.emit('ui:toast', { text: preview.reason ?? 'Cannot build here', kind: 'bad' });
                return;
            }
            this.game.placeService(tool.serviceId, footprint.x, footprint.y);
            return;
        }

        const tiles = preview.tiles.filter(t => t.valid);
        if (tiles.length === 0) return;

        switch (tool.kind) {
            case 'road': this.game.placeRoads(tiles, tool.roadType); break;
            case 'zone': this.game.placeZones(tiles, tool.zone); break;
            case 'dezone': this.game.dezone(tiles); break;
            case 'utility': this.game.placeUtilities(tiles, tool.utility); break;
            case 'bulldoze': this.game.bulldoze(tiles); break;
        }
    }

    // --- selection ---------------------------------------------------------------

    _selectAt(x, y) {
        const tile = this.game.cityMap.getTile(x, y);
        if (!tile) { this.clearSelection(); return; }

        if (tile.structure) {
            const s = tile.structure;
            this.select({ kind: 'service', x: s.x, y: s.y, size: s.size, radius: s.def?.radius, ref: s });
        } else if (tile.building) {
            this.select({ kind: 'building', x, y, size: 1, ref: tile.building });
        } else {
            this.select({ kind: 'tile', x, y, size: 1, ref: tile });
        }
    }
}
