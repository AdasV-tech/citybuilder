// js/rendering/BuildingSprites.js
// Buildings are drawn once into small offscreen canvases and then blitted, so a
// city of thousands of buildings costs one drawImage each instead of dozens of
// path operations. Sprites are rendered at 2x world resolution so they stay
// crisp when the player zooms in.
//
// The look is "top-down with a bit of lift": a drop shadow, two shaded wall
// faces pushed south-east, and a detailed roof — enough parallax to read as a
// city skyline from above without needing real 3D.

import { TILE_SIZE, COLORS, MAX_BUILDING_LEVEL } from '../utils/Constants.js';
import { SERVICES } from '../data/ServiceCatalog.js';

const SCALE = 2;                    // sprite pixels per world pixel
const S = TILE_SIZE * SCALE;        // sprite pixels per tile
const VARIANTS = 4;

const cache = new Map();

function createCanvas(width, height) {
    // OffscreenCanvas where available, DOM canvas otherwise.
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    return canvas;
}

/** @returns {{canvas, offsetY: number, width: number, height: number}} */
function makeSprite(tilesWide, liftWorldPx) {
    const lift = liftWorldPx * SCALE;
    const canvas = createCanvas(tilesWide * S, tilesWide * S + lift);
    const ctx = canvas.getContext('2d');
    return {
        canvas, ctx,
        offsetY: liftWorldPx,                       // draw at (px, py - offsetY)
        width: tilesWide * TILE_SIZE,
        height: tilesWide * TILE_SIZE + liftWorldPx
    };
}

// --- shared drawing helpers -------------------------------------------------

/**
 * An extruded box seen from slightly north of straight-down.
 * (x, y) is the south-west corner of the footprint on the ground; `d` is how
 * deep the footprint runs north, `height` how far the roof is lifted.
 * Returns the roof rectangle so callers can decorate it.
 */
function drawBox(ctx, x, y, w, d, height, wallColor, roofColor) {
    const roofY = y - height - d;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.20)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2 + w * 0.06, y - d * 0.18, w * 0.58, d * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // south-facing wall
    ctx.fillStyle = shade(wallColor, -0.30);
    ctx.fillRect(x, y - height, w, height);
    // a lighter sliver on the west edge reads as a second face
    ctx.fillStyle = shade(wallColor, -0.12);
    ctx.fillRect(x, y - height, w * 0.14, height);

    ctx.fillStyle = roofColor;
    ctx.fillRect(x, roofY, w, d);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.fillRect(x + w * 0.86, roofY, w * 0.14, d);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.lineWidth = SCALE * 0.75;
    ctx.strokeRect(x + 0.5, roofY + 0.5, w - 1, d + height - 1);

    return { x, y: roofY, w, d, height };
}

function shade(hex, amount) {
    const value = parseInt(hex.slice(1), 16);
    const r = (value >> 16) & 255, g = (value >> 8) & 255, b = value & 255;
    const mix = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
    return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}

function windowGrid(ctx, x, y, w, h, cols, rows, lit) {
    const padX = w * 0.16, padY = h * 0.18;
    const cellW = (w - padX * 2) / cols, cellH = (h - padY * 2) / rows;
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const on = lit && ((row * 7 + col * 3) % 5 !== 0);
            ctx.fillStyle = on ? 'rgba(255, 226, 150, 0.92)' : 'rgba(40, 52, 68, 0.55)';
            ctx.fillRect(
                x + padX + col * cellW + cellW * 0.15,
                y + padY + row * cellH + cellH * 0.15,
                cellW * 0.7, cellH * 0.62
            );
        }
    }
}

// --- zoned buildings -----------------------------------------------------------

