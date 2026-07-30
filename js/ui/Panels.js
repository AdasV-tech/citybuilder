// js/ui/Panels.js
// The side panels behind the rail's non-tool logos (budget, city info, menu)
// and the selection card that appears when the player clicks something.
// Panels build their markup once when opened and refresh only the numbers.

import { formatMoney, formatCompact, clamp01 } from '../utils/MathUtils.js';
import { CITY_MENU } from '../data/Toolbox.js';
import { TAX_RATE_MIN, TAX_RATE_MAX, ZONE_LIST } from '../utils/Constants.js';
import { MILESTONES } from '../simulation/MilestoneManager.js';

export class PanelHost {
    constructor(root, ui) {
        this.root = root;
        this.ui = ui;
        this.game = ui.game;
        this.openId = null;
        this._live = null;   // update function for the open panel

        this.root.addEventListener('click', (event) => {
            if (event.target.closest('.panel-close')) this.close();
        });
    }

    toggle(id) {
        if (this.openId === id) { this.close(); return; }
        this.open(id);
    }

    open(id) {
        this.openId = id;
        this._live = null;
        this.root.classList.add('open');

        if (id === 'budget') this._renderBudget();
        else if (id === 'stats') this._renderStats();
        else if (id === 'menu') this._renderMenu();
        else { this.close(); return; }

        this.ui.audio.playOpen();
        this.update();
    }

    close() {
        this.openId = null;
        this._live = null;
        this.root.classList.remove('open');
        this.root.innerHTML = '';
        this.ui.syncRail();
    }

    update() {
        if (this._live) this._live();
    }

    _shell(icon, title, body) {
        this.root.innerHTML = `
            <header class="panel-head">
                <span class="panel-icon">${icon}</span>
                <h2>${title}</h2>
                <button class="panel-close" type="button" aria-label="Close">×</button>
            </header>
            <div class="panel-body">${body}</div>`;
    }

    // --- budget ---------------------------------------------------------------

    _renderBudget() {
        const taxes = this.game.economy.taxes;
        const sliders = ZONE_LIST.map(zone => `
            <div class="tax-row" data-zone="${zone}">
                <span class="tax-label ${zone}">${zone[0].toUpperCase() + zone.slice(1)}</span>
                <input class="tax-slider" type="range" data-zone="${zone}"
                       min="${TAX_RATE_MIN * 100}" max="${TAX_RATE_MAX * 100}" step="1"
                       value="${Math.round(taxes[zone] * 100)}">
                <span class="tax-value" data-tax="${zone}">${Math.round(taxes[zone] * 100)}%</span>
            </div>`).join('');

        this._shell('💰', 'Budget & Taxes', `
            <section class="panel-section">
                <h3>Tax rates</h3>
                ${sliders}
                <p class="panel-note">Above 10% citizens start to grumble; above 15% they leave.</p>
            </section>
            <section class="panel-section">
                <h3>Last month</h3>
                <table class="ledger">
                    <tr><td>Residential tax</td><td data-ledger="taxResidential">§0</td></tr>
                    <tr><td>Commercial tax</td><td data-ledger="taxCommercial">§0</td></tr>
                    <tr><td>Industrial tax</td><td data-ledger="taxIndustrial">§0</td></tr>
                    <tr class="sum"><td>Income</td><td data-ledger="income">§0</td></tr>
                    <tr><td>Road upkeep</td><td data-ledger="roadUpkeep">§0</td></tr>
                    <tr><td>Pipes &amp; wires</td><td data-ledger="utilityUpkeep">§0</td></tr>
                    <tr><td>Services</td><td data-ledger="serviceUpkeep">§0</td></tr>
                    <tr class="sum"><td>Expenses</td><td data-ledger="expenses">§0</td></tr>
                    <tr class="total"><td>Balance</td><td data-ledger="balance">§0</td></tr>
                </table>
            </section>
            <section class="panel-section">
                <h3>Trend</h3>
                <div class="spark" data-spark></div>
            </section>`);

        for (const slider of this.root.querySelectorAll('.tax-slider')) {
            slider.addEventListener('input', () => {
                const zone = slider.dataset.zone;
                this.game.economy.setTaxRate(zone, Number(slider.value) / 100);
                this.root.querySelector(`[data-tax="${zone}"]`).textContent = `${slider.value}%`;
            });
        }

        const ledgerCells = {};
        for (const cell of this.root.querySelectorAll('[data-ledger]')) ledgerCells[cell.dataset.ledger] = cell;
        const spark = this.root.querySelector('[data-spark]');

        this._live = () => {
            const ledger = this.game.economy.ledger;
            for (const [key, cell] of Object.entries(ledgerCells)) {
                const value = ledger[key] ?? 0;
                cell.textContent = formatMoney(value);
                cell.classList.toggle('negative', key === 'balance' && value < 0);
            }
            const history = this.game.economy.history;
            const peak = Math.max(1, ...history.map(v => Math.abs(v)));
            spark.innerHTML = history.map(v => {
                const height = Math.round((Math.abs(v) / peak) * 100);
                return `<i class="${v >= 0 ? 'up' : 'down'}" style="height:${Math.max(4, height)}%"></i>`;
            }).join('') || '<span class="panel-note">No months settled yet.</span>';
        };
    }

