// js/utils/MathUtils.js
// Small stateless helpers used all over the codebase.

export function clamp(value, min, max) {
    return value < min ? min : (value > max ? max : value);
}

export function clamp01(value) {
    return value < 0 ? 0 : (value > 1 ? 1 : value);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function smoothstep(t) {
    return t * t * (3 - 2 * t);
}

export function tileKey(x, y) {
    return `${x},${y}`;
}

export function keyToTile(key) {
    const i = key.indexOf(',');
    return { x: Number(key.slice(0, i)), y: Number(key.slice(i + 1)) };
}

export function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function distance(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

export function formatMoney(value) {
    const rounded = Math.round(value);
    const sign = rounded < 0 ? '-' : '';
    return `${sign}§${Math.abs(rounded).toLocaleString('en-US')}`;
}

export function formatCompact(value) {
    const n = Math.round(value);
    if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (Math.abs(n) >= 10000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString('en-US');
}

// Simple seedable PRNG (mulberry32) so terrain generation is deterministic.
export function makeRng(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Deterministic value-noise sampler over a lattice. Cheap, dependency free and
 * good enough for terrain shapes; fBm-style octaves are layered by the caller.
 */
export function makeNoise2D(seed) {
    const rng = makeRng(seed);
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

    const grad = (hash, x, y) => {
        // 8 evenly spread gradient directions
        switch (hash & 7) {
            case 0: return x + y;
            case 1: return x - y;
            case 2: return -x + y;
            case 3: return -x - y;
            case 4: return x;
            case 5: return -x;
            case 6: return y;
            default: return -y;
        }
    };

    return function noise(x, y) {
        const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255;
        const xf = x - Math.floor(x), yf = y - Math.floor(y);
        const u = smoothstep(xf), v = smoothstep(yf);
        const aa = perm[perm[xi] + yi];
        const ab = perm[perm[xi] + yi + 1];
        const ba = perm[perm[xi + 1] + yi];
        const bb = perm[perm[xi + 1] + yi + 1];
        const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
        const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
        return (lerp(x1, x2, v) + 1) * 0.5; // 0..1
    };
}

/** Layered noise: `octaves` passes at doubling frequency, halving amplitude. */
export function fbm(noise, x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += noise(x * freq, y * freq) * amp;
        norm += amp;
        amp *= gain;
        freq *= lacunarity;
    }
    return sum / norm;
}

// Bresenham line between two tile coordinates (inclusive).
export function lineBetween(x0, y0, x1, y1) {
    const points = [];
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (;;) {
        points.push({ x, y });
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return points;
}

/**
 * L-shaped orthogonal path between two tiles. `majorAxis` picks whether the
 * long leg runs horizontally or vertically first, which is what makes dragged
 * roads follow the direction the player is actually moving.
 */
export function orthogonalPath(x0, y0, x1, y1, majorAxis = 'auto') {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const horizontalFirst = majorAxis === 'x' ? true : majorAxis === 'y' ? false : dx >= dy;
    const points = [];
    let x = x0, y = y0;
    if (horizontalFirst) {
        const stepX = x1 > x0 ? 1 : -1;
        while (x !== x1) { points.push({ x, y }); x += stepX; }
        const stepY = y1 > y0 ? 1 : -1;
        while (y !== y1) { points.push({ x, y }); y += stepY; }
    } else {
        const stepY = y1 > y0 ? 1 : -1;
        while (y !== y1) { points.push({ x, y }); y += stepY; }
        const stepX = x1 > x0 ? 1 : -1;
        while (x !== x1) { points.push({ x, y }); x += stepX; }
    }
    points.push({ x: x1, y: y1 });
    return points;
}

/** Filled rectangle of tile coords between two corners. */
export function rectTiles(x0, y0, x1, y1) {
    const tiles = [];
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1);
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) tiles.push({ x, y });
    }
    return tiles;
}

/** Mix two "#rrggbb" colours; t = 0 returns a, t = 1 returns b. */
export function mixHex(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
    const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
    const r = Math.round(lerp(ar, br, t));
    const g = Math.round(lerp(ag, bg, t));
    const bl = Math.round(lerp(ab, bb, t));
    return `rgb(${r},${g},${bl})`;
}

/** Sample a colour ramp (array of hex strings) at t in 0..1. */
export function sampleRamp(ramp, t) {
    const clamped = clamp01(t);
    const scaled = clamped * (ramp.length - 1);
    const i = Math.min(ramp.length - 2, Math.floor(scaled));
    return mixHex(ramp[i], ramp[i + 1], scaled - i);
}
