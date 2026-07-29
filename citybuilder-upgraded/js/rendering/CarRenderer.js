// js/rendering/CarRenderer.js
// Draws each active car as a small oriented rectangle. Kept intentionally
// simple (no sprites) per the brief's "simple cars" visual style guidance.

import { TILE_SIZE } from '../utils/Constants.js';

const CAR_COLORS = ['#e0574d', '#4c8cdc', '#e0b23c', '#7fd17f', '#c47fe0', '#e08a4c'];

export function drawCars(ctx, trafficManager) {
    if (!trafficManager) return;
    for (const car of trafficManager.cars) {
        const pos = car.getPosition();
        const px = pos.x * TILE_SIZE, py = pos.y * TILE_SIZE;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pos.heading);

        const w = TILE_SIZE * 0.42, h = TILE_SIZE * 0.22;
        ctx.fillStyle = CAR_COLORS[car.id % CAR_COLORS.length];
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(w / 2 - 3, -h / 2 + 1, 2, h - 2); // headlight hint

        ctx.restore();
    }
}