    // --- city info ---------------------------------------------------------------

    _renderStats() {
        this._shell('📈', 'City Info', `
            <section class="panel-section">
                <h3>Population</h3>
                <div class="stat-grid">
                    ${statCell('Citizens', 'population')}
                    ${statCell('Jobs', 'jobs')}
                    ${statCell('Unemployment', 'unemployment')}
                    ${statCell('Buildings', 'buildings')}
                </div>
            </section>
            <section class="panel-section">
                <h3>Quality of life</h3>
                ${meterRow('Happiness', 'happiness')}
                ${meterRow('Land value', 'landValue')}
                ${meterRow('Education', 'education')}
                ${meterRow('Health cover', 'health')}
                ${meterRow('Pollution', 'pollution', true)}
                ${meterRow('Traffic', 'traffic', true)}
            </section>
            <section class="panel-section">
                <h3>Utilities</h3>
                ${meterRow('Electricity', 'power')}
                ${meterRow('Water', 'water')}
                ${meterRow('Sewage', 'sewage')}
                <p class="panel-note" data-note="utilities"></p>
            </section>
            <section class="panel-section">
                <h3>Milestones</h3>
                <ol class="milestone-list">
                    ${MILESTONES.map((m, i) => `
                        <li data-milestone="${i}">
                            <span class="milestone-pop">${formatCompact(m.pop)}</span>
                            <span class="milestone-title">${m.title}</span>
                        </li>`).join('')}
                </ol>
            </section>`);

        const cells = {};
        for (const el of this.root.querySelectorAll('[data-stat]')) cells[el.dataset.stat] = el;
        const meters = {};
        for (const el of this.root.querySelectorAll('[data-meter]')) meters[el.dataset.meter] = el;
        const note = this.root.querySelector('[data-note="utilities"]');
        const milestoneItems = [...this.root.querySelectorAll('[data-milestone]')];

        this._live = () => {
            const game = this.game;
            const stats = game.zones.stats;
            const fields = game.fields.averages;
            const workforce = Math.max(1, stats.population * 0.55);
            const unemployment = clamp01((workforce - stats.jobs) / workforce);

            setText(cells.population, formatCompact(stats.population));
            setText(cells.jobs, formatCompact(stats.jobs));
            setText(cells.unemployment, `${Math.round(unemployment * 100)}%`);
            setText(cells.buildings, formatCompact(game.zones.buildings.length));

            setMeter(meters.happiness, game.zones.averageHappiness);
            setMeter(meters.landValue, fields.landValue);
            setMeter(meters.education, fields.education);
            setMeter(meters.health, fields.health);
            setMeter(meters.pollution, fields.pollution);
            setMeter(meters.traffic, game.traffic.averageCongestion);
            setMeter(meters.power, game.utilities.powerRatio);
            setMeter(meters.water, game.utilities.waterRatio);
            setMeter(meters.sewage, game.utilities.sewageRatio);

            const u = game.utilities;
            note.textContent =
                `⚡ ${Math.round(u.powerSupply)} / ${Math.round(u.powerDemand)} MW · ` +
                `💧 ${Math.round(u.waterSupply)} / ${Math.round(u.waterDemand)} m³ · ` +
                `🚱 ${Math.round(u.sewageCapacity)} / ${Math.round(u.sewageProduced)} m³`;

            for (const item of milestoneItems) {
                item.classList.toggle('reached', Number(item.dataset.milestone) <= game.milestones.level);
            }
        };
    }

