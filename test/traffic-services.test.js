import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoneManager } from '../js/zoning/ZoneManager.js';
import { CityMap } from '../js/simulation/CityMap.js';
import { RoadNetwork } from '../js/traffic/RoadNetwork.js';
import { TrafficManager } from '../js/traffic/TrafficManager.js';
import { Building } from '../js/simulation/Building.js';
import { SaveManager } from '../js/save/SaveManager.js';

function buildManagers() {
  const map = new CityMap(12, 12, 1);
  const roads = new RoadNetwork(map);
  const zones = new ZoneManager(map, roads);
  const time = { dayFraction: 0.3 };
  const traffic = new TrafficManager(roads, { findPath: () => [{x:0,y:0},{x:1,y:0}] }, zones, time);
  return { map, roads, zones, traffic };
}

test('industrial buildings with too few workers trigger a shortage alert', () => {
  const { zones, traffic } = buildManagers();
  const industrial = new Building(1, 1, 'industrial');
  industrial.workers = 0;
  zones.buildings.push(industrial);
  const alert = traffic._evaluateServiceAlerts?.({ residentialDemand: 1, jobDemand: 0.2, population: 5, jobs: 0 });
  assert.ok(alert.some(item => item.type === 'workers-needed'));
});

test('save manager clears all stored saves', () => {
  const store = new Map();
  global.localStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); },
    clear() { store.clear(); }
  };

  const saveManager = new SaveManager();
  const game = {
    cityMap: {
      seed: 1,
      width: 1,
      height: 1,
      forEachTile(callback) {
        callback({ x: 0, y: 0, road: false, zoneType: null, building: null, growthTimer: 0 });
      }
    },
    zoneManager: { serialize: () => [] },
    economy: { serialize: () => ({}) },
    time: { serialize: () => ({}) }
  };
  saveManager.save(game);
  saveManager.autosave(game);

  const removed = saveManager.clearAllSaves();

  assert.equal(removed, true);
  assert.equal(saveManager.hasSave(), false);
  assert.equal(saveManager.hasAutosave(), false);
});
