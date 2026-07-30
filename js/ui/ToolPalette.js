// js/ui/ToolPalette.js
// The bottom bar: nothing but logos. Each logo opens a flyout containing the
// tools in that category, so the screen stays clear of the map while every
// tool is still one click away. The whole thing is generated from
// data/Toolbox.js — adding a building never means touching the DOM.

import { CATEGORIES, INFO_VIEWS } from '../data/Toolbox.js';
import { formatMoney } from '../utils/MathUtils.js';

export class ToolPalette {
    constructor(root, flyout, ui) {
        this.root = root;
        this.flyout = flyout;
        this.ui = ui;
        this.openCategory = null;
        this._buttons = new Map();     // categoryId -> button
        this._itemCards = new Map();   // itemId -> button

        this._buildRail();
        this._bindFlyout();
    }

    // --- construction -------------------------------------------------------

    _buildRail() {
        const frag = document.createDocumentFragment();

        for (const category of CATEGORIES) {
            frag.appendChild(this._railButton({
                id: category.id,
                icon: category.icon,
                label: category.label,
                hotkey: category.hotkey,
                kind: 'category'
            }));
        }

        const separator = document.createElement('span');
        separator.className = 'rail-sep';
        frag.appendChild(separator);

        const extras = [
            { id: 'views', icon: '📊', label: 'Data Views', hotkey: 'T', kind: 'panel' },
            { id: 'budget', icon: '💰', label: 'Budget & Taxes', hotkey: 'B', kind: 'panel' },
            { id: 'stats', icon: '📈', label: 'City Info', hotkey: 'I', kind: 'panel' },
            { id: 'menu', icon: '☰', label: 'City Menu', hotkey: 'M', kind: 'panel' }
        ];
        for (const extra of extras) frag.appendChild(this._railButton(extra));

        this.root.appendChild(frag);
    }

    _railButton({ id, icon, label, hotkey, kind }) {
        const button = document.createElement('button');
        button.className = 'rail-btn';
        button.dataset.id = id;
        button.dataset.kind = kind;
        button.type = 'button';
        button.setAttribute('aria-label', label);
        button.innerHTML = `
            <span class="rail-icon">${icon}</span>
            <span class="rail-tip">${label}${hotkey ? `<kbd>${hotkey}</kbd>` : ''}</span>`;
        button.addEventListener('click', () => {
            if (kind === 'category') this.toggleCategory(id);
            else this.ui.togglePanel(id);
        });
        this._buttons.set(id, button);
        return button;
    }

    _bindFlyout() {
        this.flyout.addEventListener('click', (event) => {
            const close = event.target.closest('.flyout-close');
            if (close) { this.close(); return; }

            const card = event.target.closest('.tool-card');
            if (!card) return;
            if (card.classList.contains('locked')) {
                this.ui.toast({ text: card.dataset.lockReason, kind: 'warn' });
                return;
            }
            if (card.dataset.view) this.ui.setDataView(card.dataset.view);
            else this.ui.selectToolById(card.dataset.item);
        });

        this.flyout.addEventListener('mouseover', (event) => {
            const card = event.target.closest('.tool-card');
            if (card?.dataset.blurb) this._setHint(card.dataset.blurb);
        });
    }

    // --- open / close ---------------------------------------------------------

    toggleCategory(id) {
        if (this.openCategory === id) { this.close(); return; }
        this.openCategory = id;
        this._renderCategory(CATEGORIES.find(c => c.id === id));
        this.flyout.classList.add('open');
        this._syncRail();
        this.ui.audio.playOpen();
    }

    openViews() {
        this.openCategory = 'views';
        this._renderViews();
        this.flyout.classList.add('open');
        this._syncRail();
    }

    close() {
        this.openCategory = null;
        this.flyout.classList.remove('open');
        this._syncRail();
    }

    // --- rendering ----------------------------------------------------------------

    _renderCategory(category) {
        if (!category) return;
        const peak = this.ui.game.milestones.peakPopulation;

        this.flyout.innerHTML = `
            <header class="flyout-head">
                <span class="flyout-icon">${category.icon}</span>
                <h2>${category.label}</h2>
                <button class="flyout-close" type="button" aria-label="Close">×</button>
            </header>
            <div class="flyout-items">
                ${category.items.map(item => this._itemCard(item, peak)).join('')}
            </div>
            <footer class="flyout-hint">Pick a tool, then drag on the map. Right-click or Esc cancels.</footer>`;

        this._itemCards.clear();
        for (const card of this.flyout.querySelectorAll('.tool-card')) {
            this._itemCards.set(card.dataset.item, card);
        }
        this.syncActiveItem();
    }

    _itemCard(item, peak) {
        const locked = item.unlockPop > peak;
        const cost = item.kind === 'service'
            ? formatMoney(item.cost)
            : item.cost > 0 ? `${formatMoney(item.cost)}/tile` : 'Free';
        const upkeep = item.upkeep ? `<span class="tool-upkeep">${formatMoney(item.upkeep)}/mo</span>` : '';

        return `
            <button class="tool-card ${locked ? 'locked' : ''}" type="button"
                    data-item="${item.id}"
                    data-blurb="${escapeAttr(locked ? `Unlocks at ${item.unlockPop.toLocaleString('en-US')} citizens` : item.blurb ?? '')}"
                    data-lock-reason="Unlocks at ${item.unlockPop.toLocaleString('en-US')} citizens">
                <span class="tool-icon">${item.icon}</span>
                <span class="tool-body">
                    <span class="tool-name">${item.label}</span>
                    <span class="tool-meta">${cost}${upkeep}</span>
                </span>
                ${locked ? '<span class="tool-lock">🔒</span>' : ''}
            </button>`;
    }

    _renderViews() {
        const active = this.ui.dataView;
        this.flyout.innerHTML = `
            <header class="flyout-head">
                <span class="flyout-icon">📊</span>
                <h2>Data Views</h2>
                <button class="flyout-close" type="button" aria-label="Close">×</button>
            </header>
            <div class="flyout-items views">
                ${INFO_VIEWS.map(view => `
                    <button class="tool-card view ${active === view.id ? 'active' : ''}" type="button"
                            data-view="${view.id}" data-blurb="${escapeAttr(view.label)}">
                        <span class="tool-icon">${view.icon}</span>
                        <span class="tool-body"><span class="tool-name">${view.label}</span></span>
                    </button>`).join('')}
            </div>
            <footer class="flyout-hint">Overlays colour the map by the data you pick.</footer>`;
    }

    _setHint(text) {
        const hint = this.flyout.querySelector('.flyout-hint');
        if (hint) hint.textContent = text;
    }

    _syncRail() {
        for (const [id, button] of this._buttons) {
            button.classList.toggle('open', this.openCategory === id || this.ui.openPanel === id);
        }
    }

    /** Highlight the rail category and card matching the armed tool. */
    syncActiveItem() {
        const active = this.ui.tools.activeTool;
        for (const [id, card] of this._itemCards) {
            card.classList.toggle('active', !!active && active.id === id);
        }
        for (const [id, button] of this._buttons) {
            button.classList.toggle('armed', !!active && active.categoryId === id);
        }
    }

    refresh() {
        this._syncRail();
        if (this.openCategory === 'views') this._renderViews();
        else if (this.openCategory) this._renderCategory(CATEGORIES.find(c => c.id === this.openCategory));
        else this.syncActiveItem();
    }
}

function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
