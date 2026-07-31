// js/utils/Constants.js
// Single source of truth for tuning numbers and the shared colour palette.
// Anything a designer would want to re-balance lives here, not in system code.

// --- World ------------------------------------------------------------------
export const TILE_SIZE = 32;   // world pixels per tile at zoom 1
export const MAP_SIZE = 96;    // tiles per side (square map)
export const CHUNK_TILES = 16; // terrain cache granularity

export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 3.2;
export const ZOOM_STEP = 0.0016;      // per wheel-delta unit
export const CAMERA_SMOOTHING = 14;   // higher = snappier
export const KEY_PAN_SPEED = 900;     // css px/sec

// --- Terrain ------------------------------------------------------------------
export const TERRAIN = Object.freeze({
    GRASS: 0,
    WATER: 1,
    FOREST: 2,
    SHORE: 3,
    ROCK: 4
});

// --- Time ---------------------------------------------------------------------
// One in-game day at speed 1. Speeds 2 and 3 multiply the rate.
export const DAY_LENGTH_MS = 9000;
export const SPEED_MULTIPLIERS = [0, 1, 2.5, 5]; // index = speed setting (0 = paused)
export const DAYS_PER_MONTH = 30;
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// --- Economy --------------------------------------------------------------------
export const STARTING_MONEY = 70000;
export const LOAN_LIMIT = 60000;

export const COST_PER_TILE = {
    street: 24,
    avenue: 70,
    zone: 12,
    pipe: 18,
    wire: 16,
    bulldoze: 4
};

export const UPKEEP_PER_TILE = {
    street: 0.10,
    avenue: 0.28,
    pipe: 0.03,
    wire: 0.03
};

// Monthly tax take per occupant at the default 9% rate.
export const TAX_BASE = {
    residential: 1.9,
    commercial: 2.4,
    industrial: 2.1
};
export const TAX_RATE_DEFAULT = 0.09;
export const TAX_RATE_MIN = 0.01;
export const TAX_RATE_MAX = 0.20;
// Tax rate people consider "fair"; anything above starts hurting happiness.
export const TAX_RATE_COMFORT = 0.10;

// --- Zoning / growth -------------------------------------------------------------
export const ZONE = Object.freeze({
    RESIDENTIAL: 'residential',
    COMMERCIAL: 'commercial',
    INDUSTRIAL: 'industrial'
});

export const ZONE_LIST = [ZONE.RESIDENTIAL, ZONE.COMMERCIAL, ZONE.INDUSTRIAL];

export const GROWTH_TIME_MS = 5200;      // base build time for a lot
export const MAX_BUILDING_LEVEL = 5;
export const LEVEL_UP_INTERVAL_MS = 9000;
export const ABANDON_WINDOW_MS = 26000;  // sustained misery before a lot is abandoned

// Occupants per level (index = level - 1).
export const BUILDING_CAPACITY = {
    residential: [4, 9, 17, 28, 44],
    commercial: [3, 7, 13, 21, 32],
    industrial: [5, 10, 18, 29, 42]
};

// Land value needed to reach each level.
export const LEVEL_LAND_VALUE = [0, 0.22, 0.42, 0.62, 0.80];

// --- Utilities --------------------------------------------------------------------
export const POWER_PER_OCCUPANT = 0.9;   // MW per occupant
export const WATER_PER_OCCUPANT = 0.7;   // m³ per occupant
export const SEWAGE_RATIO = 0.85;        // fraction of water use returning as sewage

// --- Services ---------------------------------------------------------------------
export const SERVICE_FIELDS = ['police', 'fire', 'health', 'education', 'leisure'];

// --- Traffic -----------------------------------------------------------------------
export const MAX_CARS = 260;
export const CAR_SPEED = { street: 2.4, avenue: 3.6 }; // tiles per second
export const CAR_MIN_GAP = 0.5;
export const ROAD_CAPACITY = { street: 3, avenue: 7 }; // cars per tile before congestion
export const COMMUTE_WINDOWS = [
    { start: 0.26, end: 0.44, direction: 'toWork' },
    { start: 0.62, end: 0.84, direction: 'toHome' }
];

