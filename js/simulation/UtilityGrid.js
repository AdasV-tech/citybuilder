// js/simulation/UtilityGrid.js
// Works out which tiles are actually connected to a working power plant / water
// source. Roads carry utilities underneath (like real cities), so pipes and
// wires are only needed to bridge gaps — that keeps the game readable without
// making the player draw a second grid over every street.
//
// Each refresh: flood fill conducting tiles into networks, total the supply and
// demand inside each network, then hand out capacity building-by-building so a
// shortage browns out *some* of the city rather than magically nothing.

import { SEWAGE_RATIO } from '../utils/Constants.js';

export class UtilityGrid {
    constructor(cityMap, serviceManager, zoneManager) {
        this.map = cityMap;
        this.services = serviceManager;
        this.zones = zoneManager;

        const size = cityMap.width * cityMap.height;
        this._component = new Int32Array(size);
        this._stack = new Int32Array(size);

        this.powerSupply = 0;
        this.powerDemand = 0;
        this.waterSupply = 0;
        this.waterDemand = 0;
        this.sewageCapacity = 0;
        this.sewageProduced = 0;
    }

    get powerRatio() { return this.powerDemand === 0 ? 1 : Math.min(1, this.powerSupply / this.powerDemand); }
    get waterRatio() { return this.waterDemand === 0 ? 1 : Math.min(1, this.waterSupply / this.waterDemand); }
    get sewageRatio() { return this.sewageProduced === 0 ? 1 : Math.min(1, this.sewageCapacity / this.sewageProduced); }

    rebuild() {
        this._run('power');
        this._run('water');
        this._settleSewage();
    }

    // --- internals ------------------------------------------------------------

    _run(kind) {
        const map = this.map;
        const component = this._component;
        component.fill(-1);

        const conducts = kind === 'power'
            ? (tile) => tile.conductsPower
            : (tile) => tile.conductsWater;

        // 1. Flood fill every network of connected conducting tiles.
        let networkCount = 0;
        for (let i = 0; i < component.length; i++) {
            if (component[i] !== -1) continue;
            const tile = map.tiles[i];
            if (!conducts(tile)) continue;
            this._flood(i, networkCount++, conducts);
        }

        // 2. Total supply and demand per network.
        const supply = new Float64Array(networkCount);
        const demand = new Float64Array(networkCount);
        const consumers = Array.from({ length: networkCount }, () => []);

        for (const structure of this.services.structures) {
            const net = component[map.index(structure.x, structure.y)];
            const output = kind === 'power' ? structure.powerOutput : structure.waterOutput;
            const draw = kind === 'power' ? structure.powerDemand : structure.waterDemand;
            if (net >= 0 && output > 0) supply[net] += output;
            if (net >= 0 && draw > 0) { demand[net] += draw; consumers[net].push(structure); }
            else if (net < 0 && draw > 0) this._deny(structure, kind);
        }

        for (const building of this.zones.buildings) {
            if (building.abandoned) continue;
            const net = component[map.index(building.x, building.y)];
            const draw = kind === 'power' ? building.powerDemand : building.waterDemand;
            if (net < 0) { this._deny(building, kind); continue; }
            demand[net] += draw;
            consumers[net].push(building);
        }

        // 3. Hand capacity out oldest-first so shortages are stable, not flickery.
        let totalSupply = 0, totalDemand = 0;
        for (let net = 0; net < networkCount; net++) {
            let remaining = supply[net];
            totalSupply += supply[net];
            totalDemand += demand[net];
            const list = consumers[net];
            list.sort((a, b) => a.id - b.id);
            for (const consumer of list) {
                const draw = kind === 'power'
                    ? (consumer.powerDemand ?? 0)
                    : (consumer.waterDemand ?? 0);
                if (remaining >= draw) {
                    remaining -= draw;
                    this._grant(consumer, kind);
                } else {
                    this._deny(consumer, kind);
                }
            }
        }

        // 4. Mirror the result onto tiles so the renderer can tint the overlays.
        const served = new Uint8Array(networkCount);
        for (let net = 0; net < networkCount; net++) served[net] = supply[net] > 0 ? 1 : 0;
        for (let i = 0; i < component.length; i++) {
            const net = component[i];
            const on = net >= 0 && served[net] === 1;
            if (kind === 'power') map.tiles[i].powered = on;
            else map.tiles[i].watered = on;
        }
        this._spillToEmptyLots(kind);

        if (kind === 'power') {
            this.powerSupply = totalSupply;
            this.powerDemand = totalDemand;
        } else {
            this.waterSupply = totalSupply;
            this.waterDemand = totalDemand;
        }
    }

    /**
     * An empty zoned lot has no pipes of its own — it is served if the road (or
     * pipe/wire) it backs onto is. Without this a lot could never break ground,
     * because construction requires utilities and utilities arrive with the
     * building.
     */
    _spillToEmptyLots(kind) {
        const map = this.map, w = map.width, h = map.height, tiles = map.tiles;
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            if (!tile.zone || tile.building) continue;
            const x = i % w, y = (i / w) | 0;
            const served =
                (x > 0 && this._isServed(tiles[i - 1], kind)) ||
                (x < w - 1 && this._isServed(tiles[i + 1], kind)) ||
                (y > 0 && this._isServed(tiles[i - w], kind)) ||
                (y < h - 1 && this._isServed(tiles[i + w], kind));
            if (kind === 'power') tile.powered = served;
            else tile.watered = served;
        }
    }

    _isServed(tile, kind) {
        if (!tile) return false;
        const conducts = kind === 'power' ? tile.conductsPower : tile.conductsWater;
        if (!conducts) return false;
        return kind === 'power' ? tile.powered : tile.watered;
    }

    _flood(startIndex, network, conducts) {
        const map = this.map, w = map.width, h = map.height;
        const component = this._component, stack = this._stack, tiles = map.tiles;
        let top = 0;
        stack[top++] = startIndex;
        component[startIndex] = network;

        while (top > 0) {
            const index = stack[--top];
            const x = index % w, y = (index / w) | 0;
            if (x > 0 && component[index - 1] === -1 && conducts(tiles[index - 1])) {
                component[index - 1] = network; stack[top++] = index - 1;
            }
            if (x < w - 1 && component[index + 1] === -1 && conducts(tiles[index + 1])) {
                component[index + 1] = network; stack[top++] = index + 1;
            }
            if (y > 0 && component[index - w] === -1 && conducts(tiles[index - w])) {
                component[index - w] = network; stack[top++] = index - w;
            }
            if (y < h - 1 && component[index + w] === -1 && conducts(tiles[index + w])) {
                component[index + w] = network; stack[top++] = index + w;
            }
        }
    }

    _grant(consumer, kind) {
        if (kind === 'power') consumer.powered = true; else consumer.watered = true;
    }

    _deny(consumer, kind) {
        if (kind === 'power') consumer.powered = false; else consumer.watered = false;
    }

    _settleSewage() {
        let produced = 0;
        for (const building of this.zones.buildings) {
            if (!building.abandoned && building.watered) produced += building.waterDemand * SEWAGE_RATIO;
        }
        this.sewageProduced = produced;
        this.sewageCapacity = this.services.structures.reduce((sum, s) => sum + s.sewageCapacity, 0);
    }
}
