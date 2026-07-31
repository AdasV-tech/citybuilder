// js/rendering/PedestrianRenderer.js
// Tiny walking figures on the sidewalk. Only worth drawing once the player is
// zoomed in close enough to actually see them — from any distance out a
// pedestrian is smaller than a car and would just read as flickering dust.

import { TILE_SIZE, PEDESTRIAN_ZOOM_MIN } from '../utils/Constants.js';

const SHIRT_COLORS = ['#d6584c', '#4a86c8', '#e0b23c', '#6fbf73', '#b07fd0', '#e08a4c', '#caa06a', '#8fa0ac'];

export function drawPedestrians(ctx, pedestrianManager, zoom) {
    const people = pedestrianManager?.pedestrians;
    if (!people || people.length === 0 || zoom < PEDESTRIAN_ZOOM_MIN) return;

    const bodyRadius = TILE_SIZE * 0.055;
    const headRadius = TILE_SIZE * 0.038;

    for (const person of people) {
        const pos = person.getPosition();
        const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
        const py = pos.y * TILE_SIZE + TILE_SIZE / 2;

        ctx.save();
        ctx.translate(px, py);

        ctx.fillStyle = 'rgba(0,0,0,0.24)';
        ctx.beginPath();
        ctx.ellipse(0.6, bodyRadius * 0.7, bodyRadius * 1.05, bodyRadius * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = SHIRT_COLORS[person.id % SHIRT_COLORS.length];
        ctx.beginPath();
        ctx.arc(0, 0, bodyRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#e8c9a0';
        ctx.beginPath();
        ctx.arc(0, -bodyRadius * 1.3, headRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}
