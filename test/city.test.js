import test from 'node:test';
import assert from 'node:assert/strict';

import { makeCity, installFakeStorage } from './helpers/headlessCity.js';
import { CityMap } from '../js/simulation/CityMap.js';
import { SaveManager } from '../js/save/SaveManager.js';
import { DIR } from '../js/traffic/RoadNetwork.js';
import { TERRAIN } from '../js/utils/Constants.js';

// --- terrain ------------------------------------------------------------------

test('terrain generation is deterministic for a seed', () => {
    const a = new CityMap(24, 24, 99);
    const b = new CityMap(24, 24, 99);
    const c = new CityMap(24, 24, 100);

    const signature = (map) => map.tiles.map(t => t.terrain).join('');
    assert.equal(signature(a), signature(b));
    assert.notEqual(signature(a), signature(c));
});

test('the suggested start location is on buildable land', () => {
    const map = new CityMap(48, 48, 7);
    const tile = map.getTile(map.start.x, map.start.y);
    assert.ok(tile);
    assert.notEqual(tile.terrain, TERRAIN.WATER);
    assert.notEqual(tile.terrain, TERRAIN.ROCK);
});

// --- roads ---------------------------------------------------------------------

test('roads connect to their neighbours and upgrade in place', () => {
    const city = makeCity();
    city.road(4, 4, 6, 4);

    const middle = city.cityMap.getTile(5, 4);
    assert.equal(middle.road.connections & DIR.E, DIR.E);
    assert.equal(middle.road.connections & DIR.W, DIR.W);
    assert.equal(middle.road.connections & DIR.N, 0);

    assert.equal(city.roads.placeRoad(5, 4, 'avenue'), 'upgraded');
    assert.equal(city.roads.roadType(5, 4), 'avenue');
    assert.equal(city.roads.totalRoadTiles, 3);

    city.roads.removeRoad(5, 4);
    assert.equal(city.cityMap.getTile(4, 4).road.connections & DIR.E, 0);
});

test('pathfinding prefers avenues over an equally long street route', () => {
    const city = makeCity();
    // Two mirror-image routes of identical length between (5,5) and (15,5):
    // north through streets, south through avenues.
    city.road(5, 5, 5, 2, 'street');
    city.road(5, 2, 15, 2, 'street');
    city.road(15, 2, 15, 5, 'street');
    city.road(5, 5, 5, 8, 'avenue');
    city.road(5, 8, 15, 8, 'avenue');
    city.road(15, 8, 15, 5, 'avenue');

    const path = city.pathfinder.findPath(5, 5, 15, 5);
    assert.ok(path, 'a route should exist');
    assert.ok(path.some(p => p.y === 8), 'the avenue route should win');
    assert.ok(!path.some(p => p.y === 2), 'the street route should be ignored');
});

test('bulldozed roads invalidate the cached path', () => {
    const city = makeCity();
    city.road(2, 2, 8, 2);
    assert.ok(city.pathfinder.findPath(2, 2, 8, 2));

    city.roads.removeRoad(5, 2);
    assert.equal(city.pathfinder.findPath(2, 2, 8, 2), null);
});

// --- utilities --------------------------------------------------------------------

test('power flows along roads from a plant to a zoned building', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    city.services.place('coal_plant', 3, 7);
    city.services.place('water_tower', 6, 11);

    city.zones.zoneTile(10, 11, 'residential');
    city.step(40);

    const tile = city.cityMap.getTile(10, 11);
    assert.ok(tile.powered, 'the lot should be on the grid');
    assert.ok(tile.watered, 'the lot should have water');
    assert.ok(tile.building, 'a building should have grown');
});

test('a lot with no utilities never grows', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    city.zones.zoneTile(10, 11, 'residential');
    city.step(40);

    assert.equal(city.cityMap.getTile(10, 11).building, null);
});

