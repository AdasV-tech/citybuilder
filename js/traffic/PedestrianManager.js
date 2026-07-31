// js/traffic/PedestrianManager.js
// Ambient foot traffic between homes and nearby workplaces. Deliberately reuses
// the same road graph and Pathfinder the cars use rather than building a
// separate sidewalk network — Pedestrian.js just renders itself offset toward
// the kerb instead of the road centre. Trips longer than a comfortable walk
// are skipped outright: nobody hikes across town on foot when a road network
// already exists for that.

import { MAX_PEDESTRIANS, PEDESTRIAN_MIN_GAP, WALK_MAX_TILES } from '../utils/Constants.js';
import { Pedestrian } from './Pedestrian.js';

export class PedestrianManager {
    constructor(roadNetwork, pathfinder, zoneManager, timeManager) {
        this.roads = roadNetwork;
        this.pathfinder = pathfinder;
        this.zones = zoneManager;
        this.time = timeManager;
        this.pedestrians = [];
        this._spawnCooldown = 0;
    }

    get count() { return this.pedestrians.length; }

    reset() {
        this.pedestrians = [];
        this._spawnCooldown = 0;
    }

    update(dtMs) {
        this._trySpawn(dtMs);
        this._advance(dtMs / 1000);
    }

    // --- spawning ---------------------------------------------------------------

    _trySpawn(dtMs) {
        this._spawnCooldown -= dtMs;
        if (this._spawnCooldown > 0) return;
        this._spawnCooldown = 220;
        if (this.pedestrians.length >= MAX_PEDESTRIANS) return;

        // Sidewalks are never quite empty, but fewer people are out overnight.
        if (Math.random() < this.time.nightFactor * 0.7) return;

        const homes = this.zones.residentialBuildings;
        const destinations = this.zones.jobBuildings;
        if (homes.length === 0 || destinations.length === 0) return;

        const home = pick(homes);
        const dest = pick(destinations);
        if (!home || !dest || home.occupants < 0.5 || dest.occupants < 0.5) return;

        const start = this.roads.findNearestRoad(home.x, home.y, 3);
        const end = this.roads.findNearestRoad(dest.x, dest.y, 3);
        if (!start || !end) return;

        const path = this.pathfinder.findPath(start.x, start.y, end.x, end.y);
        if (!path || path.length < 2 || path.length > WALK_MAX_TILES) return;

        this.pedestrians.push(new Pedestrian(Math.random() < 0.5 ? path : [...path].reverse()));
    }

    // --- movement ---------------------------------------------------------------

    _advance(dtSeconds) {
        if (this.pedestrians.length === 0) return;

        // Same approach TrafficManager uses for cars: group every walker's
        // fraction into whichever tile it currently occupies by tile position
        // (not path index — two people can reach the same tile via different
        // routes), sorted so each one can find whoever is nearest ahead of
        // it. Rebuilding this from scratch every frame also covers two
        // pedestrians already sharing a tile — otherwise a faster trailing
        // walker could keep closing the gap after both are inside it, since
        // checking only at the moment of entry wouldn't catch that.
        const occupants = new Map(); // "x,y" -> [{id, fraction}] sorted ascending
        for (const person of this.pedestrians) {
            const index = person.tileIndex;
            const tile = person.path[index];
            const key = `${tile.x},${tile.y}`;
            let list = occupants.get(key);
            if (!list) { list = []; occupants.set(key, list); }
            list.push({ id: person.id, fraction: person.progress - index });
        }
        for (const list of occupants.values()) list.sort((a, b) => a.fraction - b.fraction);

        const map = this.roads.map;
        let finished = 0;

        for (const person of this.pedestrians) {
            const index = person.tileIndex;
            const tile = map.getTile(person.path[index].x, person.path[index].y);
            const myFraction = person.progress - index;
            let maxProgress = person.totalLength;

            const here = occupants.get(`${person.path[index].x},${person.path[index].y}`);
            const aheadHere = here?.find(o => o.fraction > myFraction && o.id !== person.id);
            if (aheadHere) maxProgress = Math.min(maxProgress, index + aheadHere.fraction - PEDESTRIAN_MIN_GAP);

            const nextIndex = index + 1;
            if (nextIndex <= person.totalLength) {
                const nextTile = person.path[nextIndex];
                const nextOccupants = occupants.get(`${nextTile.x},${nextTile.y}`);
                const first = nextOccupants?.[0];
                if (first !== undefined && first.fraction < PEDESTRIAN_MIN_GAP) {
                    maxProgress = Math.min(maxProgress, nextIndex + first.fraction - PEDESTRIAN_MIN_GAP);
                }
            }

            person.update(dtSeconds, maxProgress);

            // A pedestrian whose road was bulldozed under them just vanishes.
            if (!tile?.road) person.finished = true;
            if (person.finished) finished++;
        }

        if (finished > 0) this.pedestrians = this.pedestrians.filter(person => !person.finished);
    }
}

function pick(list) {
    return list.length === 0 ? null : list[(Math.random() * list.length) | 0];
}
