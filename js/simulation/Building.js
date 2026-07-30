// js/simulation/Building.js
// A grown building on a zoned lot. It owns its own little feedback loop:
// local conditions (utilities, services, pollution, traffic, taxes) decide how
// happy it is, happiness plus land value decide whether it levels up, fills up,
// empties out, or is eventually abandoned.

import {
    BUILDING_CAPACITY, MAX_BUILDING_LEVEL, LEVEL_LAND_VALUE,
    TAX_BASE, TAX_RATE_DEFAULT, TAX_RATE_COMFORT, ABANDON_WINDOW_MS,
    LEVEL_UP_INTERVAL_MS, POWER_PER_OCCUPANT, WATER_PER_OCCUPANT
} from '../utils/Constants.js';
import { clamp01, lerp } from '../utils/MathUtils.js';

let nextBuildingId = 1;

export function resetBuildingIds(value = 1) { nextBuildingId = value; }

export class Building {
    constructor(x, y, zone, variant = 0) {
        this.id = nextBuildingId++;
        this.x = x;
        this.y = y;
        this.zone = zone;              // 'residential' | 'commercial' | 'industrial'
        this.level = 1;
        this.variant = variant;        // stable sprite pick

        this.occupants = 0;            // residents or workers depending on zone
        this.happiness = 0.6;
        this.landValue = 0.3;
        this.powered = false;
        this.watered = false;
        this.abandoned = false;
        this.abandonTimer = 0;
        this.levelTimer = 0;
        this.age = 0;
        this.complaint = null;         // short reason string for the info panel
    }

    get isResidential() { return this.zone === 'residential'; }
    get isCommercial() { return this.zone === 'commercial'; }
    get isIndustrial() { return this.zone === 'industrial'; }

    get capacity() {
        const table = BUILDING_CAPACITY[this.zone];
        return table[Math.min(this.level - 1, table.length - 1)];
    }

    get population() { return this.isResidential ? this.occupants : 0; }
    get jobs() { return this.isResidential ? 0 : this.occupants; }

    get powerDemand() { return this.capacity * POWER_PER_OCCUPANT * (this.isIndustrial ? 1.5 : 1); }
    get waterDemand() { return this.capacity * WATER_PER_OCCUPANT * (this.isIndustrial ? 1.3 : 1); }

    /** Monthly tax contribution, scaled by the rate the player set. */
    monthlyTax(taxRate = TAX_RATE_DEFAULT, educationLevel = 0) {
        if (this.abandoned) return 0;
        const base = TAX_BASE[this.zone] * this.occupants;
        const rateScale = taxRate / TAX_RATE_DEFAULT;
        const educated = 1 + educationLevel * 0.35;
        const morale = 0.55 + this.happiness * 0.45;
        return base * rateScale * educated * morale;
    }

    /**
     * One simulation step.
     * @param {number} dtMs simulated milliseconds
     * @param {object} ctx  { demand, landValue, pollution, congestion, taxRate,
     *                        powered, watered, services:{police,fire,health,education,leisure} }
     * @returns {'ok'|'abandoned'} whether the lot survived this tick
     */
    update(dtMs, ctx) {
        this.age += dtMs;
        this.powered = ctx.powered;
        this.watered = ctx.watered;
        this.landValue = ctx.landValue;

        const attractiveness = this._evaluate(ctx);

        // Occupancy chases the attractive share of capacity.
        const target = this.capacity * attractiveness;
        const rate = 0.00055 * dtMs * this.capacity;
        if (this.occupants < target) this.occupants = Math.min(target, this.occupants + rate);
        else this.occupants = Math.max(target, this.occupants - rate * 0.7);

        // Misery accumulates; sustained misery abandons the lot.
        const miserable = this.happiness < 0.28 || (!this.powered && !this.watered);
        this.abandonTimer = miserable
            ? this.abandonTimer + dtMs
            : Math.max(0, this.abandonTimer - dtMs * 0.6);
        if (this.abandonTimer >= ABANDON_WINDOW_MS) {
            this.abandoned = true;
            this.occupants = 0;
            return 'abandoned';
        }

        this._tryLevelChange(dtMs);
        return 'ok';
    }

