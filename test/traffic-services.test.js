import test from 'node:test';
import assert from 'node:assert/strict';
import { ZoneManager } from '../js/zoning/ZoneManager.js';
import { CityMap } from '../js/simulation/CityMap.js';
import { RoadNetwork } from '../js/traffic/RoadNetwork.js';
import { TrafficManager } from '../js/traffic/TrafficManager.js';
import { Building } from '../js/simulation/Building.js';

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
