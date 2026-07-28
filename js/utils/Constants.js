// js/utils/Constants.js
// Central place for tunable numbers. Change these to re-balance the whole game.

export const TILE_SIZE = 32; // world pixels per tile at zoom = 1

export const MAP_WIDTH = 90;  // tiles
export const MAP_HEIGHT = 90; // tiles

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 0.001; // per wheel-delta unit

export const CAMERA_DRAG_BUTTON = 2; // right mouse button pans; left is reserved for tools
export const CAMERA_PAN_SPEED = 900; // px/sec when using keyboard edge-pan (px, unscaled)

// --- Simulation speeds -----------------------------------------------------
// 1 "day" length in milliseconds for each speed setting.
export const DAY_LENGTH_MS = {
    fast: 4000,
    normal: 8000,
    slow: 14000
};

// --- Economy ----------------------------------------------------------------
export const STARTING_MONEY = 20000;

export const COST_ROAD_TILE = 20;
export const COST_ZONE_TILE = 10;
export const COST_BULLDOZE = 0;

export const TAX_RATE_RESIDENTIAL = 1.4; // money per citizen per day
export const TAX_RATE_COMMERCIAL = 2.0;  // money per job per day
export const TAX_RATE_INDUSTRIAL = 1.6;  // money per job per day
export const ROAD_UPKEEP_PER_TILE = 0.15; // money per day per road tile

// --- Zoning / growth ---------------------------------------------------------
export const ZONE_TYPES = Object.freeze({
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial'
});

export const GROWTH_TIME_MS = 6000;        // base time (at normal speed) for a zoned lot to build
export const UPGRADE_CHECK_INTERVAL_MS = 10000; // how often buildings re-evaluate upgrading
export const MAX_BUILDING_LEVEL = 3;

export const BUILDING_CAPACITY = {
    residential: [4, 9, 16],   // population per level
    commercial: [3, 6, 10],    // jobs per level
    industrial: [4, 8, 14]     // jobs per level
};

// --- Traffic -----------------------------------------------------------------
export const MAX_CARS = 160;
export const CAR_SPEED = 2.6;       // tiles per second
export const CAR_MIN_GAP = 0.55;    // tiles, following distance
export const COMMUTE_MORNING_START = 0.20; // fraction of day
export const COMMUTE_MORNING_END = 0.45;
export const COMMUTE_EVENING_START = 0.62;
export const COMMUTE_EVENING_END = 0.90;

// --- Terrain generation --------------------------------------------------------
export const TREE_DENSITY = 0.06;
export const LAKE_COUNT = 1;
export const RIVER_WIDTH = 3;

// --- Colors --------------------------------------------------------------------
export const COLORS = {
    grass: '#7fb069',
    grassAlt: '#77a862',
    water: '#4a90c4',
    waterShore: '#5fa3d3',
    tree: '#4c7a3c',
    treeTrunk: '#5b3a26',
    road: '#3b3b42',
    roadLine: '#e8c94a',
    roadEdge: '#26262c',
    zoneResidential: 'rgba(94, 194, 105, 0.45)',
    zoneCommercial: 'rgba(70, 140, 220, 0.45)',
    zoneIndustrial: 'rgba(224, 178, 60, 0.45)',
    buildingResidential: '#5ec269',
    buildingCommercial: '#4c8cdc',
    buildingIndustrial: '#e0b23c',
    buildingRoof: '#2c2c33',
    bulldozeHighlight: 'rgba(220, 60, 60, 0.35)',
    gridLine: 'rgba(0,0,0,0.06)'
};
