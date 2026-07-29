// js/save/SaveManager.js
// Serializes/restores the whole game state to Local Storage. Storing tile
// terrain would be large but static (deterministic from the seed), so we
// only persist the seed plus everything the player actually changed:
// roads, zones/buildings, money, and time.

const SAVE_KEY = 'citybuilder_save_v1';
const AUTOSAVE_KEY = 'citybuilder_autosave_v1';

export class SaveManager {
    serializeState(game) {
        const roadTiles = [];
        game.cityMap.forEachTile(tile => {
            if (tile.road) roadTiles.push([tile.x, tile.y]);
        });

        const zoneTiles = [];
        game.cityMap.forEachTile(tile => {
            if (tile.zoneType && !tile.building) zoneTiles.push([tile.x, tile.y, tile.zoneType, tile.growthTimer]);
        });

        return {
            version: 1,
            savedAt: Date.now(),
            seed: game.cityMap.seed,
            mapWidth: game.cityMap.width,
            mapHeight: game.cityMap.height,
            roads: roadTiles,
            zones: zoneTiles,
            buildings: game.zoneManager.serialize(),
            economy: game.economy.serialize(),
            time: game.time.serialize()
        };
    }

    save(game) {
        const data = this.serializeState(game);
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return data;
    }

    autosave(game) {
        const data = this.serializeState(game);
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
        return data;
    }

    hasSave() { return !!localStorage.getItem(SAVE_KEY); }
    hasAutosave() { return !!localStorage.getItem(AUTOSAVE_KEY); }

    clearAllSaves() {
        const hadSave = this.hasSave();
        const hadAutosave = this.hasAutosave();
        if (!hadSave && !hadAutosave) return false;
        localStorage.removeItem(SAVE_KEY);
        localStorage.removeItem(AUTOSAVE_KEY);
        return true;
    }

    loadRaw(useAutosave = false) {
        const raw = localStorage.getItem(useAutosave ? AUTOSAVE_KEY : SAVE_KEY);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
    }

    /** Applies saved data onto an already-constructed game instance. */
    applyTo(game, data) {
        if (!data) return false;

        // Roads first (buildings/zones depend on adjacency, but restoring
        // order doesn't matter here since we set tiles directly).
        for (const [x, y] of data.roads) {
            game.roadNetwork.placeRoad(x, y);
        }

        for (const [x, y, zoneType, growthTimer] of data.zones) {
            const tile = game.cityMap.getTile(x, y);
            if (!tile) continue;
            tile.clearNature();
            tile.zoneType = zoneType;
            tile.growthTimer = growthTimer || 0;
        }

        game.zoneManager.restore(data.buildings || []);
        game.economy.restore(data.economy || {});
        game.time.restore(data.time || {});

        return true;
    }
}