    // --- menu ------------------------------------------------------------------------

    _renderMenu() {
        this._shell('☰', 'City Menu', `
            <section class="panel-section">
                <div class="menu-grid">
                    ${CITY_MENU.map(entry => `
                        <button class="menu-btn ${entry.danger ? 'danger' : ''}" type="button" data-menu="${entry.id}">
                            <span>${entry.icon}</span>${entry.label}
                        </button>`).join('')}
                    <button class="menu-btn" type="button" data-menu="mute">
                        <span data-mute-icon>${this.ui.audio.muted ? '🔇' : '🔊'}</span>Sound
                    </button>
                </div>
            </section>
            <section class="panel-section">
                <h3>Controls</h3>
                <ul class="keylist">
                    <li><kbd>Left drag</kbd> use tool / select</li>
                    <li><kbd>Right drag</kbd> pan the camera</li>
                    <li><kbd>Wheel</kbd> zoom to cursor</li>
                    <li><kbd>WASD</kbd> move the camera</li>
                    <li><kbd>Space</kbd> pause · <kbd>Esc</kbd> cancel tool</li>
                    <li><kbd>1</kbd>–<kbd>7</kbd> toolbar · <kbd>T</kbd> data views</li>
                    <li><kbd>B</kbd> budget · <kbd>I</kbd> city info · <kbd>M</kbd> menu</li>
                </ul>
            </section>
            <p class="panel-note">The city autosaves every minute.</p>`);

        this.root.querySelector('.menu-grid').addEventListener('click', (event) => {
            const button = event.target.closest('[data-menu]');
            if (button) this.ui.handleMenuAction(button.dataset.menu);
        });
    }
}

function statCell(label, key) {
    return `<div class="stat-cell"><span class="stat-cell-label">${label}</span><span class="stat-cell-value" data-stat="${key}">–</span></div>`;
}

function meterRow(label, key, inverse = false) {
    return `
        <div class="meter-row">
            <span class="meter-label">${label}</span>
            <span class="meter-track"><i data-meter="${key}" class="${inverse ? 'inverse' : ''}"></i></span>
        </div>`;
}

function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
}

function setMeter(el, ratio) {
    if (!el) return;
    const pct = `${Math.round(clamp01(ratio) * 100)}%`;
    if (el.style.width !== pct) el.style.width = pct;
    const good = el.classList.contains('inverse') ? 1 - clamp01(ratio) : clamp01(ratio);
    el.dataset.level = good > 0.66 ? 'good' : good > 0.34 ? 'warn' : 'bad';
}

// --- selection card ---------------------------------------------------------------------

export class SelectionCard {
    constructor(root, ui) {
        this.root = root;
        this.ui = ui;
        this.selection = null;

        this.root.addEventListener('click', (event) => {
            if (event.target.closest('[data-action="close"]')) this.show(null);
            if (event.target.closest('[data-action="demolish"]')) this._demolish();
        });
    }

