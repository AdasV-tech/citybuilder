// js/ui/UIManager.js
// Top-level UI coordinator. Owns the ToolController (also used by InputHandler),
// the Toolbar, the InfoBar, and a tiny toast system for feedback like
// "Not enough money" or "Saved!".

import { ToolController } from './ToolController.js';
import { Toolbar } from './Toolbar.js';
import { InfoBar } from './InfoBar.js';
import { eventBus } from '../utils/EventBus.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.toolController = new ToolController(game);

        this.toolbarEl = document.getElementById('toolbar');
        this.infoBarEl = document.getElementById('info-bar');
        this.toastEl = document.getElementById('toast');

        this.toolbar = new Toolbar(this.toolbarEl, this.toolController, game);
        this.infoBar = new InfoBar(this.infoBarEl, game);

        this._bindEvents();
    }

    _bindEvents() {
        eventBus.on('ui:toast', (msg) => this.showToast(msg));
    }

    showToast(message, duration = 2200) {
        if (!this.toastEl) return;
        this.toastEl.textContent = message;
        this.toastEl.classList.add('visible');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this.toastEl.classList.remove('visible');
        }, duration);
    }

    update() {
        this.infoBar.update();
    }
}
