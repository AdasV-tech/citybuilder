// js/simulation/EconomyManager.js
// Money, tax policy and the monthly budget. Construction costs are charged
// immediately; taxes and upkeep settle once per in-game month so the player can
// watch a balance sheet the way they would in a real city builder.

import {
    STARTING_MONEY, TAX_RATE_DEFAULT, TAX_RATE_MIN, TAX_RATE_MAX,
    UPKEEP_PER_TILE, LOAN_LIMIT
} from '../utils/Constants.js';
import { clamp } from '../utils/MathUtils.js';
import { eventBus } from '../utils/EventBus.js';

export class EconomyManager {
    constructor() {
        this.money = STARTING_MONEY;
        this.taxes = {
            residential: TAX_RATE_DEFAULT,
            commercial: TAX_RATE_DEFAULT,
            industrial: TAX_RATE_DEFAULT
        };
        // Last settled month, broken down for the budget panel.
        this.ledger = {
            taxResidential: 0, taxCommercial: 0, taxIndustrial: 0,
            roadUpkeep: 0, utilityUpkeep: 0, serviceUpkeep: 0,
            income: 0, expenses: 0, balance: 0
        };
        this.history = []; // last 24 months of net balance, for the sparkline
    }

    get canGoNegative() { return this.money > -LOAN_LIMIT; }

    canAfford(amount) { return this.money - amount > -LOAN_LIMIT; }

    spend(amount, reason = '') {
        if (!this.canAfford(amount)) {
            eventBus.emit('ui:toast', { text: 'Not enough money', kind: 'bad' });
            return false;
        }
        this.money -= amount;
        eventBus.emit('economy:changed', { money: this.money, delta: -amount, reason });
        return true;
    }

    earn(amount, reason = '') {
        this.money += amount;
        eventBus.emit('economy:changed', { money: this.money, delta: amount, reason });
    }

    setTaxRate(zone, rate) {
        if (!(zone in this.taxes)) return;
        this.taxes[zone] = clamp(rate, TAX_RATE_MIN, TAX_RATE_MAX);
    }

    /** Settle a month: collect taxes, pay upkeep, record the ledger. */
    settleMonth({ buildings, roadNetwork, serviceManager, educationLevel = 0 }) {
        const ledger = this.ledger;
        ledger.taxResidential = 0;
        ledger.taxCommercial = 0;
        ledger.taxIndustrial = 0;

        for (const b of buildings) {
            if (b.abandoned) continue;
            const tax = b.monthlyTax(this.taxes[b.zone], educationLevel);
            if (b.isResidential) ledger.taxResidential += tax;
            else if (b.isCommercial) ledger.taxCommercial += tax;
            else ledger.taxIndustrial += tax;
        }

        const roadCounts = roadNetwork.tileCountsByType();
        ledger.roadUpkeep = roadCounts.street * UPKEEP_PER_TILE.street +
                            roadCounts.avenue * UPKEEP_PER_TILE.avenue;
        ledger.utilityUpkeep = roadNetwork.utilityTileCount.pipe * UPKEEP_PER_TILE.pipe +
                               roadNetwork.utilityTileCount.wire * UPKEEP_PER_TILE.wire;
        ledger.serviceUpkeep = serviceManager.totalUpkeep;

        ledger.income = ledger.taxResidential + ledger.taxCommercial + ledger.taxIndustrial;
        ledger.expenses = ledger.roadUpkeep + ledger.utilityUpkeep + ledger.serviceUpkeep;
        ledger.balance = ledger.income - ledger.expenses;

        this.money += ledger.balance;
        this.history.push(ledger.balance);
        if (this.history.length > 24) this.history.shift();

        eventBus.emit('economy:monthSettled', { ...ledger, money: this.money });
        if (this.money < 0) {
            eventBus.emit('ui:notify', {
                icon: '💸', kind: 'bad', title: 'City in debt',
                body: 'Raise taxes or cut services before the bank pulls the plug.'
            });
        }
        return ledger;
    }

    serialize() {
        return { money: this.money, taxes: { ...this.taxes }, ledger: { ...this.ledger }, history: [...this.history] };
    }

    restore(data = {}) {
        this.money = data.money ?? STARTING_MONEY;
        this.taxes = { ...this.taxes, ...(data.taxes || {}) };
        this.ledger = { ...this.ledger, ...(data.ledger || {}) };
        this.history = Array.isArray(data.history) ? data.history.slice(-24) : [];
    }
}
