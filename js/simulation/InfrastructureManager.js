// js/simulation/InfrastructureManager.js
// Lightweight utility services for the city: water pumps and pipes, and power plants and lines.
// The systems are intentionally simple so the game can show infrastructure without needing a full
// city-planning UI. They also feed the growth and abandonment simulation.

import { tileKey } from '../utils/MathUtils.js';

export class InfrastructureManager {
    constructor(cityMap, roadNetwork) {
        this.map = cityMap;
        this.roads = roadNetwork;
        this.waterPumps = [];
        this.waterPipes = new Set();
        this.wasteWaterOutlets = [];
        this.powerPlants = [];
        this.powerLines = new Set();
        this._buildInitialInfrastructure();
    }

    _buildInitialInfrastructure() {
        this._createWaterNetwork();
        this._createPowerNetwork();
        this.rebuildNetworks();
    }

    _createWaterNetwork() {
        const pumpPositions = [];
        this.map.forEachTile((tile, x, y) => {
            if (!tile.isWater) return;
            if (pumpPositions.length >= 2) return;
            const landNeighbor = [
                this.map.getTile(x + 1, y),
                this.map.getTile(x - 1, y),
                this.map.getTile(x, y + 1),
                this.map.getTile(x, y - 1)
            ].some(candidate => candidate && !candidate.isWater);
            if (landNeighbor) pumpPositions.push({ x, y });
        });

        for (const pos of pumpPositions) {
            this.waterPumps.push({ x: pos.x, y: pos.y, type: 'water-pump' });
            this.wasteWaterOutlets.push({ x: pos.x + 2, y: pos.y + 1, type: 'waste-water' });
        }
    }

    _createPowerNetwork() {
        const plants = [
            { x: 4, y: 4, type: 'coal-reactor' },
            { x: this.map.width - 5, y: 4, type: 'wind-mill' },
            { x: 4, y: this.map.height - 5, type: 'gas-reactor' }
        ];
        this.powerPlants.push(...plants);
    }

    rebuildNetworks() {
        this.waterPipes.clear();
        this.powerLines.clear();

        for (const pump of this.waterPumps) {
            this._markTilesNearPoint(this.waterPipes, pump.x, pump.y, 2);
        }
        for (const plant of this.powerPlants) {
            this._markTilesNearPoint(this.powerLines, plant.x, plant.y, 3);
        }

        this.map.forEachTile((tile, x, y) => {
            const hasWaterPipe = tile.waterPipe || this.waterPipes.has(tileKey(x, y));
            const hasPowerLine = tile.powerLine || this.powerLines.has(tileKey(x, y));
            if (tile.road) {
                if (hasWaterPipe || hasPowerLine) {
                    tile.road.serviceMask = (tile.road.serviceMask || 0) | (hasWaterPipe ? 1 : 0) | (hasPowerLine ? 2 : 0);
                } else if (tile.road.serviceMask) {
                    tile.road.serviceMask = 0;
                }
            }
        });
    }

    _markTilesNearPoint(set, x, y, radius) {
        for (let ty = y - radius; ty <= y + radius; ty++) {
            for (let tx = x - radius; tx <= x + radius; tx++) {
                if (Math.abs(tx - x) + Math.abs(ty - y) > radius + 1) continue;
                if (!this.map.inBounds(tx, ty)) continue;
                set.add(tileKey(tx, ty));
            }
        }
    }

    hasWaterAccess(x, y) {
        const tile = this.map.getTile(x, y);
        if (tile?.waterPipe) return true;
        if (this.waterPipes.has(tileKey(x, y))) return true;
        return this.waterPumps.some(pump => Math.hypot(x - pump.x, y - pump.y) <= 3.5);
    }

    hasPowerAccess(x, y) {
        const tile = this.map.getTile(x, y);
        if (tile?.powerLine) return true;
        if (this.powerLines.has(tileKey(x, y))) return true;
        return this.powerPlants.some(plant => Math.hypot(x - plant.x, y - plant.y) <= 4.2);
    }

    getServiceAccessFactor(x, y) {
        const water = this.hasWaterAccess(x, y) ? 1 : 0.55;
        const power = this.hasPowerAccess(x, y) ? 1 : 0.55;
        return water * power;
    }

    getServiceNodes() {
        return {
            waterPumps: this.waterPumps,
            wasteWaterOutlets: this.wasteWaterOutlets,
            powerPlants: this.powerPlants
        };
    }
}