test('a network without enough supply browns out some consumers', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    assert.ok(city.services.place('wind_turbine', 4, 9), 'turbine placed');   // 34 MW only
    assert.ok(city.services.place('water_tower', 6, 11), 'tower placed');

    for (let x = 5; x < 18; x++) city.zones.zoneTile(x, 11, 'industrial');
    city.step(60);

    assert.ok(city.utilities.powerDemand > 0);
    assert.ok(city.utilities.powerSupply < city.utilities.powerDemand,
        'the test city should be short on power');
    const unpowered = city.zones.buildings.filter(b => !b.powered).length;
    const powered = city.zones.buildings.filter(b => b.powered).length;
    assert.ok(powered > 0 && unpowered > 0, `expected a partial blackout, got ${powered}/${unpowered}`);
});

// --- services ---------------------------------------------------------------------

test('placement rules reject illegal spots and explain why', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);

    // A pump needs fresh water next to it.
    assert.equal(city.services.checkPlacement('water_pump', 5, 12).ok, false);
    city.cityMap.getTile(5, 14).terrain = TERRAIN.WATER;
    assert.equal(city.services.checkPlacement('water_pump', 5, 12).ok, true);

    // A police station needs road access.
    assert.equal(city.services.checkPlacement('police_station', 24, 24).reason, 'Needs road access');
    assert.equal(city.services.checkPlacement('police_station', 5, 11).ok, true);

    // Nothing may overlap an existing structure.
    city.services.place('police_station', 5, 11);
    assert.equal(city.services.checkPlacement('fire_station', 5, 11).reason, 'Already occupied');
});

test('demolishing a service frees its tiles and refunds part of the cost', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    const station = city.services.place('fire_station', 5, 11);
    assert.ok(city.cityMap.getTile(6, 12).structure === station);

    const refund = city.services.remove(station);
    assert.ok(refund > 0);
    assert.equal(city.cityMap.getTile(6, 12).structure, null);
    assert.equal(city.services.structures.length, 0);
});

// --- fields ------------------------------------------------------------------------

test('parks raise land value and industry raises pollution', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    city.fields.rebuild();

    const index = 12 * city.cityMap.width + 12;
    const before = city.fields.landValue[index];

    city.services.place('small_park', 12, 12);
    city.utilities.rebuild();
    city.fields.rebuild();
    assert.ok(city.fields.landValue[index] > before, 'a park should lift nearby land value');

    const pollutionBefore = city.fields.pollution[index];
    assert.ok(city.services.place('coal_plant', 13, 11), 'the plant needs road access');
    city.utilities.rebuild();
    city.fields.rebuild();
    assert.ok(city.fields.pollution[index] > pollutionBefore, 'a coal plant should pollute');
});

// --- economy ---------------------------------------------------------------------------

test('a month settles taxes against upkeep', () => {
    const city = makeCity();
    city.road(2, 10, 20, 10);
    city.services.place('coal_plant', 3, 7);
    city.services.place('water_tower', 6, 11);
    for (let x = 8; x < 16; x++) city.zones.zoneTile(x, 11, 'residential');
    city.step(120);

    const ledger = city.economy.settleMonth({
        buildings: city.zones.buildings,
        roadNetwork: city.roads,
        serviceManager: city.services,
        educationLevel: 0
    });

    assert.ok(ledger.income > 0, 'residents should pay tax');
    assert.ok(ledger.expenses > 0, 'roads and services cost money');
    assert.equal(Math.round(ledger.balance), Math.round(ledger.income - ledger.expenses));
});

test('tax rates are clamped to the legal range', () => {
    const city = makeCity();
    city.economy.setTaxRate('residential', 0.9);
    assert.ok(city.economy.taxes.residential <= 0.2);
    city.economy.setTaxRate('residential', -1);
    assert.ok(city.economy.taxes.residential >= 0.01);
});

// --- milestones -----------------------------------------------------------------------------

