// js/traffic/TrafficManager.js
// Commuter traffic. Cars spawn during the morning and evening rush windows and
// drive between homes and workplaces; freight trucks run between industry and
// commerce all day. Where cars pile up, congestion rises on that tile, which
// feeds back into pathfinding costs, land value and happiness.

import {
    MAX_CARS, CAR_MIN_GAP, ROAD_CAPACITY, COMMUTE_WINDOWS
} from '../utils/Constants.js';
import { Car, CAR_KIND } from './Car.js';

export class TrafficManager {
    constructor(roadNetwork, pathfinder, zoneManager, timeManager) {
        this.roads = roadNetwork;
        this.pathfinder = pathfinder;
        this.zones = zoneManager;
        this.time = timeManager;
        this.cars = [];
        this._spawnCooldown = 0;
        this._tileCounts = new Map();
        this._congestionTimer = 0;
    }

    get carCount() { return this.cars.length; }

    /** Average congestion across the road network, 0..1 — shown in the HUD. */
    get averageCongestion() {
        let sum = 0, count = 0;
        for (const tile of this.roads.map.tiles) {
            if (!tile.road) continue;
            sum += tile.road.congestion;
            count++;
        }
        return count === 0 ? 0 : sum / count;
    }

    reset() {
        this.cars = [];
        this._spawnCooldown = 0;
        this._tileCounts.clear();
    }

    update(dtMs) {
        this._trySpawn(dtMs);
        this._advance(dtMs / 1000);

        if (this.cars.length > 0 || this._tileCounts.size > 0) {
            this._congestionTimer += dtMs;
            if (this._congestionTimer >= 400) {
                this._congestionTimer = 0;
                this.roads.applyCongestion(this._tileCounts, type => ROAD_CAPACITY[type] ?? 3);
            }
        }
    }

    // --- spawning -------------------------------------------------------------

    _activeWindow() {
        const f = this.time.dayFraction;
        for (const window of COMMUTE_WINDOWS) {
            if (f >= window.start && f <= window.end) return window;
        }
        return null;
    }

    _trySpawn(dtMs) {
        this._spawnCooldown -= dtMs;
        if (this._spawnCooldown > 0) return;
        this._spawnCooldown = 140;
        if (this.cars.length >= MAX_CARS) return;

        const homes = this.zones.residentialBuildings;
        const workplaces = this.zones.jobBuildings;
        if (homes.length === 0 || workplaces.length === 0) return;

        const window = this._activeWindow();
        // Outside rush hour a trickle of freight keeps the city looking alive.
        const isFreight = !window || Math.random() < 0.25;

        let from, to, kind;
        if (isFreight) {
            const industry = workplaces.filter(b => b.isIndustrial);
            const shops = workplaces.filter(b => b.isCommercial);
            if (industry.length === 0 || shops.length === 0) return;
            from = pick(industry); to = pick(shops); kind = CAR_KIND.TRUCK;
        } else if (window.direction === 'toWork') {
            from = pick(homes); to = pick(workplaces); kind = CAR_KIND.COMMUTER;
        } else {
            from = pick(workplaces); to = pick(homes); kind = CAR_KIND.COMMUTER;
        }
        if (!from || !to || from === to) return;
        if (from.occupants < 0.5 || to.occupants < 0.5) return;

        const start = this.roads.findNearestRoad(from.x, from.y, 3);
        const end = this.roads.findNearestRoad(to.x, to.y, 3);
        if (!start || !end) return;

        const path = this.pathfinder.findPath(start.x, start.y, end.x, end.y);
        if (!path || path.length < 2) return;

        this.cars.push(new Car(path, kind));
    }

    // --- movement ---------------------------------------------------------------

    _advance(dtSeconds) {
        if (this.cars.length === 0) {
            if (this._tileCounts.size > 0) this._tileCounts.clear();
            return;
        }

        // Every car's fraction into whichever tile it currently occupies,
        // grouped by tile position (not path index — two cars can reach the
        // same tile via different routes, and indexing by path position as
        // well made those cars invisible to each other, letting them drive
        // straight through one another) and sorted so each car can find
        // whoever is nearest ahead of it. That covers both a car about to
        // enter a tile someone's already in, and — since this is rebuilt from
        // scratch every frame — two cars that are already sharing a tile: a
        // faster trailing car can't keep closing the gap once both are
        // inside, because it's rechecked every tick, not just at entry.
        const occupants = new Map(); // "x,y" -> [{id, fraction}] sorted ascending
        const counts = this._tileCounts;
        counts.clear();

        for (const car of this.cars) {
            const index = car.tileIndex;
            const tile = car.path[index];
            const key = `${tile.x},${tile.y}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
            let list = occupants.get(key);
            if (!list) { list = []; occupants.set(key, list); }
            list.push({ id: car.id, fraction: car.progress - index });
        }
        for (const list of occupants.values()) list.sort((a, b) => a.fraction - b.fraction);

        const map = this.roads.map;
        let finished = 0;

        for (const car of this.cars) {
            const index = car.tileIndex;
            const tile = map.getTile(car.path[index].x, car.path[index].y);
            const myFraction = car.progress - index;
            let maxProgress = car.totalLength;

            const here = occupants.get(`${car.path[index].x},${car.path[index].y}`);
            const aheadHere = here?.find(o => o.fraction > myFraction && o.id !== car.id);
            if (aheadHere) maxProgress = Math.min(maxProgress, index + aheadHere.fraction - CAR_MIN_GAP);

            const nextIndex = index + 1;
            if (nextIndex <= car.totalLength) {
                const nextTile = car.path[nextIndex];
                const nextOccupants = occupants.get(`${nextTile.x},${nextTile.y}`);
                const first = nextOccupants?.[0];
                if (first !== undefined && first.fraction < CAR_MIN_GAP) {
                    maxProgress = Math.min(maxProgress, nextIndex + first.fraction - CAR_MIN_GAP);
                }
            }

            car.update(dtSeconds, maxProgress, tile?.road?.type ?? 'street', tile?.road?.congestion ?? 0);

            // A car whose road was bulldozed under it just vanishes.
            if (!tile?.road) car.finished = true;
            if (car.finished) finished++;
        }

        if (finished > 0) this.cars = this.cars.filter(car => !car.finished);
    }
}

function pick(list) {
    return list.length === 0 ? null : list[(Math.random() * list.length) | 0];
}