// --- Pedestrians --------------------------------------------------------------------
export const MAX_PEDESTRIANS = 150;
export const PEDESTRIAN_SPEED = 0.9;       // tiles per second, walking pace
export const PEDESTRIAN_MIN_GAP = 0.16;
export const SIDEWALK_OFFSET = 0.42;       // tile-units from the road centreline
export const WALK_MAX_TILES = 24;          // longer than this and nobody bothers on foot
export const PEDESTRIAN_ZOOM_MIN = 1.35;   // only rendered once the player is zoomed in past the default view

// --- Simulation cadence ---------------------------------------------------------------
export const FIELD_REBUILD_MS = 1400;   // land value / pollution / coverage refresh
export const UTILITY_REBUILD_MS = 900;  // power + water flood fill refresh
export const AUTOSAVE_MS = 60000;

// --- Palette ------------------------------------------------------------------------
export const COLORS = {
    void: '#0e1620',
    grass: '#6f9a53',
    grassDark: '#628c49',
    grassLight: '#7dab5e',
    forest: '#3f6b38',
    forestDark: '#325a2d',
    shore: '#c9bd8b',
    rock: '#8d8b84',
    water: '#2f6d99',
    waterDeep: '#255a80',
    waterShallow: '#3d84ad',

    asphalt: '#4a4e57',
    asphaltDark: '#3b3f47',
    sidewalk: '#9aa0a8',
    laneLine: '#e5e2d4',
    laneDash: '#f0d264',

    zone: {
        residential: 'rgba(104, 200, 108, 0.42)',
        commercial: 'rgba(74, 150, 232, 0.42)',
        industrial: 'rgba(232, 186, 66, 0.42)'
    },
    zoneSolid: {
        residential: '#68c86c',
        commercial: '#4a96e8',
        industrial: '#e8ba42'
    },
    building: {
        residential: ['#d9c9a8', '#cbb894', '#c4d3b3', '#d3c0a2'],
        commercial: ['#9fc4e8', '#8fb6df', '#b3d0ec', '#a8bdd6'],
        industrial: ['#c8bda4', '#bfae90', '#cdc3ad', '#b6a98e']
    },
    roof: {
        residential: ['#a4553f', '#8d4a38', '#b5614a', '#8a5b46'],
        commercial: ['#5a6b7d', '#4e5d6d', '#66788b', '#54636f'],
        industrial: ['#6d6a63', '#5f5c56', '#7a7770', '#63605a']
    },

    good: '#5ec97a',
    warn: '#e8b13c',
    bad: '#e2584d',
    info: '#4fa9e0',
    power: '#f5d24a',
    waterLine: '#5fd0f0',
    gridLine: 'rgba(0, 0, 0, 0.07)'
};

// Overlay ramps for the data views (low -> high).
export const OVERLAY_RAMPS = {
    landvalue: ['#2b3a6b', '#2f7d99', '#57a85f', '#d8c14a', '#e2783d'],
    pollution: ['#2f6d4a', '#7ea54a', '#d0b93f', '#c9702f', '#a33327'],
    police: ['#1e2a44', '#2a4a7a', '#3f7ac0', '#69a6e0', '#a9d2f5'],
    fire: ['#3a1f1c', '#75352a', '#b45532', '#e08040', '#f5bd7a'],
    health: ['#2a2140', '#4a3070', '#7a49a8', '#a97ad0', '#d6bcf0'],
    education: ['#20323a', '#265a5a', '#2f8a78', '#54b895', '#9fdcc4'],
    leisure: ['#26361f', '#3d5c2a', '#5c8a38', '#84b64f', '#b8de84'],
    traffic: ['#2f6d4a', '#8ab04a', '#e0c247', '#dd8a33', '#c53b2c'],
    happiness: ['#a33327', '#c9702f', '#d0b93f', '#7ea54a', '#2f9d5a']
};