function drawResidential(sprite, level, variant, night) {
    const ctx = sprite.ctx;
    const wall = COLORS.building.residential[variant];
    const roof = COLORS.roof.residential[variant];
    const inset = S * 0.13;
    const w = S - inset * 2;
    const d = (S - inset * 2) * 0.62;
    const height = (3 + level * 3.4) * SCALE;
    const groundY = sprite.canvas.height - inset;

    // front garden
    ctx.fillStyle = 'rgba(104, 152, 78, 0.55)';
    ctx.fillRect(inset, groundY - d * 0.2, w, d * 0.2 + inset * 0.5);

    const box = drawBox(ctx, inset, groundY, w, d, height, wall, level <= 2 ? shade(roof, 0.05) : roof);

    if (level <= 2) {
        // Pitched roof over the flat one.
        ctx.fillStyle = roof;
        ctx.beginPath();
        ctx.moveTo(box.x - S * 0.05, box.y + box.d);
        ctx.lineTo(box.x + w / 2, box.y - d * 0.42);
        ctx.lineTo(box.x + w + S * 0.05, box.y + box.d);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = shade(roof, -0.22);
        ctx.fillRect(box.x - S * 0.05, box.y + box.d - S * 0.04, w + S * 0.1, S * 0.06);
        windowGrid(ctx, inset, groundY - height, w, height, 2, 1, night);
        // door
        ctx.fillStyle = '#6b4526';
        ctx.fillRect(inset + w * 0.44, groundY - height * 0.55, w * 0.16, height * 0.55);
    } else {
        windowGrid(ctx, inset, groundY - height, w, height, 3, Math.min(4, level), night);
        // rooftop stair box + railing
        ctx.fillStyle = shade(roof, -0.28);
        ctx.fillRect(box.x + w * 0.22, box.y + d * 0.22, w * 0.24, d * 0.4);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = SCALE;
        ctx.strokeRect(box.x + S * 0.04, box.y + S * 0.04, w - S * 0.08, d - S * 0.08);
    }
}

function drawCommercial(sprite, level, variant, night) {
    const ctx = sprite.ctx;
    const wall = COLORS.building.commercial[variant];
    const roof = COLORS.roof.commercial[variant];
    const inset = S * 0.09;
    const w = S - inset * 2;
    const d = (S - inset * 2) * 0.58;
    const height = (4 + level * 4.6) * SCALE;
    const groundY = sprite.canvas.height - inset;

    const box = drawBox(ctx, inset, groundY, w, d, height, wall, roof);

    // glass banding up the facade
    const floors = Math.min(7, level + 2);
    for (let i = 0; i < floors; i++) {
        const y = groundY - height + (height / floors) * i + height * 0.04;
        ctx.fillStyle = night ? 'rgba(255, 223, 150, 0.75)' : 'rgba(196, 228, 250, 0.62)';
        ctx.fillRect(inset + w * 0.1, y, w * 0.8, Math.max(SCALE, height / floors * 0.45));
    }
    // ground-floor awning
    ctx.fillStyle = ['#d0574d', '#3f9c6d', '#d09a3c', '#5f74c4'][variant];
    ctx.fillRect(inset, groundY - height * 0.14, w, height * 0.1);
    // rooftop plant
    ctx.fillStyle = shade(roof, -0.3);
    ctx.fillRect(box.x + w * 0.5, box.y + d * 0.2, w * 0.3, d * 0.5);
    if (level >= 4) {
        ctx.fillStyle = '#e05a4a';
        ctx.fillRect(box.x + w * 0.16, box.y + d * 0.24, w * 0.1, d * 0.1);
    }
}

function drawIndustrial(sprite, level, variant, night) {
    const ctx = sprite.ctx;
    const wall = COLORS.building.industrial[variant];
    const roof = COLORS.roof.industrial[variant];
    const inset = S * 0.07;
    const w = S - inset * 2;
    const d = (S - inset * 2) * 0.6;
    const height = (3 + level * 2.2) * SCALE;
    const groundY = sprite.canvas.height - inset;

    // concrete yard
    ctx.fillStyle = 'rgba(150, 145, 132, 0.55)';
    ctx.fillRect(inset, groundY - d * 0.28, w, d * 0.28 + inset * 0.6);

    const box = drawBox(ctx, inset, groundY, w, d, height, wall, roof);

    // saw-tooth roof
    ctx.fillStyle = shade(roof, 0.18);
    const teeth = 3;
    for (let i = 0; i < teeth; i++) {
        const tx = box.x + (w / teeth) * i;
        ctx.beginPath();
        ctx.moveTo(tx, box.y + d);
        ctx.lineTo(tx + (w / teeth) * 0.5, box.y + d * 0.25);
        ctx.lineTo(tx + w / teeth, box.y + d);
        ctx.closePath();
        ctx.fill();
    }
    // chimney rising above the roof
    const chimneyH = (10 + level * 3) * SCALE;
    ctx.fillStyle = '#8e8579';
    ctx.fillRect(box.x + w * 0.72, box.y - chimneyH, w * 0.14, chimneyH + d * 0.6);
    ctx.fillStyle = '#c25a4a';
    ctx.fillRect(box.x + w * 0.72, box.y - chimneyH, w * 0.14, S * 0.07);
    // loading bays
    ctx.fillStyle = night ? 'rgba(255, 214, 140, 0.8)' : 'rgba(58, 64, 72, 0.8)';
    for (let i = 0; i < 2; i++) {
        ctx.fillRect(inset + w * (0.12 + i * 0.26), groundY - height * 0.5, w * 0.18, height * 0.5);
    }
}

