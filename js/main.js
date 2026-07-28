// js/main.js
// Entry point loaded as an ES module from index.html. Boots the Game once
// the canvas exists in the DOM.

import { Game } from './engine/Game.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    const game = new Game(canvas);
    game.start();

    // Handy for debugging from the browser console.
    window.__game = game;
});
