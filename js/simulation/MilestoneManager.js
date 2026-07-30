// js/simulation/MilestoneManager.js
// Population milestones: they name the city's current status, pay a cash grant,
// and gate the more advanced tools so a new player is handed the toolbox one
// piece at a time instead of all at once.

import { eventBus } from '../utils/EventBus.js';

export const MILESTONES = [
    { pop: 0, title: 'Tiny Settlement', reward: 0, unlocks: 'Roads, zoning, water and power' },
    { pop: 240, title: 'Crossroads Village', reward: 4000, unlocks: 'Police & fire stations' },
    { pop: 400, title: 'Market Town', reward: 6000, unlocks: 'City plaza' },
    { pop: 500, title: 'Growing Town', reward: 8000, unlocks: 'Four-lane avenues' },
    { pop: 600, title: 'Busy Town', reward: 10000, unlocks: 'Clinics & schools' },
    { pop: 1200, title: 'Small City', reward: 16000, unlocks: 'Solar farms' },
    { pop: 2500, title: 'Boom Town', reward: 26000, unlocks: 'Water treatment plants' },
    { pop: 4000, title: 'Big City', reward: 40000, unlocks: 'University' },
    { pop: 6000, title: 'Metropolis', reward: 65000, unlocks: 'Stadium' },
    { pop: 12000, title: 'Megalopolis', reward: 120000, unlocks: 'Everything. Nice work.' }
];

export class MilestoneManager {
    constructor() {
        this.level = 0;      // index into MILESTONES
        this.peakPopulation = 0;
    }

    get current() { return MILESTONES[this.level]; }
    get next() { return MILESTONES[this.level + 1] ?? null; }

    /** Progress 0..1 toward the next milestone. */
    progress(population) {
        const next = this.next;
        if (!next) return 1;
        const from = this.current.pop;
        return Math.max(0, Math.min(1, (population - from) / Math.max(1, next.pop - from)));
    }

    /** A feature is available once the city has ever reached `pop`. */
    isUnlocked(pop) { return this.peakPopulation >= pop; }

    update(population, economy) {
        this.peakPopulation = Math.max(this.peakPopulation, population);
        while (this.next && this.peakPopulation >= this.next.pop) {
            this.level++;
            const milestone = this.current;
            if (milestone.reward > 0) economy?.earn(milestone.reward, 'milestone');
            eventBus.emit('milestone:reached', milestone);
            eventBus.emit('ui:notify', {
                icon: '🏆', kind: 'good',
                title: `Milestone: ${milestone.title}`,
                body: `${milestone.unlocks} unlocked. Grant: §${milestone.reward.toLocaleString('en-US')}`
            });
        }
    }

    serialize() { return { level: this.level, peak: this.peakPopulation }; }

    restore(data = {}) {
        this.level = data.level ?? 0;
        this.peakPopulation = data.peak ?? 0;
    }
}
