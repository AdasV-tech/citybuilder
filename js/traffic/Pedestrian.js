// js/traffic/Pedestrian.js
// One walker following a tile path, mirroring Car.js: position is a single
// scalar "distance travelled along the path" so following-distance checks
// between pedestrians on the same tile are a cheap number comparison.
// Pedestrians hug the kerb rather than the road centre, always offset to
// their own right-hand side of travel — same rule Car.js uses. That's what
// naturally puts two people walking toward each other on opposite sidewalks
// instead of the same one: the following-distance check below is tile-local,
// so it can't by itself stop an oncoming pair from meeting mid-tile; it's the
// geometry (always right, never a random side) that keeps them apart when it
// matters. A per-instance sign flip here would put roughly half of all
// head-on pairs on the *same* physical side with nothing to separate them —
// the walking equivalent of the "cars driving through each other" bug.

import { PEDESTRIAN_SPEED, SIDEWALK_OFFSET } from '../utils/Constants.js';

let nextPedestrianId = 1;

export function resetPedestrianIds(value = 1) { nextPedestrianId = value; }

export class Pedestrian {
    constructor(path) {
        this.id = nextPedestrianId++;
        this.path = path;
        this.progress = 0;
        this.totalLength = Math.max(0, path.length - 1);
        this.finished = false;
        this.speedScale = 0.82 + (this.id % 5) * 0.09;    // a little personality
        this.lateralOffset = SIDEWALK_OFFSET * (0.82 + (this.id % 4) * 0.12);
    }

    get tileIndex() {
        return Math.min(this.path.length - 1, Math.floor(this.progress));
    }

    get tile() { return this.path[this.tileIndex]; }

    /** Interpolated tile-space position, offset toward the sidewalk. */
    getPosition() {
        const i = this.tileIndex;
        const a = this.path[i];
        const b = this.path[Math.min(i + 1, this.path.length - 1)];
        const t = this.progress - i;
        const dx = b.x - a.x, dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const offset = this.lateralOffset;
        return {
            x: a.x + dx * t + (-dy / len) * offset,
            y: a.y + dy * t + (dx / len) * offset,
            heading: Math.atan2(dy, dx)
        };
    }

    /**
     * @param {number} dtSeconds
     * @param {number} maxProgress clamp set by the pedestrian ahead
     */
    update(dtSeconds, maxProgress) {
        if (this.finished) return;
        const speed = PEDESTRIAN_SPEED * this.speedScale;
        const next = Math.min(this.progress + speed * dtSeconds, maxProgress, this.totalLength);
        if (next > this.progress) this.progress = next;
        if (this.progress >= this.totalLength) this.finished = true;
    }
}
