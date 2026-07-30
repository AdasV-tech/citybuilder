// js/ui/UIManager.js
// Owns every piece of interface and the state that connects them: which tool is
// armed, which flyout or panel is open, which data view is painted on the map.
//
// All the DOM refresh work is rate-limited here rather than in each widget: the
// HUD ticks a few times a second, panels less often, and nothing re-renders
// while it's closed.

import { ToolController } from './ToolController.js';
import { ToolPalette } from './ToolPalette.js';
import { HUD } from './HUD.js';
import { PanelHost, SelectionCard } from './Panels.js';
import { Notifications } from './Notifications.js';
import { AudioManager } from '../audio/AudioManager.js';
import { getToolItem, CATEGORIES } from '../data/Toolbox.js';
import { formatMoney } from '../utils/MathUtils.js';
import { eventBus } from '../utils/EventBus.js';

const HUD_INTERVAL_MS = 120;
const PANEL_INTERVAL_MS = 320;

export class UIManager {
    constructor(game) {
        this.game = game;
        this.tools = new ToolController(game);
        this.audio = new AudioManager();
        this.dataView = 'none';
        this.openPanel = null;

        this.hudEl = document.getElementById('hud');
        this.railEl = document.getElementById('toolbar');
        this.flyoutEl = document.getElementById('flyout');
        this.panelEl = document.getElementById('panel');
        this.cardEl = document.getElementById('selection-card');
        this.feedEl = document.getElementById('notifications');
        this.toastEl = document.getElementById('toast');
        this.tipEl = document.getElementById('cursor-tip');

        this.hud = new HUD(this.hudEl, this);
        this.palette = new ToolPalette(this.railEl, this.flyoutEl, this);
        this.panels = new PanelHost(this.panelEl, this);
        this.card = new SelectionCard(this.cardEl, this);
        this.notifications = new Notifications(this.feedEl, this.toastEl, this.audio);

        this._hudTimer = 0;
        this._panelTimer = 0;
        this._pointer = { x: 0, y: 0 };

        this._bindEvents();
    }

    _bindEvents() {
        eventBus.on('ui:toast', (payload) => this.notifications.toast(payload));
        eventBus.on('ui:notify', (payload) => this.notifications.notify(payload));
        eventBus.on('ui:problemResolved', (id) => this.notifications.resolve(id));
        eventBus.on('ui:selection', (selection) => this.card.show(selection));
        eventBus.on('milestone:reached', () => this.palette.refresh());
        eventBus.on('tool:changed', () => {
            this.palette.syncActiveItem();
            this._updateCursorTip();
        });

        window.addEventListener('mousemove', (event) => {
            this._pointer.x = event.clientX;
            this._pointer.y = event.clientY;
        }, { passive: true });
    }

    // --- tools & views ---------------------------------------------------------

    selectToolById(id) {
        const item = getToolItem(id);
        if (!item) return;
        if (this.tools.activeTool?.id === id) { this.tools.clearTool(); return; }
        if (item.unlockPop > this.game.milestones.peakPopulation) {
            this.toast({ text: `Unlocks at ${item.unlockPop.toLocaleString('en-US')} citizens`, kind: 'warn' });
            return;
        }
        this.tools.setTool(item);
        this.audio.playClick();
    }

    setDataView(id) {
        this.dataView = id;
        this.palette.refresh();
        this.audio.playClick();
        this.toast({ text: id === 'none' ? 'Normal view' : `${id} view`, kind: 'info' });
    }

    togglePanel(id) {
        if (id === 'views') {
            if (this.palette.openCategory === 'views') this.palette.close();
            else this.palette.openViews();
            return;
        }
        this.openPanel = this.panels.openId === id ? null : id;
        this.panels.toggle(id);
        this.syncRail();
    }

    syncRail() {
        this.openPanel = this.panels.openId;
        this.palette._syncRail();
    }

    cancelCurrent() {
        if (this.tools.activeTool) { this.tools.clearTool(); this.palette.close(); return; }
        if (this.palette.openCategory) { this.palette.close(); return; }
        if (this.panels.openId) { this.panels.close(); return; }
        if (this.tools.selection) this.tools.clearSelection();
    }

