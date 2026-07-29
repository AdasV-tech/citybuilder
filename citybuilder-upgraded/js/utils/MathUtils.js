// js/utils/MathUtils.js
// Small stateless helpers used all over the codebase.

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function tileKey(x, y) {
    return `${x},${y}`;
}

export function keyToTile(key) {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
}

export function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

// Simple seedable PRNG (mulberry32) so terrain generation is deterministic per seed.
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Bresenham line between two tile coordinates (inclusive). Used for road dragging.
export function lineBetween(x0, y0, x1, y1) {
    const points = [];
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0, y = y0;
    while (true) {
        points.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
}

// Produces an "L-shaped" orthogonal path between two tiles (horizontal then vertical),
// which reads more naturally for road dragging than a raw diagonal Bresenham line.
export function orthogonalPath(x0, y0, x1, y1) {
    const points = [];
    let x = x0, y = y0;
    const stepX = x1 > x0 ? 1 : -1;
    while (x !== x1) { points.push({ x, y }); x += stepX; }
    const stepY = y1 > y0 ? 1 : -1;
    while (y !== y1) { points.push({ x, y }); y += stepY; }
    points.push({ x: x1, y: y1 });
    return points;
}
