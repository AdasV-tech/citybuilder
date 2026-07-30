// js/rendering/CarRenderer.js
// Vehicles: a coloured body, a darker cabin, and headlights that only come on
// after dark. Cars are skipped entirely when zoomed far out — at that distance
// they're sub-pixel confetti and cost more than they add.

import { TILE_SIZE } from '../utils/Constants.js';
import { CAR_KIND } from '../traffic/Car.js';

const CAR_COLORS = ['#d6584c', '#4a86c8', '#e0b23c', '#6fbf73', '#b07fd0', '#e08a4c', '#dfe3e8', '#4a4f58'];
const TRUCK_COLORS = ['#c9cdd2', '#8a9298', '#6f7a84'];

export function drawCars(ctx, trafficManager, zoom, night) {
    const cars = trafficManager?.cars;
    if (!cars || cars.length === 0 || zoom < 0.55) return;

    const showDetail = zoom > 0.9;

    for (const car of cars) {
        const pos = car.getPosition();
        const px = pos.x * TILE_SIZE + TILE_SIZE / 2;
        const py = pos.y * TILE_SIZE + TILE_SIZE / 2;
        const isTruck = car.kind === CAR_KIND.TRUCK;
        const length = TILE_SIZE * (isTruck ? 0.52 : 0.38);
        const width = TILE_SIZE * (isTruck ? 0.24 : 0.2);

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pos.heading);

        if (showDetail) {
            ctx.fillStyle = 'rgba(0,0,0,0.22)';
            ctx.fillRect(-length / 2 + 1, -width / 2 + 1.5, length, width);
        }

        ctx.fillStyle = isTruck
            ? TRUCK_COLORS[car.id % TRUCK_COLORS.length]
            : CAR_COLORS[car.id % CAR_COLORS.length];
        ctx.fillRect(-length / 2, -width / 2, length, width);

        if (showDetail) {
            ctx.fillStyle = 'rgba(30, 40, 55, 0.75)';
            ctx.fillRect(-length * 0.1, -width / 2 + 1, length * 0.32, width - 2);
            if (night) {
                ctx.fillStyle = 'rgba(255, 240, 190, 0.95)';
                ctx.fillRect(length / 2 - 2, -width / 2, 2, width);
                ctx.fillStyle = 'rgba(255, 90, 70, 0.85)';
                ctx.fillRect(-length / 2, -width / 2, 1.5, width);
            }
        }
        ctx.restore();
    }
}