const ZONE_DRAWERS = {
    residential: drawResidential,
    commercial: drawCommercial,
    industrial: drawIndustrial
};

/** Sprite for a grown lot. `night` swaps in lit windows. */
export function getBuildingSprite(zone, level, variant, night = false) {
    const key = `b:${zone}:${level}:${variant}:${night ? 1 : 0}`;
    let sprite = cache.get(key);
    if (sprite) return sprite;

    const lift = 6 + level * 5;
    sprite = makeSprite(1, lift);
    const drawer = ZONE_DRAWERS[zone] ?? drawResidential;
    drawer(sprite, Math.min(level, MAX_BUILDING_LEVEL), variant % VARIANTS, night);
    cache.set(key, sprite);
    return sprite;
}

// --- construction site ----------------------------------------------------------

export function getConstructionSprite() {
    const key = 'construction';
    let sprite = cache.get(key);
    if (sprite) return sprite;
    sprite = makeSprite(1, 8);
    const ctx = sprite.ctx;
    const baseY = sprite.canvas.height - S * 0.12;
    // dirt pad
    ctx.fillStyle = 'rgba(146, 126, 96, 0.85)';
    ctx.fillRect(S * 0.1, baseY - S * 0.34, S * 0.8, S * 0.34);
    // foundation
    ctx.fillStyle = '#8a7a5c';
    ctx.fillRect(S * 0.18, baseY - S * 0.3, S * 0.64, S * 0.24);
    ctx.strokeStyle = '#d9b64a';
    ctx.lineWidth = SCALE * 1.2;
    ctx.setLineDash([SCALE * 3, SCALE * 3]);
    ctx.strokeRect(S * 0.14, baseY - S * 0.34, S * 0.72, S * 0.3);
    ctx.setLineDash([]);
    // crane
    ctx.fillStyle = '#c9a44a';
    ctx.fillRect(S * 0.44, baseY - S * 0.96, S * 0.07, S * 0.66);
    ctx.fillRect(S * 0.44, baseY - S * 0.96, S * 0.38, S * 0.07);
    cache.set(key, sprite);
    return sprite;
}

// --- service buildings -------------------------------------------------------------

const SERVICE_STYLE = {
    coal_plant: { wall: '#8d8378', roof: '#5c554c', accent: '#c25a4a' },
    wind_turbine: { wall: '#e8eef2', roof: '#d5dde3', accent: '#9fb4c4' },
    solar_farm: { wall: '#3d4a5c', roof: '#2b3646', accent: '#4f9fd8' },
    water_pump: { wall: '#a9c6d6', roof: '#7fa5bb', accent: '#4aa6d0' },
    water_tower: { wall: '#cfd8de', roof: '#9fb3c0', accent: '#4aa6d0' },
    sewage_outlet: { wall: '#9aa79a', roof: '#6f7d70', accent: '#7d9a6a' },
    treatment_plant: { wall: '#b4c0b8', roof: '#7e8c84', accent: '#54a87c' },
    police_station: { wall: '#4f6d99', roof: '#33496b', accent: '#e8e8f0' },
    fire_station: { wall: '#b6483c', roof: '#8a3229', accent: '#f0e0c0' },
    clinic: { wall: '#e4e9ee', roof: '#c2ccd4', accent: '#d05a5a' },
    school: { wall: '#d8c08a', roof: '#a8783f', accent: '#e8e4d8' },
    university: { wall: '#d5cbb4', roof: '#8f6f4a', accent: '#6f8fbf' },
    small_park: { wall: '#6ea24f', roof: '#5c8f42', accent: '#8fc26a' },
    plaza: { wall: '#cfc4a8', roof: '#b8ab8c', accent: '#6ea24f' },
    stadium: { wall: '#c9cdd4', roof: '#8f959f', accent: '#4f9fd8' }
};