test('milestones unlock features and pay a grant', () => {
    const city = makeCity();
    const before = city.economy.money;

    city.milestones.update(300, city.economy);

    assert.equal(city.milestones.current.title, 'Crossroads Village');
    assert.ok(city.economy.money > before, 'reaching a milestone pays out');
    assert.ok(city.milestones.isUnlocked(240));
    assert.ok(!city.milestones.isUnlocked(1200));
});

// --- save / load -------------------------------------------------------------------------------

test('a city survives a save and load round trip', () => {
    installFakeStorage();
    const saveManager = new SaveManager();

    const city = makeCity();
    city.road(2, 10, 20, 10);
    city.roads.placeRoad(10, 9, 'avenue');
    city.services.place('coal_plant', 3, 7);
    city.services.place('water_tower', 6, 11);
    city.cityMap.getTile(12, 12).pipe = true;
    city.cityMap.getTile(13, 12).wire = true;
    for (let x = 8; x < 14; x++) city.zones.zoneTile(x, 11, 'residential');
    city.step(80);
    city.economy.setTaxRate('commercial', 0.13);

    const populationBefore = city.zones.stats.population;
    const buildingsBefore = city.zones.buildings.length;
    assert.ok(buildingsBefore > 0, 'the test city should have grown something');

    saveManager.save(city);
    const data = saveManager.loadRaw(false);
    assert.ok(data);

    // Restore into a completely fresh city built from the same seed.
    const restored = makeCity();
    saveManager.applyTo(restored, data);
    restored.utilities.rebuild();
    restored.fields.rebuild();
    restored.zones._recomputeStats();

    assert.equal(restored.roads.totalRoadTiles, city.roads.totalRoadTiles);
    assert.equal(restored.roads.roadType(10, 9), 'avenue');
    assert.equal(restored.services.structures.length, 2);
    assert.equal(restored.zones.buildings.length, buildingsBefore);
    assert.equal(restored.zones.stats.population, populationBefore);
    assert.equal(restored.cityMap.getTile(12, 12).pipe, true);
    assert.equal(restored.cityMap.getTile(13, 12).wire, true);
    assert.equal(restored.economy.taxes.commercial, 0.13);
    assert.equal(restored.economy.money, city.economy.money);
});

test('clearing saves removes both the manual save and the autosave', () => {
    installFakeStorage();
    const saveManager = new SaveManager();
    const city = makeCity();

    saveManager.save(city);
    saveManager.autosave(city);
    assert.equal(saveManager.hasSave(), true);

    assert.equal(saveManager.clearAllSaves(), true);
    assert.equal(saveManager.hasSave(), false);
    assert.equal(saveManager.hasAutosave(), false);
    assert.equal(saveManager.clearAllSaves(), false);
});

// --- traffic ---------------------------------------------------------------------------------

test('commuters spawn during rush hour and congest the road', () => {
    const city = makeCity({ size: 40 });
    city.road(2, 10, 34, 10);
    city.road(2, 14, 34, 14);
    city.services.place('coal_plant', 3, 7);
    city.services.place('water_tower', 6, 11);
    for (let x = 6; x < 16; x++) {
        city.zones.zoneTile(x, 9, 'residential');
        city.zones.zoneTile(x, 11, 'residential');
    }
    for (let x = 22; x < 32; x++) {
        city.zones.zoneTile(x, 9, 'industrial');
        city.zones.zoneTile(x, 11, 'commercial');
    }
    city.step(260);

    assert.ok(city.zones.stats.population > 0);
    assert.ok(city.zones.stats.jobs > 0);

    city.time.msIntoDay = 0.33 * 9000;   // mid-morning rush
    for (let i = 0; i < 300; i++) city.traffic.update(60);

    assert.ok(city.traffic.carCount > 0, 'rush hour should put cars on the road');
    assert.ok(city.traffic.averageCongestion > 0, 'cars should register congestion');
});