    /** Happiness + the demand-limited share of capacity this lot can attract. */
    _evaluate(ctx) {
        const services = ctx.services || {};
        const coverage = this.isResidential
            ? (services.police * 0.22 + services.fire * 0.18 + services.health * 0.24 +
               services.education * 0.18 + services.leisure * 0.18)
            : (services.police * 0.34 + services.fire * 0.34 + services.leisure * 0.32);

        const utilities = (this.powered ? 0.5 : 0) + (this.watered ? 0.5 : 0);
        const taxPain = Math.max(0, (ctx.taxRate ?? TAX_RATE_DEFAULT) - TAX_RATE_COMFORT) * 4.5;
        const pollutionPain = this.isIndustrial ? ctx.pollution * 0.15 : ctx.pollution * 0.55;
        const trafficPain = ctx.congestion * 0.3;

        let h = 0.34
            + coverage * 0.34
            + utilities * 0.30
            + ctx.landValue * 0.18
            - taxPain
            - pollutionPain
            - trafficPain;

        this.happiness = lerp(this.happiness, clamp01(h), 0.25);
        this.complaint = this._diagnose(ctx, coverage);

        // How full the lot gets is mostly about how good a place it is to live
        // or trade in; demand only nudges it. (Making occupancy proportional to
        // demand instead stalls the whole city at a permanent half-empty
        // equilibrium — demand's job is to decide whether *new* lots get built.)
        const desirability = clamp01(0.42 + this.happiness * 0.72);
        const demandNudge = 0.8 + clamp01(ctx.demand ?? 0.5) * 0.2;
        return clamp01(desirability * demandNudge * utilities);
    }

    _diagnose(ctx, coverage) {
        if (!this.powered && !this.watered) return 'No power or water';
        if (!this.powered) return 'No electricity';
        if (!this.watered) return 'No running water';
        if (ctx.pollution > 0.55 && !this.isIndustrial) return 'Heavy pollution';
        if (ctx.congestion > 0.7) return 'Gridlocked streets';
        if (coverage < 0.25) return 'No city services';
        if ((ctx.taxRate ?? 0) > TAX_RATE_COMFORT + 0.05) return 'Taxes are too high';
        return null;
    }

    /** Level up when prosperous and full; drop a level when persistently poor. */
    _tryLevelChange(dtMs) {
        this.levelTimer += dtMs;
        if (this.levelTimer < LEVEL_UP_INTERVAL_MS) return;
        this.levelTimer = 0;

        const nearFull = this.occupants >= this.capacity * 0.78;
        const canGrow = this.level < MAX_BUILDING_LEVEL &&
            this.landValue >= LEVEL_LAND_VALUE[this.level] &&
            this.happiness >= 0.55 && nearFull;

        if (canGrow) { this.level++; return; }
        if (this.level > 1 && this.happiness < 0.35 && this.occupants < this.capacity * 0.3) {
            this.level--;
        }
    }

    toJSON() {
        return {
            i: this.id, x: this.x, y: this.y, z: this.zone, l: this.level, v: this.variant,
            o: Math.round(this.occupants * 100) / 100,
            h: Math.round(this.happiness * 1000) / 1000,
            a: this.abandoned ? 1 : 0
        };
    }

    static fromJSON(data) {
        const b = new Building(data.x, data.y, data.z, data.v ?? 0);
        b.id = data.i ?? b.id;
        b.level = data.l ?? 1;
        b.occupants = data.o ?? 0;
        b.happiness = data.h ?? 0.6;
        b.abandoned = !!data.a;
        if (b.id >= nextBuildingId) nextBuildingId = b.id + 1;
        return b;
    }
}
