// js/simulation/FieldManager.js
// The "invisible maps" that make a city feel alive: service coverage, ground
// pollution, traffic noise and land value. Everything is a Float32Array the
// size of the map, rebuilt on a timer rather than per frame, and every consumer
// (growth, happiness, the data views) samples the same arrays.

import { SERVICE_FIELDS } from '../utils/Constants.js';
import { clamp01 } from '../utils/MathUtils.js';

export class FieldManager {
    constructor(cityMap, serviceManager, zoneManager, roadNetwork) {
        this.map = cityMap;
        this.services = serviceManager;
        this.zones = zoneManager;
        this.roads = roadNetwork;

        const size = cityMap.width * cityMap.height;
        this.police = new Float32Array(size);
        this.fire = new Float32Array(size);
        this.health = new Float32Array(size);
        this.education = new Float32Array(size);
        this.leisure = new Float32Array(size);
        this.pollution = new Float32Array(size);
        this.landValue = new Float32Array(size);
        this.traffic = new Float32Array(size);
        this._scratch = new Float32Array(size);
        this._temp = new Float32Array(size);
        // Terrain never changes, so the waterfront premium is precomputed once.
        this._nearWaterMask = this._computeNearWater(3);

        this.averages = { police: 0, fire: 0, health: 0, education: 0, leisure: 0, pollution: 0, landValue: 0 };
    }

    sample(field, x, y) {
        if (!this.map.inBounds(x, y)) return 0;
        return field[y * this.map.width + x];
    }

    /** Bundle of the five service fields at one tile — used by Building.update. */
    servicesAt(x, y) {
        const i = y * this.map.width + x;
        return {
            police: this.police[i],
            fire: this.fire[i],
            health: this.health[i],
            education: this.education[i],
            leisure: this.leisure[i]
        };
    }

    rebuild() {
        this._stampServices();
        this._buildPollution();
        this._buildTraffic();
        this._buildLandValue();
        this._updateAverages();
    }

    // --- service coverage --------------------------------------------------------

    _stampServices() {
        for (const name of SERVICE_FIELDS) this[name].fill(0);

        for (const structure of this.services.structures) {
            const def = structure.def;
            if (!def?.field || !structure.operational) continue;
            this._stampRadial(this[def.field], structure.centerX, structure.centerY, def.radius, def.strength);
        }
        for (const name of SERVICE_FIELDS) {
            const field = this[name];
            for (let i = 0; i < field.length; i++) field[i] = clamp01(field[i]);
        }
    }

    /** Additive linear falloff disc — cheap and reads well on the data views. */
    _stampRadial(field, cx, cy, radius, strength) {
        const map = this.map;
        const minX = Math.max(0, Math.floor(cx - radius));
        const maxX = Math.min(map.width - 1, Math.ceil(cx + radius));
        const minY = Math.max(0, Math.floor(cy - radius));
        const maxY = Math.min(map.height - 1, Math.ceil(cy + radius));
        const inv = 1 / radius;

        for (let y = minY; y <= maxY; y++) {
            const dy = y + 0.5 - cy;
            for (let x = minX; x <= maxX; x++) {
                const dx = x + 0.5 - cx;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > radius) continue;
                field[y * map.width + x] += (1 - d * inv) * strength;
            }
        }
    }

    // --- pollution ----------------------------------------------------------------

    _buildPollution() {
        const map = this.map;
        const raw = this._scratch;
        raw.fill(0);

        for (const building of this.zones.buildings) {
            if (building.abandoned || !building.isIndustrial) continue;
            raw[building.y * map.width + building.x] += 0.12 + building.level * 0.05;
        }
        for (const structure of this.services.structures) {
            const emission = structure.def?.pollution ?? 0;
            if (emission > 0) raw[structure.y * map.width + structure.x] += emission;
        }
        // Roads add a little exhaust proportional to how busy they are.
        for (const tile of map.tiles) {
            if (tile.road) raw[tile.y * map.width + tile.x] += Math.min(0.25, tile.road.congestion * 0.25);
        }

        this._diffuse(raw, this.pollution, 3, 0.86);

        // Forests scrub the air around them.
        for (const tile of map.tiles) {
            if (!tile.isForest) continue;
            const i = tile.y * map.width + tile.x;
            this.pollution[i] *= 0.55;
        }
        for (let i = 0; i < this.pollution.length; i++) this.pollution[i] = clamp01(this.pollution[i]);
    }

    /** Simple separable box blur, repeated `passes` times, with decay. */
    _diffuse(source, target, passes, decay) {
        const map = this.map, w = map.width, h = map.height;
        target.set(source);
        const temp = this._temp;

        for (let pass = 0; pass < passes; pass++) {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    const l = x > 0 ? target[i - 1] : target[i];
                    const r = x < w - 1 ? target[i + 1] : target[i];
                    temp[i] = (l + target[i] * 2 + r) * 0.25;
                }
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    const u = y > 0 ? temp[i - w] : temp[i];
                    const d = y < h - 1 ? temp[i + w] : temp[i];
                    target[i] = (u + temp[i] * 2 + d) * 0.25 * decay + source[i] * 0.35;
                }
            }
        }
    }

    // --- traffic ---------------------------------------------------------------------

    _buildTraffic() {
        const map = this.map;
        for (let i = 0; i < this.traffic.length; i++) {
            const tile = map.tiles[i];
            this.traffic[i] = tile.road ? clamp01(tile.road.congestion) : 0;
        }
    }

    // --- land value --------------------------------------------------------------------

    _buildLandValue() {
        const map = this.map, w = map.width, h = map.height;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const tile = map.tiles[i];

                let value = 0.20;
                value += this.leisure[i] * 0.26;
                value += this.education[i] * 0.16;
                value += this.health[i] * 0.13;
                value += this.police[i] * 0.10;
                value += this.fire[i] * 0.06;
                value += (tile.powered ? 0.05 : 0) + (tile.watered ? 0.05 : 0);
                value -= this.pollution[i] * 0.55;
                value -= this.traffic[i] * 0.18;
                if (this._nearWaterMask[i]) value += 0.12;  // waterfront premium
                if (tile.isForest) value += 0.04;

                this.landValue[i] = clamp01(value);
            }
        }
    }

    _computeNearWater(radius) {
        const map = this.map, w = map.width, h = map.height;
        const mask = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                if (!map.tiles[y * w + x].isWater) continue;
                const minY = Math.max(0, y - radius), maxY = Math.min(h - 1, y + radius);
                const minX = Math.max(0, x - radius), maxX = Math.min(w - 1, x + radius);
                for (let ty = minY; ty <= maxY; ty++) {
                    for (let tx = minX; tx <= maxX; tx++) mask[ty * w + tx] = 1;
                }
            }
        }
        return mask;
    }

    _updateAverages() {
        const built = this.zones.buildings;
        if (built.length === 0) {
            for (const key of Object.keys(this.averages)) this.averages[key] = 0;
            return;
        }
        const sums = { police: 0, fire: 0, health: 0, education: 0, leisure: 0, pollution: 0, landValue: 0 };
        for (const b of built) {
            const i = b.y * this.map.width + b.x;
            sums.police += this.police[i];
            sums.fire += this.fire[i];
            sums.health += this.health[i];
            sums.education += this.education[i];
            sums.leisure += this.leisure[i];
            sums.pollution += this.pollution[i];
            sums.landValue += this.landValue[i];
        }
        for (const key of Object.keys(sums)) this.averages[key] = sums[key] / built.length;
    }
}
