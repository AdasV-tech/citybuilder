// js/main.js
// Entry point. Boots the game once the DOM exists and surfaces any startup
// failure on screen instead of leaving the player looking at a black canvas.

import { Game } from './engine/Game.js';

function boot() {
    const canvas = document.getElementById('game-canvas');
    try {
        const game = new Game(canvas);
        game.start();
        window.__game = game;   // handy from the browser console
    } catch (error) {
        const panel = document.getElementById('boot-error');
        if (panel) {
            panel.hidden = false;
            panel.textContent = `CityBuilder failed to start:\n\n${error?.stack ?? error}`;
        }
        throw error;
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
