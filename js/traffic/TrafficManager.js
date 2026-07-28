// js/traffic/TrafficManager.js
// Spawns cars that commute between residential buildings and job buildings
// (commercial/industrial) during morning/evening windows, and steps their
// movement each frame with simple "don't overlap the car ahead" behavior.

import {
    MAX_CARS, CAR_MIN_GAP,
    COMMUTE_MORNING_START, COMMUTE_MORNING_END,
    COMMUTE_EVENING_START, COMMUTE_EVENING_END
} from '../utils/Constants.js';
import { Car } from './Car.js';
import { tileKey } from '../utils/MathUtils.js';

export class TrafficManager {
    constructor(roadNetwork, pathfinder, zoneManager, timeManager) {
        this.roads = roadNetwork;
        this.pathfinder = pathfinder;
        this.zones = zoneManager;
        this.time = timeManager;
        this.cars = [];
        this._spawnCooldown = 0;
    }

    update(dtMs) {
        this._trySpawn(dtMs);
        this._advanceCars(dtMs / 1000);
        this.cars = this.cars.filter(c => !c.finished);
    }

    _inWindow(frac, start, end) { return frac >= start && frac <= end; }

    _trySpawn(dtMs) {
        this._spawnCooldown -= dtMs;
        if (this._spawnCooldown > 0) return;
        this._spawnCooldown = 220; // ms between spawn attempts

        if (this.cars.length >= MAX_CARS) return;

        const dayFrac = this.time.dayFraction;
        const morning = this._inWindow(dayFrac, COMMUTE_MORNING_START, COMMUTE_MORNING_END);
        const evening = this._inWindow(dayFrac, COMMUTE_EVENING_START, COMMUTE_EVENING_END);
        if (!morning && !evening) return;

        const residential = this.zones.residentialBuildings.filter(b => b.population >= 1);
        const jobs = [...this.zones.commercialBuildings, ...this.zones.industrialBuildings].filter(b => b.workers >= 1);
        if (residential.length === 0 || jobs.length === 0) return;

        const from = morning
            ? residential[Math.floor(Math.random() * residential.length)]
            : jobs[Math.floor(Math.random() * jobs.length)];
        const to = morning
            ? jobs[Math.floor(Math.random() * jobs.length)]
            : residential[Math.floor(Math.random() * residential.length)];

        const startRoad = this.roads.findNearestRoad(from.x, from.y);
        const endRoad = this.roads.findNearestRoad(to.x, to.y);
        if (!startRoad || !endRoad) return;

        const path = this.pathfinder.findPath(startRoad.x, startRoad.y, endRoad.x, endRoad.y);
        if (!path || path.length < 2) return;

        this.cars.push(new Car(path, Math.random()));
    }

    _advanceCars(dtSeconds) {
        // Group cars by the tile they currently occupy so we can enforce following distance.
        const occupancy = new Map(); // tileKey -> [{car, fractionInTile}]
        for (const car of this.cars) {
            const idx = car.currentTileIndex;
            const frac = car.progress - idx;
            const tile = car.path[idx];
            const key = tileKey(tile.x, tile.y) + `#${idx}`;
            if (!occupancy.has(key)) occupancy.set(key, []);
            occupancy.get(key).push({ car, frac });
        }

        for (const car of this.cars) {
            const nextIdx = car.currentTileIndex + 1;
            let maxProgress = car.totalLength;
            if (nextIdx <= car.totalLength) {
                const tile = car.path[nextIdx];
                const key = tileKey(tile.x, tile.y) + `#${nextIdx}`;
                const occupants = occupancy.get(key);
                if (occupants) {
                    let minFrac = Infinity;
                    for (const o of occupants) {
                        if (o.car !== car) minFrac = Math.min(minFrac, o.frac);
                    }
                    if (minFrac !== Infinity && minFrac < CAR_MIN_GAP) {
                        maxProgress = Math.min(maxProgress, nextIdx + Math.max(0, minFrac - CAR_MIN_GAP * 0.6));
                    }
                }
            }
            car.update(dtSeconds, maxProgress);
        }
    }

    get carCount() { return this.cars.length; }
}
