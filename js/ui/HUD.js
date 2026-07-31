// js/ui/HUD.js
// The top bar: city identity and milestone progress, the headline numbers,
// the RCI demand bars, the clock and the speed controls.
//
// It writes to the DOM only when a value actually changes — at 60 fps a naive
// HUD is one of the most expensive things in a browser game, and a city sim
// updates most of these numbers a few times a second at most.

import { formatMoney, formatCompact } from '../utils/MathUtils.js';

export class HUD {
    constructor(root, ui) {
        this.root = root;
        this.ui = ui;
        this.game = ui.game;
        this._cache = new Map();
        this._build();
    }

    _build() {
        this.root.innerHTML = `
            <div class="hud-group hud-city">
                <button class="city-crest" type="button" title="Rename city">🏙️</button>
                <div class="city-meta">
                    <span class="city-name" data-hud="cityName">City</span>
                    <span class="city-rank" data-hud="rank">Tiny Settlement</span>
                    <div class="milestone-bar"><i data-hud="milestoneFill"></i></div>
                </div>
            </div>

            <div class="hud-group hud-stats">
                <div class="stat" title="Treasury">
                    <span class="stat-icon">💰</span>
                    <span class="stat-body">
                        <span class="stat-value" data-hud="money">§0</span>
                        <span class="stat-sub" data-hud="balance">§0/mo</span>
                    </span>
                </div>
                <div class="stat" title="Population">
                    <span class="stat-icon">👥</span>
                    <span class="stat-body">
                        <span class="stat-value" data-hud="population">0</span>
                        <span class="stat-sub" data-hud="jobs">0 jobs</span>
                    </span>
                </div>
                <div class="stat" title="Average happiness">
                    <span class="stat-icon" data-hud="moodIcon">🙂</span>
                    <span class="stat-body">
                        <span class="stat-value" data-hud="happiness">60%</span>
                        <span class="stat-sub">happy</span>
                    </span>
                </div>
                <div class="stat utilities" title="Power and water supply">
                    <span class="stat-body">
                        <span class="meter"><i data-hud="powerFill"></i><b>⚡</b></span>
                        <span class="meter"><i data-hud="waterFill"></i><b>💧</b></span>
                    </span>
                </div>
            </div>

            <div class="hud-group hud-demand" title="Demand for new zones">
                <div class="demand-bar"><i data-hud="demandR"></i><span>R</span></div>
                <div class="demand-bar"><i data-hud="demandC"></i><span>C</span></div>
                <div class="demand-bar"><i data-hud="demandI"></i><span>I</span></div>
            </div>

            <div class="hud-group hud-time">
                <div class="clock">
                    <span class="clock-date" data-hud="date">Jan 1, 2025</span>
                    <span class="clock-time" data-hud="clock">08:00</span>
                </div>
                <div class="speed-buttons">
                    <button class="speed-btn" data-speed="0" title="Pause (Space)">⏸</button>
                    <button class="speed-btn" data-speed="1" title="Normal speed">▶</button>
                    <button class="speed-btn" data-speed="2" title="Fast">⏩</button>
                    <button class="speed-btn" data-speed="3" title="Very fast">⏭</button>
                </div>
            </div>`;

        this.els = {};
        for (const el of this.root.querySelectorAll('[data-hud]')) this.els[el.dataset.hud] = el;

        this.speedButtons = [...this.root.querySelectorAll('[data-speed]')];
        for (const button of this.speedButtons) {
            button.addEventListener('click', () => {
                this.ui.game.setSpeed(Number(button.dataset.speed));
                this.ui.audio.playClick();
                this._syncSpeed();
            });
        }

        this.root.querySelector('.city-crest').addEventListener('click', () => this.ui.renameCity());
        this._syncSpeed();
    }

    /** Writes `value` to an element only if it differs from last time. */
    _set(key, value) {
        if (this._cache.get(key) === value) return;
        this._cache.set(key, value);
        const el = this.els[key];
        if (el) el.textContent = value;
    }

    _setWidth(key, ratio) {
        const pct = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
        if (this._cache.get(`w:${key}`) === pct) return;
        this._cache.set(`w:${key}`, pct);
        const el = this.els[key];
        if (el) el.style.width = pct;
    }

    _setHeight(key, ratio) {
        const pct = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
        if (this._cache.get(`h:${key}`) === pct) return;
        this._cache.set(`h:${key}`, pct);
        const el = this.els[key];
        if (el) el.style.height = pct;
    }

    update() {
        const game = this.game;
        const stats = game.zones.stats;
        const economy = game.economy;

        this._set('cityName', game.cityName);
        this._set('rank', game.milestones.current.title);
        this._setWidth('milestoneFill', game.milestones.progress(stats.population));

        this._set('money', formatMoney(economy.money));
        const balance = economy.ledger.balance;
        this._set('balance', `${balance >= 0 ? '+' : ''}${formatMoney(balance)}/mo`);
        if (this.els.balance) {
            this.els.balance.classList.toggle('positive', balance >= 0);
            this.els.balance.classList.toggle('negative', balance < 0);
        }

        this._set('population', formatCompact(stats.population));
        this._set('jobs', `${formatCompact(stats.jobs)} jobs`);

        const happiness = game.zones.averageHappiness;
        this._set('happiness', `${Math.round(happiness * 100)}%`);
        this._set('moodIcon', happiness >= 0.75 ? '😀' : happiness >= 0.5 ? '🙂' : happiness >= 0.25 ? '😐' : '😠');

        this._setWidth('powerFill', game.utilities.powerRatio);
        this._setWidth('waterFill', game.utilities.waterRatio);

        this._setHeight('demandR', game.demand.residential);
        this._setHeight('demandC', game.demand.commercial);
        this._setHeight('demandI', game.demand.industrial);

        this._set('date', game.time.label);
        this._set('clock', game.time.clockLabel);
        this._syncSpeed();
    }

    _syncSpeed() {
        const speed = this.game.time.speed;
        if (this._cache.get('speed') === speed) return;
        this._cache.set('speed', speed);
        for (const button of this.speedButtons) {
            button.classList.toggle('active', Number(button.dataset.speed) === speed);
        }
    }
}
