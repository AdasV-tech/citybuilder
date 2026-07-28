// js/traffic/Car.js
// A single car following a precomputed tile path. Movement is expressed as
// "distance traveled along the path" so following-distance checks between
// cars sharing a path are a cheap scalar comparison rather than per-segment math.

import { CAR_SPEED } from '../utils/Constants.js';

let nextCarId = 1;

export class Car {
    constructor(path, colorSeed = 0) {
        this.id = nextCarId++;
        this.path = path; // array of {x,y} tile coords
        this.progress = 0; // distance traveled, in tiles, along the path
        this.totalLength = Math.max(0, path.length - 1);
        this.colorSeed = colorSeed;
        this.finished = false;

        // Lane offset gives a slight perpendicular nudge so cars going opposite
        // directions on the same road tile visually pass on the correct side.
        this.laneOffset = 0.16;
    }

    get currentTileIndex() {
        return Math.min(this.path.length - 1, Math.floor(this.progress));
    }

    /** World-space (tile-unit) position with lane offset applied. */
    getPosition() {
        const i = this.currentTileIndex;
        const a = this.path[i];
        const b = this.path[Math.min(i + 1, this.path.length - 1)];
        const t = this.progress - i;
        let x = a.x + (b.x - a.x) * t;
        let y = a.y + (b.y - a.y) * t;

        // perpendicular offset based on direction of travel, drive-on-the-right
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const perpX = -dy / len, perpY = dx / len;
        x += perpX * this.laneOffset;
        y += perpY * this.laneOffset;

        return { x, y, heading: Math.atan2(dy, dx) };
    }

    /** Advance the car, clamped by maxProgress (the car ahead) to avoid overlap. */
    update(dtSeconds, maxProgress = Infinity) {
        if (this.finished) return;
        const next = Math.min(this.progress + CAR_SPEED * dtSeconds, maxProgress, this.totalLength);
        this.progress = Math.max(this.progress, next);
        if (this.progress >= this.totalLength) {
            this.finished = true;
        }
    }
}