    handleHotkey(key) {
        const lower = String(key).toLowerCase();
        const category = CATEGORIES.find(c => c.hotkey === key);
        if (category) { this.palette.toggleCategory(category.id); return; }

        switch (lower) {
            case 't': this.togglePanel('views'); break;
            case 'b': this.togglePanel('budget'); break;
            case 'i': this.togglePanel('stats'); break;
            case 'm': this.togglePanel('menu'); break;
            case 'x': this.selectToolById('bulldoze'); break;
            case '+': case '=': this.game.zoomBy(1.2); break;
            case '-': this.game.zoomBy(1 / 1.2); break;
            default: break;
        }
    }

    // --- menu actions -------------------------------------------------------------

    handleMenuAction(id) {
        const game = this.game;
        switch (id) {
            case 'save':
                game.saveGame();
                this.audio.playSave();
                break;
            case 'load':
                game.loadGame();
                break;
            case 'export':
                this._exportSave();
                break;
            case 'import':
                this._importSave();
                break;
            case 'newcity':
                if (confirm('Start a brand new city? Save yours first if you want to keep it.')) {
                    game.newCity();
                    this.panels.close();
                }
                break;
            case 'wipe':
                if (confirm('Delete all saved cities? This cannot be undone.')) {
                    const cleared = game.saveManager.clearAllSaves();
                    this.toast({ text: cleared ? 'Saved cities deleted' : 'No saves found', kind: cleared ? 'good' : 'warn' });
                }
                break;
            case 'mute': {
                const muted = this.audio.toggleMute();
                const icon = this.panelEl.querySelector('[data-mute-icon]');
                if (icon) icon.textContent = muted ? '🔇' : '🔊';
                break;
            }
            default: break;
        }
    }

    _exportSave() {
        const json = this.game.saveManager.exportSave(this.game);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.game.cityName.replace(/\s+/g, '-').toLowerCase()}-save.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        this.toast({ text: 'Save exported', kind: 'good' });
    }

    _importSave() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    this.game.applySave(JSON.parse(String(reader.result)));
                    this.toast({ text: 'City imported', kind: 'good' });
                } catch {
                    this.toast({ text: 'That file is not a valid save', kind: 'bad' });
                }
            };
            reader.readAsText(file);
        });
        input.click();
    }

    renameCity() {
        const name = prompt('Name your city', this.game.cityName);
        if (name && name.trim()) {
            this.game.cityName = name.trim().slice(0, 28);
            this.hud.update();
        }
    }

    toast(payload) { this.notifications.toast(payload); }

    // --- frame -----------------------------------------------------------------------

    update(dtMs) {
        this._hudTimer += dtMs;
        if (this._hudTimer >= HUD_INTERVAL_MS) {
            this._hudTimer = 0;
            this.hud.update();
            this.notifications.update();
            this._updateCursorTip();
        }

        this._panelTimer += dtMs;
        if (this._panelTimer >= PANEL_INTERVAL_MS) {
            this._panelTimer = 0;
            if (this.panels.openId) this.panels.update();
            if (this.card.selection) this.card.render();
        }
    }

    /** Little cost readout that follows the cursor while a tool is armed. */
    _updateCursorTip() {
        const tool = this.tools.activeTool;
        const tip = this.tipEl;
        if (!tip) return;

        if (!tool || !this.tools.hover) {
            if (tip.classList.contains('visible')) tip.classList.remove('visible');
            return;
        }

        const preview = this.tools.preview;
        const cost = preview?.cost ?? 0;
        const invalid = preview?.footprint ? !preview.footprint.valid
            : preview?.tiles?.length ? !preview.tiles.some(t => t.valid) : false;

        tip.innerHTML = `<strong>${tool.icon} ${tool.label}</strong>
            <span>${invalid ? (preview?.reason ?? 'Cannot build here') : formatMoney(cost)}</span>`;
        tip.classList.toggle('bad', invalid);
        tip.classList.add('visible');
        tip.style.transform = `translate(${this._pointer.x + 18}px, ${this._pointer.y + 20}px)`;
    }

    refresh() {
        this.hud.update();
        this.palette.refresh();
        if (this.panels.openId) this.panels.update();
        this.card.show(this.tools.selection);
    }
}