    show(selection) {
        this.selection = selection;
        if (!selection) {
            this.root.classList.remove('open');
            this.root.innerHTML = '';
            return;
        }
        this.root.classList.add('open');
        this.render();
    }

    _demolish() {
        const selection = this.selection;
        if (!selection) return;
        this.ui.game.bulldoze([{ x: selection.x, y: selection.y }]);
        this.ui.tools.clearSelection();
        this.show(null);
    }

    render() {
        const selection = this.selection;
        if (!selection) return;
        const game = this.ui.game;
        const index = selection.y * game.cityMap.width + selection.x;

        let title = '', icon = '📍', rows = [];

        if (selection.kind === 'building') {
            const b = selection.ref;
            icon = b.isResidential ? '🏠' : b.isCommercial ? '🏬' : '🏗️';
            title = `${b.zone[0].toUpperCase() + b.zone.slice(1)} · Level ${b.level}`;
            rows = [
                [b.isResidential ? 'Residents' : 'Workers', `${Math.round(b.occupants)} / ${b.capacity}`],
                ['Happiness', `${Math.round(b.happiness * 100)}%`],
                ['Land value', `${Math.round(b.landValue * 100)}%`],
                ['Electricity', b.powered ? '✅ connected' : '❌ none'],
                ['Water', b.watered ? '✅ connected' : '❌ none'],
                ['Monthly tax', formatMoney(b.monthlyTax(game.economy.taxes[b.zone], game.fields.averages.education))]
            ];
            if (b.abandoned) rows.push(['Status', '🏚️ abandoned']);
            else if (b.complaint) rows.push(['Complaint', b.complaint]);
        } else if (selection.kind === 'service') {
            const s = selection.ref;
            icon = s.icon;
            title = s.name;
            rows = [
                ['Status', s.operational ? '✅ operating' : '⚠️ needs utilities'],
                ['Upkeep', `${formatMoney(s.upkeep)}/mo`]
            ];
            if (s.def?.power) rows.push(['Output', `${s.def.power} MW`]);
            if (s.def?.water) rows.push(['Output', `${s.def.water} m³ water`]);
            if (s.def?.sewage) rows.push(['Treats', `${s.def.sewage} m³ sewage`]);
            if (s.def?.radius) rows.push(['Coverage', `${s.def.radius} tiles`]);
            if (s.powerDemand) rows.push(['Uses', `${s.powerDemand} MW`]);
        } else {
            const tile = selection.ref;
            icon = tile.isWater ? '🌊' : tile.road ? '🛣️' : tile.isForest ? '🌲' : '🟩';
            title = tile.road
                ? (tile.road.type === 'avenue' ? 'Four-lane Avenue' : 'Two-lane Street')
                : tile.zone ? `${tile.zone[0].toUpperCase() + tile.zone.slice(1)} lot (empty)`
                : tile.isWater ? 'Water' : tile.isForest ? 'Forest' : tile.isRock ? 'Rocky ground' : 'Open land';
            rows = [
                ['Coordinates', `${selection.x}, ${selection.y}`],
                ['Land value', `${Math.round(game.fields.landValue[index] * 100)}%`],
                ['Pollution', `${Math.round(game.fields.pollution[index] * 100)}%`],
                ['Electricity', tile.powered ? '✅' : '❌'],
                ['Water', tile.watered ? '✅' : '❌']
            ];
            if (tile.road) rows.push(['Congestion', `${Math.round(tile.road.congestion * 100)}%`]);
        }

        this.root.innerHTML = `
            <header class="card-head">
                <span class="card-icon">${icon}</span>
                <h3>${title}</h3>
                <button type="button" data-action="close" aria-label="Close">×</button>
            </header>
            <dl class="card-rows">
                ${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
            </dl>
            <button class="card-demolish" type="button" data-action="demolish">💣 Demolish</button>`;
    }
}
