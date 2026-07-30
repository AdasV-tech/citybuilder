// js/simulation/DemandManager.js
// The RCI bars. Demand is a slow-moving feedback loop between what the city
// has and what it lacks: people want homes when there are jobs, industry wants
// workers, commerce wants customers *and* goods to sell. Taxes and happiness
// scale the whole thing so a badly-run city stops growing.

import { clamp01, lerp } from '../utils/MathUtils.js';
import { TAX_RATE_COMFORT } from '../utils/Constants.js';

export class DemandManager {
    constructor() {
        this.residential = 0.75;
        this.commercial = 0.5;
        this.industrial = 0.6;
    }

    get(zone) {
        if (zone === 'residential') return this.residential;
        if (zone === 'commercial') return this.commercial;
        return this.industrial;
    }

    /**
     * @param {object} stats { population, jobs, commercialJobs, industrialJobs,
     *                         residentialCapacity, happiness, taxes:{r,c,i},
     *                         unemployment }
     */
    update(dtMs, stats) {
        const t = clamp01(dtMs / 4000);

        const pop = Math.max(1, stats.population);
        const jobs = Math.max(1, stats.jobs);
        const workforce = pop * 0.55;                      // share of citizens who work

        // Residential: driven by spare jobs and by how nice the city is.
        const jobSurplus = clamp01((jobs - workforce) / Math.max(30, workforce));
        const targetR = clamp01(0.18 + jobSurplus * 1.1 + (stats.happiness - 0.5) * 0.5);

        // Industry wants workers, and gets soft once everyone already works.
        const workerSurplus = clamp01((workforce - jobs) / Math.max(30, jobs));
        const targetI = clamp01(0.16 + workerSurplus * 1.0 - stats.industrialShare * 0.5);

        // Commerce needs customers nearby and goods from industry to sell.
        const customerPull = clamp01(pop / Math.max(40, stats.commercialJobs * 12 + 40));
        const goodsPull = clamp01(stats.industrialJobs / Math.max(20, stats.commercialJobs * 3 + 20));
        const targetC = clamp01(0.12 + customerPull * 0.75 + goodsPull * 0.35 - stats.commercialShare * 0.4);

        const taxes = stats.taxes || {};
        const taxDrag = (rate) => clamp01(1 - Math.max(0, (rate ?? TAX_RATE_COMFORT) - TAX_RATE_COMFORT) * 6);

        this.residential = lerp(this.residential, targetR * taxDrag(taxes.residential), t);
        this.commercial = lerp(this.commercial, targetC * taxDrag(taxes.commercial), t);
        this.industrial = lerp(this.industrial, targetI * taxDrag(taxes.industrial), t);
    }

    serialize() {
        return { r: this.residential, c: this.commercial, i: this.industrial };
    }

    restore(data = {}) {
        this.residential = data.r ?? 0.75;
        this.commercial = data.c ?? 0.5;
        this.industrial = data.i ?? 0.6;
    }
}
