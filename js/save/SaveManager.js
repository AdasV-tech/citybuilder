// js/save/SaveManager.js
// Persists the city to Local Storage (plus manual JSON export/import).
// Terrain isn't stored — it's a pure function of the seed — so a save is only
// the things the player actually built, which keeps it small and fast.

const SAVE_KEY = 'citybuilder_save_v2';
const AUTOSAVE_KEY = 'citybuilder_autosave_v2';
const SAVE_VERSION = 2;

function storage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
        return null;   // private-mode browsers throw on access
    }
}

export class SaveManager {
    serializeState(game) {
        const pipes = [];
        const wires = [];
        for (const tile of game.cityMap.tiles) {
            if (tile.pipe) pipes.push([tile.x, tile.y]);
            if (tile.wire) wires.push([tile.x, tile.y]);
        }

        const zoneData = game.zones.serialize();

        return {
            version: SAVE_VERSION,
            savedAt: Date.now(),
            cityName: game.cityName,
            seed: game.cityMap.seed,
            width: game.cityMap.width,
            height: game.cityMap.height,
            roads: game.roads.serialize(),
            zones: zoneData.zones,
            buildings: zoneData.buildings,
            pipes,
            wires,
            services: game.services.serialize(),
            economy: game.economy.serialize(),
            time: game.time.serialize(),
            demand: game.demand.serialize(),
            milestones: game.milestones.serialize(),
            camera: { x: game.camera.targetX, y: game.camera.targetY, zoom: game.camera.targetZoom }
        };
    }

    save(game) {
        const data = this.serializeState(game);
        this._write(SAVE_KEY, data);
        return data;
    }

    autosave(game) {
        const data = this.serializeState(game);
        this._write(AUTOSAVE_KEY, data);
        return data;
    }

    _write(key, data) {
        const store = storage();
        if (!store) return false;
        try {
            store.setItem(key, JSON.stringify(data));
            return true;
        } catch {
            return false;   // quota exceeded
        }
    }

    hasSave() { return !!storage()?.getItem(SAVE_KEY); }
    hasAutosave() { return !!storage()?.getItem(AUTOSAVE_KEY); }

    clearAllSaves() {
        const store = storage();
        if (!store) return false;
        const had = this.hasSave() || this.hasAutosave();
        store.removeItem(SAVE_KEY);
        store.removeItem(AUTOSAVE_KEY);
        return had;
    }

    loadRaw(useAutosave = false) {
        const raw = storage()?.getItem(useAutosave ? AUTOSAVE_KEY : SAVE_KEY);
        if (!raw) return null;
        try {
            const data = JSON.parse(raw);
            return this._isValid(data) ? data : null;
        } catch {
            return null;
        }
    }

    _isValid(data) {
        return !!data && typeof data === 'object' && Array.isArray(data.roads);
    }

    exportSave(game) {
        return JSON.stringify(this.serializeState(game), null, 2);
    }

    /** Apply saved data to an already-reset game instance. */
    applyTo(game, data) {
        if (!this._isValid(data)) return false;

        game.cityName = data.cityName ?? game.cityName;
        game.roads.restore(data.roads);

        for (const [x, y] of data.pipes || []) {
            const tile = game.cityMap.getTile(x, y);
            if (tile) { tile.clearTrees(); tile.pipe = true; }
        }
        for (const [x, y] of data.wires || []) {
            const tile = game.cityMap.getTile(x, y);
            if (tile) { tile.clearTrees(); tile.wire = true; }
        }

        game.services.restore(data.services || []);
        game.zones.restore({ zones: data.zones || [], buildings: data.buildings || [] });
        game.economy.restore(data.economy || {});
        game.time.restore(data.time || {});
        game.demand.restore(data.demand || {});
        game.milestones.restore(data.milestones || {});

        if (data.camera) {
            game.camera.targetX = game.camera.x = data.camera.x;
            game.camera.targetY = game.camera.y = data.camera.y;
            game.camera.targetZoom = game.camera.zoom = data.camera.zoom;
        }
        return true;
    }
}
