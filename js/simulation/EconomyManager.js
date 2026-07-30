// js/simulation/EconomyManager.js
// Owns the player's money and computes daily income/expenses from taxes and
// road upkeep. Placement costs are charged immediately by the tools; this
// manager just needs to know the going rates so the UI can show them too.

import {
    STARTING_MONEY, COST_ROAD_TILE, COST_ZONE_TILE, COST_UTILITY_TILE,
    ROAD_UPKEEP_PER_TILE
} from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

export class EconomyManager {
    constructor() {
        this.money = STARTING_MONEY;
        this.lastDailyIncome = 0;
        this.lastDailyExpenses = 0;
    }

    canAfford(amount) { return this.money >= amount; }

    spend(amount) {
        if (!this.canAfford(amount)) return false;
        this.money -= amount;
        eventBus.emit('economy:changed', this.money);
        return true;
    }

    addMoney(amount) {
        this.money += amount;
        eventBus.emit('economy:changed', this.money);
    }

    roadCost(tileCount = 1) { return tileCount * COST_ROAD_TILE; }
    zoneCost(tileCount = 1) { return tileCount * COST_ZONE_TILE; }
    utilityCost(tileCount = 1) { return tileCount * COST_UTILITY_TILE; }

    /** Called once per simulated day. Applies tax income and upkeep expenses. */
    settleDailyBudget(zoneManager, roadNetwork) {
        const taxIncome = zoneManager.buildings.reduce((sum, b) => sum + b.dailyTax, 0);
        const upkeep = roadNetwork.totalRoadTiles * ROAD_UPKEEP_PER_TILE;

        this.lastDailyIncome = taxIncome;
        this.lastDailyExpenses = upkeep;
        this.money += taxIncome - upkeep;
        eventBus.emit('economy:changed', this.money);
        eventBus.emit('economy:dailySettled', { income: taxIncome, expenses: upkeep });
    }

    serialize() {
        return { money: this.money, lastDailyIncome: this.lastDailyIncome, lastDailyExpenses: this.lastDailyExpenses };
    }

    restore(data) {
        this.money = data.money ?? STARTING_MONEY;
        this.lastDailyIncome = data.lastDailyIncome ?? 0;
        this.lastDailyExpenses = data.lastDailyExpenses ?? 0;
    }
}
