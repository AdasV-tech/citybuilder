// js/simulation/Building.js
// Represents a single grown building on a zoned lot. Tracks the stats the
// brief asks for (population, workers, happiness, tax contribution) and can
// upgrade once conditions are good, per the "first playable version" scope.

import { BUILDING_CAPACITY, MAX_BUILDING_LEVEL, TAX_RATE_RESIDENTIAL, TAX_RATE_COMMERCIAL, TAX_RATE_INDUSTRIAL } from '../utils/Constants.js';

let nextBuildingId = 1;

export class Building {
    constructor(x, y, zoneType) {
        this.id = nextBuildingId++;
        this.x = x;
        this.y = y;
        this.zoneType = zoneType; // 'residential' | 'commercial' | 'industrial'
        this.level = 1;

        this.population = 0; // residents (residential only)
        this.workers = 0;    // employees (commercial/industrial only)
        this.jobCapacity = this._capacityForLevel();
        this.happiness = 0.6; // 0..1

        this.timeSinceUpgradeCheck = 0;
    }

    _capacityForLevel() {
        const table = BUILDING_CAPACITY[this.zoneType];
        return table[Math.min(this.level - 1, table.length - 1)];
    }

    get isResidential() { return this.zoneType === 'residential'; }
    get isCommercial() { return this.zoneType === 'commercial'; }
    get isIndustrial() { return this.zoneType === 'industrial'; }

    /** Occupancy count regardless of type (population for residential, workers otherwise). */
    get occupancy() {
        return this.isResidential ? this.population : this.workers;
    }

    get capacity() {
        return this._capacityForLevel();
    }

    /** Daily tax income this building contributes. */
    get dailyTax() {
        if (this.isResidential) return this.population * TAX_RATE_RESIDENTIAL;
        if (this.isCommercial) return this.workers * TAX_RATE_COMMERCIAL;
        return this.workers * TAX_RATE_INDUSTRIAL;
    }

    /** Called each sim tick to slowly fill up occupancy toward capacity. */
    updateOccupancy(dtMs, demandFactor = 1) {
        const cap = this._capacityForLevel();
        const target = Math.round(cap * Math.min(1, Math.max(0, demandFactor)));
        const fillRatePerMs = 0.0006; // fraction of a person per ms, slow organic growth
        if (this.isResidential) {
            if (this.population < target) {
                this.population = Math.min(target, this.population + fillRatePerMs * dtMs * cap);
            } else if (this.population > target) {
                this.population = Math.max(target, this.population - fillRatePerMs * dtMs * cap * 0.5);
            }
        } else {
            if (this.workers < target) {
                this.workers = Math.min(target, this.workers + fillRatePerMs * dtMs * cap);
            } else if (this.workers > target) {
                this.workers = Math.max(target, this.workers - fillRatePerMs * dtMs * cap * 0.5);
            }
        }
    }

    updateHappiness(cityHappinessFactors) {
        // Simple blended happiness: base + occupancy ratio - light penalty for congestion.
        const occRatio = this.capacity > 0 ? this.occupancy / this.capacity : 0;
        let h = 0.5 + occRatio * 0.2 + (cityHappinessFactors.taxRateComfort ?? 0.1);
        h -= (cityHappinessFactors.congestionPenalty ?? 0);
        this.happiness = Math.max(0, Math.min(1, h));
    }

    /** Attempts to upgrade if happiness is good and the building is near full. */
    tryUpgrade() {
        if (this.level >= MAX_BUILDING_LEVEL) return false;
        const nearFull = this.occupancy >= this._capacityForLevel() * 0.9;
        if (this.happiness >= 0.65 && nearFull) {
            this.level += 1;
            this.jobCapacity = this._capacityForLevel();
            return true;
        }
        return false;
    }

    toJSON() {
        return {
            id: this.id, x: this.x, y: this.y, zoneType: this.zoneType, level: this.level,
            population: this.population, workers: this.workers, happiness: this.happiness
        };
    }

    static fromJSON(data) {
        const b = new Building(data.x, data.y, data.zoneType);
        b.id = data.id;
        b.level = data.level;
        b.population = data.population;
        b.workers = data.workers;
        b.happiness = data.happiness;
        b.jobCapacity = b._capacityForLevel();
        if (data.id >= nextBuildingId) nextBuildingId = data.id + 1;
        return b;
    }
}
