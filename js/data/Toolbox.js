// js/data/Toolbox.js
// Declarative description of the bottom icon rail. The palette UI is generated
// entirely from this table: each category is one logo button, and opening it
// reveals its tools. Nothing else in the UI hard-codes a button.

import { SERVICE_CATEGORY, servicesInCategory } from './ServiceCatalog.js';
import { COST_PER_TILE } from '../utils/Constants.js';

/** Turn catalog entries into palette items. */
function serviceItems(category) {
    return servicesInCategory(category).map(s => ({
        id: `service:${s.id}`,
        kind: 'service',
        serviceId: s.id,
        icon: s.icon,
        label: s.name,
        cost: s.cost,
        upkeep: s.upkeep,
        unlockPop: s.unlockPop,
        blurb: s.blurb
    }));
}

export const CATEGORIES = [
    {
        id: 'roads',
        icon: '🛣️',
        label: 'Roads',
        hotkey: '1',
        unlockPop: 0,
        items: [
            {
                id: 'road:street', kind: 'road', roadType: 'street', icon: '🛤️',
                label: 'Two-lane Street', cost: COST_PER_TILE.street, unlockPop: 0,
                blurb: 'Drag to draw. Cheap, slow, low capacity.'
            },
            {
                id: 'road:avenue', kind: 'road', roadType: 'avenue', icon: '🛣️',
                label: 'Four-lane Avenue', cost: COST_PER_TILE.avenue, unlockPop: 500,
                blurb: 'Faster and carries twice the traffic.'
            }
        ]
    },
    {
        id: 'zoning',
        icon: '🏘️',
        label: 'Zoning',
        hotkey: '2',
        unlockPop: 0,
        items: [
            {
                id: 'zone:residential', kind: 'zone', zone: 'residential', icon: '🏠',
                label: 'Residential', cost: COST_PER_TILE.zone, unlockPop: 0,
                blurb: 'Homes. Needs road access, power and water.'
            },
            {
                id: 'zone:commercial', kind: 'zone', zone: 'commercial', icon: '🏬',
                label: 'Commercial', cost: COST_PER_TILE.zone, unlockPop: 0,
                blurb: 'Shops and offices. Sells what industry makes.'
            },
            {
                id: 'zone:industrial', kind: 'zone', zone: 'industrial', icon: '🏗️',
                label: 'Industrial', cost: COST_PER_TILE.zone, unlockPop: 0,
                blurb: 'Jobs and pollution. Keep it downwind.'
            },
            {
                id: 'zone:dezone', kind: 'dezone', icon: '🚫',
                label: 'De-zone', cost: 0, unlockPop: 0,
                blurb: 'Strip zoning without demolishing roads.'
            }
        ]
    },
    {
        id: 'power',
        icon: '⚡',
        label: 'Electricity',
        hotkey: '3',
        unlockPop: 0,
        items: [
            {
                id: 'utility:wire', kind: 'utility', utility: 'wire', icon: '🔌',
                label: 'Power Line', cost: COST_PER_TILE.wire, unlockPop: 0,
                blurb: 'Carries power across gaps. Roads carry it too.'
            },
            ...serviceItems(SERVICE_CATEGORY.POWER)
        ]
    },
    {
        id: 'water',
        icon: '💧',
        label: 'Water & Sewage',
        hotkey: '4',
        unlockPop: 0,
        items: [
            {
                id: 'utility:pipe', kind: 'utility', utility: 'pipe', icon: '🚰',
                label: 'Water Pipe', cost: COST_PER_TILE.pipe, unlockPop: 0,
                blurb: 'Carries water across gaps. Roads carry it too.'
            },
            ...serviceItems(SERVICE_CATEGORY.WATER)
        ]
    },
    {
        id: 'services',
        icon: '🚑',
        label: 'City Services',
        hotkey: '5',
        unlockPop: 240,
        items: serviceItems(SERVICE_CATEGORY.SERVICES)
    },
    {
        id: 'parks',
        icon: '🌳',
        label: 'Parks & Leisure',
        hotkey: '6',
        unlockPop: 0,
        items: serviceItems(SERVICE_CATEGORY.PARKS)
    },
    {
        id: 'demolish',
        icon: '💣',
        label: 'Demolish',
        hotkey: '7',
        unlockPop: 0,
        items: [
            {
                id: 'bulldoze', kind: 'bulldoze', icon: '💣',
                label: 'Bulldozer', cost: COST_PER_TILE.bulldoze, unlockPop: 0,
                blurb: 'Drag to clear roads, zones, buildings and trees.'
            }
        ]
    }
];

// Data views painted over the map. `field` names a field on FieldManager,
// except the special cases handled by the overlay renderer.
export const INFO_VIEWS = [
    { id: 'none', icon: '🗺️', label: 'Normal View' },
    { id: 'landvalue', icon: '💎', label: 'Land Value', field: 'landValue' },
    { id: 'pollution', icon: '☁️', label: 'Pollution', field: 'pollution' },
    { id: 'police', icon: '🚓', label: 'Crime Cover', field: 'police' },
    { id: 'fire', icon: '🚒', label: 'Fire Cover', field: 'fire' },
    { id: 'health', icon: '🏥', label: 'Healthcare', field: 'health' },
    { id: 'education', icon: '🎓', label: 'Education', field: 'education' },
    { id: 'leisure', icon: '🌳', label: 'Leisure', field: 'leisure' },
    { id: 'power', icon: '⚡', label: 'Power Grid' },
    { id: 'water', icon: '💧', label: 'Water Grid' },
    { id: 'traffic', icon: '🚗', label: 'Traffic' },
    { id: 'happiness', icon: '🙂', label: 'Happiness' }
];

export const CITY_MENU = [
    { id: 'save', icon: '💾', label: 'Save City' },
    { id: 'load', icon: '📂', label: 'Load City' },
    { id: 'export', icon: '⬇️', label: 'Export File' },
    { id: 'import', icon: '⬆️', label: 'Import File' },
    { id: 'newcity', icon: '✨', label: 'New City' },
    { id: 'wipe', icon: '🗑️', label: 'Delete Saves', danger: true }
];

const ITEM_INDEX = new Map();
for (const cat of CATEGORIES) {
    for (const item of cat.items) ITEM_INDEX.set(item.id, { ...item, categoryId: cat.id });
}

export function getToolItem(id) {
    return ITEM_INDEX.get(id) || null;
}
