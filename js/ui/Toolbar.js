// js/ui/Toolbar.js
// Wires up the toolbar DOM buttons to the ToolController and Game. Pure DOM
// glue code — no game logic lives here.

export class Toolbar {
    constructor(rootEl, toolController, game, audio) {
        this.root = rootEl;
        this.tools = toolController;
        this.game = game;
        this.audio = audio;

        this.buttons = Array.from(this.root.querySelectorAll('[data-tool]'));
        this.speedButtons = Array.from(this.root.querySelectorAll('[data-speed]'));
        this.saveBtn = this.root.querySelector('[data-action="save"]');
        this.loadBtn = this.root.querySelector('[data-action="load"]');
        this.resetBtn = this.root.querySelector('[data-action="reset"]');
        this.pauseBtn = this.root.querySelector('[data-action="pause"]');

        this._bind();
        this.setActiveToolButton('none');
        this.setActiveSpeedButton(game.time.speed);
    }

    _bind() {
        for (const btn of this.buttons) {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                const next = this.tools.activeTool === tool ? 'none' : tool;
                this.tools.setTool(next);
                this.setActiveToolButton(next);
            });
        }

        for (const btn of this.speedButtons) {
            btn.addEventListener('click', () => {
                this.game.time.setSpeed(btn.dataset.speed);
                this.setActiveSpeedButton(btn.dataset.speed);
            });
        }

        this.saveBtn?.addEventListener('click', () => { this.game.saveGame(); this.audio?.playSave?.(); });
        this.loadBtn?.addEventListener('click', () => { this.game.loadGame(); this.audio?.playClick?.(); });
        // export/import buttons (added optionally in index.html)
        this.exportBtn = this.root.querySelector('[data-action="export"]');
        this.importBtn = this.root.querySelector('[data-action="import"]');
        this.exportBtn?.addEventListener('click', () => {
            const data = this.game.saveManager.save(this.game);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `citybuilder-save-${Date.now()}.json`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
            this.audio?.playClick?.();
        });
        this.importBtn?.addEventListener('click', () => {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'application/json';
            input.addEventListener('change', (ev) => {
                const f = ev.target.files && ev.target.files[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                    try {
                        const data = JSON.parse(r.result);
                        this.game.saveManager.applyTo(this.game, data);
                        this.game.infrastructure.rebuildNetworks();
                        this.game._refreshLoadedState();
                        this.audio?.playSave?.();
                    } catch (e) { eventBus.emit('ui:toast', 'Invalid save file'); }
                };
                r.readAsText(f);
            });
            input.click();
        });
        this.resetBtn?.addEventListener('click', () => {
            const confirmed = window.confirm('Are you sure you want to delete the whole save?');
            if (!confirmed) return;
            this.game.resetGameSaves();
        });
        this.pauseBtn?.addEventListener('click', () => {
            const paused = this.game.time.togglePaused();
            this.pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
            this.pauseBtn.classList.toggle('active', paused);
        });
    }

    setActiveToolButton(tool) {
        for (const btn of this.buttons) {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        }
    }

    setActiveSpeedButton(speed) {
        for (const btn of this.speedButtons) {
            btn.classList.toggle('active', btn.dataset.speed === speed);
        }
    }
}
