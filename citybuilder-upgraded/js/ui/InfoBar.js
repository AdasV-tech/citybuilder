// js/ui/InfoBar.js
// Updates the bottom status bar each frame. Cheap enough (a handful of
// textContent writes) that it doesn't need to be event-driven.

export class InfoBar {
    constructor(rootEl, game) {
        this.game = game;
        this.moneyEl = rootEl.querySelector('[data-info="money"]');
        this.popEl = rootEl.querySelector('[data-info="population"]');
        this.jobsEl = rootEl.querySelector('[data-info="jobs"]');
        this.dayEl = rootEl.querySelector('[data-info="day"]');
        this.speedEl = rootEl.querySelector('[data-info="speed"]');
        this.incomeEl = rootEl.querySelector('[data-info="income"]');
        this.expensesEl = rootEl.querySelector('[data-info="expenses"]');
        this.carsEl = rootEl.querySelector('[data-info="cars"]');
    }

    update() {
        const g = this.game;
        if (this.moneyEl) this.moneyEl.textContent = `§${Math.round(g.economy.money).toLocaleString()}`;
        if (this.popEl) this.popEl.textContent = g.zoneManager.totalPopulation.toLocaleString();
        if (this.jobsEl) this.jobsEl.textContent = g.zoneManager.totalJobs.toLocaleString();
        if (this.dayEl) this.dayEl.textContent = `Day ${g.time.day}`;
        if (this.speedEl) this.speedEl.textContent = g.time.paused ? 'Paused' : g.time.speed[0].toUpperCase() + g.time.speed.slice(1);
        if (this.incomeEl) this.incomeEl.textContent = `+§${Math.round(g.economy.lastDailyIncome)}`;
        if (this.expensesEl) this.expensesEl.textContent = `-§${Math.round(g.economy.lastDailyExpenses)}`;
        if (this.carsEl) this.carsEl.textContent = g.trafficManager.carCount;
    }
}
