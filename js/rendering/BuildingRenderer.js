// js/rendering/BuildingRenderer.js
// Blits building sprites in north-to-south order so taller buildings correctly
// overlap the ones behind them, and stamps status badges (no power, no water,
// abandoned) on top when the camera is close enough to read them.

import { TILE_SIZE, GROWTH_TIME_MS, COLORS } from '../utils/Constants.js';
import { getBuildingSprite, getServiceSprite, getConstructionSprite } from './BuildingSprites.js';

export function drawBuildings(ctx, cityMap, bounds, options) {
    const { night = false, zoom = 1 } = options;
    const showBadges = zoom > 0.75;
    const drawnStructures = options.structureScratch ?? new Set();
    drawnStructures.clear();

    for (let y = bounds.minY; y <= bounds.maxY; y++) {
        for (let x = bounds.minX; x <= bounds.maxX; x++) {
            const tile = cityMap.getTile(x, y);
            if (!tile) continue;
            const px = x * TILE_SIZE, py = y * TILE_SIZE;

            if (tile.structure) {
                if (!drawnStructures.has(tile.structure)) {
                    drawnStructures.add(tile.structure);
                    drawStructure(ctx, tile.structure, showBadges);
                }
                continue;
            }

            if (tile.building) {
                drawZonedBuilding(ctx, tile.building, px, py, night, showBadges);
            } else if (tile.zone && tile.growth > 0) {
                drawConstruction(ctx, tile, px, py);
            }
        }
    }
}

function drawZonedBuilding(ctx, building, px, py, night, showBadges) {
    if (building.abandoned) {
        drawAbandoned(ctx, px, py);
        return;
    }
    const lit = night && building.occupants > 0;
    const sprite = getBuildingSprite(building.zone, building.level, building.variant, lit);
    ctx.drawImage(sprite.canvas, px, py - sprite.offsetY, sprite.width, sprite.height);

    if (showBadges) {
        if (!building.powered) drawBadge(ctx, px + TILE_SIZE - 7, py - sprite.offsetY + 6, COLORS.power, '⚡');
        else if (!building.watered) drawBadge(ctx, px + TILE_SIZE - 7, py - sprite.offsetY + 6, COLORS.waterLine, '💧');
        else if (building.happiness < 0.32) drawBadge(ctx, px + TILE_SIZE - 7, py - sprite.offsetY + 6, COLORS.bad, '!');
    }
}

function drawStructure(ctx, structure, showBadges) {
    const sprite = getServiceSprite(structure.defId);
    const px = structure.x * TILE_SIZE, py = structure.y * TILE_SIZE;
    if (!sprite) {
        ctx.fillStyle = '#8d949c';
        ctx.fillRect(px, py, structure.size * TILE_SIZE, structure.size * TILE_SIZE);
        return;
    }
    ctx.drawImage(sprite.canvas, px, py - sprite.offsetY, sprite.width, sprite.height);

    if (showBadges && !structure.operational) {
        drawBadge(ctx, px + structure.size * TILE_SIZE - 8, py - sprite.offsetY + 7, COLORS.bad, '!');
    }
}

function drawConstruction(ctx, tile, px, py) {
    const sprite = getConstructionSprite();
    ctx.drawImage(sprite.canvas, px, py - sprite.offsetY, sprite.width, sprite.height);

    const progress = Math.min(1, tile.growth / GROWTH_TIME_MS);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(px + 4, py + TILE_SIZE - 6, TILE_SIZE - 8, 3);
    ctx.fillStyle = COLORS.warn;
    ctx.fillRect(px + 4, py + TILE_SIZE - 6, (TILE_SIZE - 8) * progress, 3);
}

function drawAbandoned(ctx, px, py) {
    ctx.fillStyle = 'rgba(90, 84, 76, 0.85)';
    ctx.fillRect(px + 5, py + 7, TILE_SIZE - 10, TILE_SIZE - 12);
    ctx.strokeStyle = 'rgba(40, 36, 32, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 8); ctx.lineTo(px + TILE_SIZE - 6, py + TILE_SIZE - 6);
    ctx.moveTo(px + TILE_SIZE - 6, py + 8); ctx.lineTo(px + 6, py + TILE_SIZE - 6);
    ctx.stroke();
}

function drawBadge(ctx, cx, cy, color, glyph) {
    ctx.fillStyle = 'rgba(20, 26, 34, 0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = 'bold 8px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, cx, cy + 0.5);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
}
