// js/simulation/TimeManager.js
// Tracks simulated days and exposes a 0..1 "time of day" fraction that other
// systems (traffic commute windows, building growth) key off of. Speed only
// changes how fast the day fraction advances, per the brief.

import { DAY_LENGTH_MS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

export class TimeManager {
    constructor(speed = 'normal') {
        this.speed = speed;
        this.day = 1;
        this.msIntoDay = 0;
        this.paused = false;
    }

    setSpeed(speed) {
        if (DAY_LENGTH_MS[speed] === undefined) return;
        this.speed = speed;
        eventBus.emit('time:speedChanged', speed);
    }

    setPaused(paused) { this.paused = paused; }
    togglePaused() { this.paused = !this.paused; return this.paused; }

    get dayLengthMs() { return DAY_LENGTH_MS[this.speed]; }
    get dayFraction() { return this.msIntoDay / this.dayLengthMs; }

    /**
     * How much faster than "normal" the simulation should run at the current
     * speed. Used to scale dt for growth/traffic/economy so that Fast really
     * does make cars, growth, and money move faster in real time — not just
     * the day counter.
     */
    get simMultiplier() { return DAY_LENGTH_MS.normal / this.dayLengthMs; }

    /** Advance the clock. Returns the raw dt (ms) that occurred, for other systems to use. */
    update(realDtMs) {
        if (this.paused) return 0;
        this.msIntoDay += realDtMs;
        if (this.msIntoDay >= this.dayLengthMs) {
            this.msIntoDay -= this.dayLengthMs;
            this.day += 1;
            eventBus.emit('time:newDay', this.day);
        }
        return realDtMs;
    }

    serialize() {
        return { speed: this.speed, day: this.day, msIntoDay: this.msIntoDay };
    }

    restore(data) {
        this.speed = data.speed ?? 'normal';
        this.day = data.day ?? 1;
        this.msIntoDay = data.msIntoDay ?? 0;
    }
}