function drawServiceSprite(def, sprite) {
    const ctx = sprite.ctx;
    const style = SERVICE_STYLE[def.id] ?? { wall: '#b0b6bc', roof: '#7d848b', accent: '#e0e0e0' };
    const tiles = def.size;
    const full = tiles * S;
    const inset = S * 0.10;
    const w = full - inset * 2;
    const d = (full - inset * 2) * 0.82;
    const baseY = sprite.canvas.height - inset;

    // Parks and open ground get a lawn instead of a building.
    const isOpenGround = def.id === 'small_park' || def.id === 'plaza';
    if (isOpenGround) {
        ctx.fillStyle = def.id === 'small_park' ? '#6ea24f' : '#cfc4a8';
        roundRect(ctx, inset * 0.5, baseY - full + inset, full - inset, full - inset * 1.5, S * 0.12);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.16)';
        ctx.lineWidth = SCALE;
        ctx.stroke();
        // trees / fountain
        ctx.fillStyle = def.id === 'small_park' ? '#3f6b38' : '#6ea24f';
        for (let i = 0; i < tiles * 2; i++) {
            const cx = inset + S * 0.3 + (i % 2) * full * 0.42;
            const cy = baseY - full * 0.75 + Math.floor(i / 2) * full * 0.32;
            ctx.beginPath();
            ctx.arc(cx, cy, S * 0.16, 0, Math.PI * 2);
            ctx.fill();
        }
        if (def.id === 'plaza') {
            ctx.fillStyle = '#7fc4e0';
            ctx.beginPath();
            ctx.arc(inset + w / 2, baseY - full * 0.5, S * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }
        return;
    }

    if (def.id === 'wind_turbine') {
        const cx = full / 2;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(cx + S * 0.1, baseY - S * 0.08, S * 0.24, S * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = style.wall;
        ctx.fillRect(cx - S * 0.05, baseY - S * 0.95, S * 0.1, S * 0.9);
        ctx.save();
        ctx.translate(cx, baseY - S * 0.95);
        for (let i = 0; i < 3; i++) {
            ctx.rotate((Math.PI * 2) / 3);
            ctx.fillStyle = style.roof;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(S * 0.06, -S * 0.55);
            ctx.lineTo(-S * 0.06, -S * 0.55);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        return;
    }

    const height = (def.id === 'stadium' ? 16 : def.size >= 3 ? 14 : 10) * SCALE;
    drawBox(ctx, inset, baseY, w, d, height, style.wall, style.roof);

    const roofTop = baseY - height - d;

    if (def.id === 'coal_plant') {
        for (let i = 0; i < 2; i++) {
            const cx = inset + w * (0.28 + i * 0.34);
            ctx.fillStyle = '#9a9088';
            ctx.fillRect(cx, roofTop - S * 0.55, S * 0.22, S * 0.62 + d * 0.4);
            ctx.fillStyle = style.accent;
            ctx.fillRect(cx, roofTop - S * 0.55, S * 0.22, S * 0.08);
        }
    } else if (def.id === 'solar_farm') {
        ctx.fillStyle = '#2c3b52';
        for (let row = 0; row < tiles; row++) {
            for (let col = 0; col < tiles; col++) {
                ctx.fillRect(inset + col * (w / tiles) + S * 0.08,
                             roofTop + row * (d / tiles) + S * 0.06,
                             w / tiles - S * 0.16, d / tiles - S * 0.14);
            }
        }
        ctx.fillStyle = 'rgba(120, 190, 240, 0.5)';
        ctx.fillRect(inset + S * 0.1, roofTop + S * 0.08, w - S * 0.2, d * 0.18);
    } else if (def.id === 'water_tower') {
        ctx.fillStyle = style.wall;
        ctx.beginPath();
        ctx.arc(inset + w / 2, roofTop + d * 0.4, w * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = style.accent;
        ctx.beginPath();
        ctx.arc(inset + w / 2, roofTop + d * 0.4, w * 0.22, 0, Math.PI * 2);
        ctx.fill();
    } else if (def.id === 'stadium') {
        ctx.fillStyle = '#4f8f4a';
        roundRect(ctx, inset + w * 0.14, roofTop + d * 0.16, w * 0.72, d * 0.68, S * 0.2);
        ctx.fill();
        ctx.strokeStyle = '#e8eef2';
        ctx.lineWidth = SCALE * 1.2;
        ctx.stroke();
    } else {
        // Generic civic building: roof plant + a coloured stripe on the facade.
        ctx.fillStyle = shade(style.roof, -0.2);
        ctx.fillRect(inset + w * 0.2, roofTop + d * 0.25, w * 0.28, d * 0.36);
        ctx.fillStyle = style.accent;
        ctx.fillRect(inset, baseY - d * 0.36, w, d * 0.14);
    }

    // Doorway so civic buildings read as enterable.
    ctx.fillStyle = 'rgba(50, 58, 68, 0.75)';
    ctx.fillRect(inset + w * 0.44, baseY - d * 0.22, w * 0.14, d * 0.2);
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

export function getServiceSprite(defId) {
    const key = `s:${defId}`;
    let sprite = cache.get(key);
    if (sprite) return sprite;
    const def = SERVICES.find(s => s.id === defId);
    if (!def) return null;
    sprite = makeSprite(def.size, def.id === 'wind_turbine' ? 20 : 16);
    drawServiceSprite(def, sprite);
    cache.set(key, sprite);
    return sprite;
}

export function clearSpriteCache() {
    cache.clear();
}
