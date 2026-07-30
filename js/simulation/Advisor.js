// js/simulation/Advisor.js
// Watches the city and speaks up when something needs the player's attention.
// Each problem fires once when it starts and stays quiet until it has been
// resolved for a while, so the notification feed never turns into spam.

import { eventBus } from '../utils/EventBus.js';

const COOLDOWN_MS = 45000;

export class Advisor {
    constructor() {
        this._active = new Map(); // id -> { firing, lastFired }
        this._elapsed = 0;
    }

    reset() { this._active.clear(); }

    update(dtMs, city) {
        this._elapsed += dtMs;

        const checks = [
            {
                id: 'power',
                on: city.utilities.powerDemand > city.utilities.powerSupply * 1.001 && city.utilities.powerDemand > 0,
                icon: '⚡', kind: 'bad', title: 'Not enough electricity',
                body: 'Parts of the city are dark. Build another power plant.'
            },
            {
                id: 'water',
                on: city.utilities.waterDemand > city.utilities.waterSupply * 1.001 && city.utilities.waterDemand > 0,
                icon: '💧', kind: 'bad', title: 'Not enough water',
                body: 'Add a pumping station or a water tower.'
            },
            {
                id: 'sewage',
                on: city.utilities.sewageProduced > city.utilities.sewageCapacity * 1.001,
                icon: '🚱', kind: 'warn', title: 'Sewage is backing up',
                body: 'Build a sewage outlet or treatment plant before pollution spreads.'
            },
            {
                id: 'unconnected',
                on: city.stats.unpowered + city.stats.unwatered > Math.max(4, city.zones.buildings.length * 0.15),
                icon: '🔌', kind: 'warn', title: 'Buildings are unconnected',
                body: 'Utilities travel under roads — connect these blocks to the grid.'
            },
            {
                id: 'traffic',
                on: city.traffic.averageCongestion > 0.62,
                icon: '🚗', kind: 'warn', title: 'Traffic is jammed',
                body: 'Upgrade the busiest streets to avenues or add another route.'
            },
            {
                id: 'money',
                on: city.economy.money < 0,
                icon: '💸', kind: 'bad', title: 'The city is in the red',
                body: 'Raise taxes, or demolish services you cannot afford.'
            },
            {
                id: 'unhappy',
                on: city.zones.buildings.length > 12 && city.zones.averageHappiness < 0.35,
                icon: '😠', kind: 'warn', title: 'Citizens are unhappy',
                body: 'Check the happiness view — services, pollution or taxes are hurting.'
            },
            {
                id: 'abandoned',
                on: city.stats.abandoned > 5,
                icon: '🏚️', kind: 'warn', title: 'Buildings are being abandoned',
                body: 'Fix the underlying problem, then bulldoze the ruins.'
            }
        ];

        for (const check of checks) this._evaluate(check);
    }

    _evaluate(check) {
        const state = this._active.get(check.id) ?? { firing: false, lastFired: -Infinity };

        if (check.on) {
            const cooled = this._elapsed - state.lastFired > COOLDOWN_MS;
            if (!state.firing && cooled) {
                eventBus.emit('ui:notify', {
                    id: check.id, icon: check.icon, kind: check.kind,
                    title: check.title, body: check.body
                });
                state.lastFired = this._elapsed;
            }
            state.firing = true;
        } else if (state.firing) {
            state.firing = false;
            eventBus.emit('ui:problemResolved', check.id);
        }
        this._active.set(check.id, state);
    }

    /** Ids of the problems currently active — the HUD shows these as chips. */
    get activeProblems() {
        return [...this._active.entries()].filter(([, s]) => s.firing).map(([id]) => id);
    }
}
