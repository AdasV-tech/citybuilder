// js/data/ServiceCatalog.js
// Every placeable city service in one table. Adding a new building to the game
// means adding one entry here — the tool palette, placement rules, upkeep,
// coverage fields and renderer all read from this catalog.
//
// Fields:
//   size        footprint in tiles (square)
//   cost        one-off construction cost
//   upkeep      money per month
//   needsWater  must touch a water tile (pumps, sewage outlets)
//   needsRoad   must touch a road tile (almost everything)
//   power/water supply produced (MW / m³); sewage = treatment capacity
//   demandPower/demandWater consumption while operating
//   field/radius/strength  coverage stamped into a service field
//   pollution   ground pollution emitted at the source

export const SERVICE_CATEGORY = {
    POWER: 'power',
    WATER: 'water',
    SERVICES: 'services',
    PARKS: 'parks'
};

export const SERVICES = [
    // --- Power -------------------------------------------------------------
    {
        id: 'coal_plant',
        name: 'Coal Power Plant',
        icon: '🏭',
        category: SERVICE_CATEGORY.POWER,
        size: 3,
        cost: 9000,
        upkeep: 320,
        power: 220,
        pollution: 0.85,
        needsRoad: true,
        unlockPop: 0,
        blurb: 'Cheap, reliable, filthy. 220 MW.'
    },
    {
        id: 'wind_turbine',
        name: 'Wind Turbine',
        icon: '🌀',
        category: SERVICE_CATEGORY.POWER,
        size: 1,
        cost: 2600,
        upkeep: 60,
        power: 34,
        pollution: 0,
        needsRoad: false,
        unlockPop: 0,
        blurb: 'Clean 34 MW. No road needed.'
    },
    {
        id: 'solar_farm',
        name: 'Solar Farm',
        icon: '🔆',
        category: SERVICE_CATEGORY.POWER,
        size: 3,
        cost: 12000,
        upkeep: 240,
        power: 160,
        pollution: 0,
        needsRoad: true,
        unlockPop: 1200,
        blurb: 'Clean 160 MW. Unlocked at 1,200 citizens.'
    },

    // --- Water -------------------------------------------------------------
    {
        id: 'water_pump',
        name: 'Water Pumping Station',
        icon: '⛲',
        category: SERVICE_CATEGORY.WATER,
        size: 2,
        cost: 3600,
        upkeep: 90,
        water: 240,
        demandPower: 12,
        needsWater: true,
        needsRoad: false,
        unlockPop: 0,
        blurb: 'Must touch fresh water. 240 m³.'
    },
    {
        id: 'water_tower',
        name: 'Water Tower',
        icon: '🗼',
        category: SERVICE_CATEGORY.WATER,
        size: 1,
        cost: 2200,
        upkeep: 55,
        water: 90,
        demandPower: 6,
        needsWater: false,
        needsRoad: false,
        unlockPop: 0,
        blurb: 'Works anywhere. 90 m³.'
    },
    {
        id: 'sewage_outlet',
        name: 'Sewage Outlet',
        icon: '🚱',
        category: SERVICE_CATEGORY.WATER,
        size: 2,
        cost: 3000,
        upkeep: 80,
        sewage: 260,
        pollution: 0.5,
        needsWater: true,
        needsRoad: false,
        unlockPop: 0,
        blurb: 'Dumps 260 m³ of sewage. Pollutes water.'
    },
    {
        id: 'treatment_plant',
        name: 'Treatment Plant',
        icon: '♻️',
        category: SERVICE_CATEGORY.WATER,
        size: 3,
        cost: 11000,
        upkeep: 300,
        sewage: 420,
        demandPower: 20,
        pollution: 0.1,
        needsRoad: true,
        unlockPop: 2500,
        blurb: 'Clean treatment for 420 m³.'
    },

    // --- Services ------------------------------------------------------------
    {
        id: 'police_station',
        name: 'Police Station',
        icon: '🚓',
        category: SERVICE_CATEGORY.SERVICES,
        size: 2,
        cost: 4200,
        upkeep: 190,
        demandPower: 8,
        demandWater: 6,
        field: 'police',
        radius: 16,
        strength: 1,
        needsRoad: true,
        unlockPop: 240,
        blurb: 'Cuts crime within 16 tiles.'
    },
    {
        id: 'fire_station',
        name: 'Fire Station',
        icon: '🚒',
        category: SERVICE_CATEGORY.SERVICES,
        size: 2,
        cost: 4000,
        upkeep: 180,
        demandPower: 8,
        demandWater: 8,
        field: 'fire',
        radius: 16,
        strength: 1,
        needsRoad: true,
        unlockPop: 240,
        blurb: 'Fire cover within 16 tiles.'
    },
    {
        id: 'clinic',
        name: 'Medical Clinic',
        icon: '🏥',
        category: SERVICE_CATEGORY.SERVICES,
        size: 2,
        cost: 5200,
        upkeep: 220,
        demandPower: 12,
        demandWater: 14,
        field: 'health',
        radius: 15,
        strength: 1,
        needsRoad: true,
        unlockPop: 600,
        blurb: 'Healthcare within 15 tiles.'
    },
    {
        id: 'school',
        name: 'Elementary School',
        icon: '🏫',
        category: SERVICE_CATEGORY.SERVICES,
        size: 2,
        cost: 4800,
        upkeep: 210,
        demandPower: 10,
        demandWater: 12,
        field: 'education',
        radius: 14,
        strength: 0.9,
        needsRoad: true,
        unlockPop: 600,
        blurb: 'Educated citizens earn — and pay — more.'
    },
    {
        id: 'university',
        name: 'University',
        icon: '🎓',
        category: SERVICE_CATEGORY.SERVICES,
        size: 3,
        cost: 14000,
        upkeep: 520,
        demandPower: 26,
        demandWater: 28,
        field: 'education',
        radius: 24,
        strength: 1.4,
        needsRoad: true,
        unlockPop: 4000,
        blurb: 'Big education boost. Raises land value.'
    },

    // --- Parks ---------------------------------------------------------------
    {
        id: 'small_park',
        name: 'Small Park',
        icon: '🌳',
        category: SERVICE_CATEGORY.PARKS,
        size: 1,
        cost: 600,
        upkeep: 18,
        field: 'leisure',
        radius: 7,
        strength: 0.55,
        needsRoad: false,
        unlockPop: 0,
        blurb: 'Cheap land-value bump.'
    },
    {
        id: 'plaza',
        name: 'City Plaza',
        icon: '⛲',
        category: SERVICE_CATEGORY.PARKS,
        size: 2,
        cost: 2400,
        upkeep: 60,
        demandWater: 6,
        field: 'leisure',
        radius: 12,
        strength: 0.9,
        needsRoad: true,
        unlockPop: 400,
        blurb: 'Strong leisure coverage downtown.'
    },
    {
        id: 'stadium',
        name: 'Stadium',
        icon: '🏟️',
        category: SERVICE_CATEGORY.PARKS,
        size: 4,
        cost: 22000,
        upkeep: 700,
        demandPower: 40,
        demandWater: 30,
        field: 'leisure',
        radius: 26,
        strength: 1.6,
        needsRoad: true,
        unlockPop: 6000,
        blurb: 'City-wide happiness landmark.'
    }
];

const BY_ID = new Map(SERVICES.map(s => [s.id, s]));

export function getService(id) {
    return BY_ID.get(id) || null;
}

export function servicesInCategory(category) {
    return SERVICES.filter(s => s.category === category);
}
