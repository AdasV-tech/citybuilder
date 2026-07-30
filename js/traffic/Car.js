// js/traffic/Car.js
// One vehicle following a tile path. Position is a single scalar "distance
// travelled along the path", which makes following-distance checks between cars
// on the same road a cheap number comparison instead of vector maths.

import { CAR_SPEED } from '../utils/Constants.js';

let nextCarId = 1;

export const CAR_KIND = { COMMUTER: 0, TRUCK: 1, SERVICE: 2 };

export class Car {
    constructor(path, kind = CAR_KIND.COMMUTER) {
        this.id = nextCarId++;
        this.path = path;
        this.progress = 0;
        this.totalLength = Math.max(0, path.length - 1);
        this.kind = kind;
        this.finished = false;
        this.speedScale = 0.85 + (this.id % 7) * 0.05;   // a little personality
        this.laneOffset = kind === CAR_KIND.TRUCK ? 0.18 : 0.16;
    }

    get tileIndex() {
        return Math.min(this.path.length - 1, Math.floor(this.progress));
    }

    get tile() { return this.path[this.tileIndex]; }

    /** Interpolated tile-space position with a right-hand lane offset. */
    getPosition() {
        const i = this.tileIndex;
        const a = this.path[i];
        const b = this.path[Math.min(i + 1, this.path.length - 1)];
        const t = this.progress - i;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return {
            x: a.x + dx * t + (-dy / len) * this.laneOffset,
            y: a.y + dy * t + (dx / len) * this.laneOffset,
            heading: Math.atan2(dy, dx)
        };
    }

    /**
     * @param {number} dtSeconds
     * @param {number} maxProgress clamp set by the car ahead
     * @param {string} roadType type of the tile currently under the car
     * @param {number} congestion 0..1 on that tile
     */
    update(dtSeconds, maxProgress, roadType = 'street', congestion = 0) {
        if (this.finished) return;
        const base = CAR_SPEED[roadType] ?? CAR_SPEED.street;
        const speed = base * this.speedScale * (1 - congestion * 0.65);
        const next = Math.min(this.progress + speed * dtSeconds, maxProgress, this.totalLength);
        if (next > this.progress) this.progress = next;
        if (this.progress >= this.totalLength) this.finished = true;
    }
}
