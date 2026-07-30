// test/helpers/headlessCity.js
// Builds the simulation half of a Game without any DOM, so the city rules can
// be tested in Node exactly as they run in the browser.

import { CityMap } from '../../js/simulation/CityMap.js';
import { RoadNetwork } from '../../js/traffic/RoadNetwork.js';
import { Pathfinder } from '../../js/traffic/Pathfinder.js';
import { ZoneManager } from '../../js/zoning/ZoneManager.js';
import { ServiceManager } from '../../js/simulation/ServiceManager.js';
import { UtilityGrid } from '../../js/simulation/UtilityGrid.js';
import { FieldManager } from '../../js/simulation/FieldManager.js';
import { DemandManager } from '../../js/simulation/DemandManager.js';
import { EconomyManager } from '../../js/simulation/EconomyManager.js';
import { TimeManager } from '../../js/simulation/TimeManager.js';
import { MilestoneManager } from '../../js/simulation/MilestoneManager.js';
import { TrafficManager } from '../../js/traffic/TrafficManager.js';
import { TERRAIN } from '../../js/utils/Constants.js';

export function makeCity({ size = 32, seed = 4242, flatten = true } = {}) {
    const cityMap = new CityMap(size, size, seed);

    if (flatten) {
        // Tests want predictable ground; terrain generation is covered separately.
        for (const tile of cityMap.tiles) tile.terrain = TERRAIN.GRASS;
        cityMap.start = { x: Math.floor(size / 2), y: Math.floor(size / 2) };
    }

    const roads = new RoadNetwork(cityMap);
    const pathfinder = new Pathfinder(roads);
    const zones = new ZoneManager(cityMap, roads);
    const services = new ServiceManager(cityMap);
    const utilities = new UtilityGrid(cityMap, services, zones);
    const fields = new FieldManager(cityMap, services, zones, roads);
    const demand = new DemandManager();
    const economy = new EconomyManager();
    const time = new TimeManager(1);
    const milestones = new MilestoneManager();
    const traffic = new TrafficManager(roads, pathfinder, zones, time);

    const city = {
        cityName: 'Testville',
        cityMap, roads, pathfinder, zones, services, utilities, fields,
        demand, economy, time, milestones, traffic,
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1, targetZoom: 1 },

        /** Run the same fixed-step simulation the game loop runs. */
        step(steps = 1, stepMs = 200) {
            for (let i = 0; i < steps; i++) {
                utilities.rebuild();
                fields.rebuild();
                zones.update(stepMs, { demand, fields, taxes: economy.taxes });
                demand.update(stepMs, {
                    population: zones.stats.population,
                    jobs: zones.stats.jobs,
                    commercialJobs: zones.stats.commercialJobs,
                    industrialJobs: zones.stats.industrialJobs,
                    happiness: zones.averageHappiness,
                    commercialShare: zones.zoneShares.commercial,
                    industrialShare: zones.zoneShares.industrial,
                    taxes: economy.taxes
                });
                milestones.update(zones.stats.population, economy);
            }
        },

        road(x0, y0, x1, y1, type = 'street') {
            if (x0 === x1) {
                for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) roads.placeRoad(x0, y, type);
            } else {
                for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) roads.placeRoad(x, y0, type);
            }
        }
    };

    return city;
}

/** Minimal in-memory localStorage so SaveManager can be exercised in Node. */
export function installFakeStorage() {
    const store = new Map();
    globalThis.localStorage = {
        getItem: (key) => (store.has(key) ? store.get(key) : null),
        setItem: (key, value) => store.set(key, String(value)),
        removeItem: (key) => store.delete(key),
        clear: () => store.clear()
    };
    return store;
}
