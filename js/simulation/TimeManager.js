// js/simulation/TimeManager.js
// The city clock: days, months and years, plus a 0..1 time-of-day fraction that
// traffic and lighting key off. Speed 0 is paused; 1/2/3 multiply how fast real
// milliseconds turn into simulated ones.

import { DAY_LENGTH_MS, SPEED_MULTIPLIERS, DAYS_PER_MONTH, MONTH_NAMES } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

export class TimeManager {
    constructor(speed = 1) {
        this.speed = speed;        // 0..3
        this.lastRunningSpeed = speed === 0 ? 1 : speed;
        this.day = 1;              // 1..30
        this.month = 0;            // 0..11
        this.year = 2025;
        this.msIntoDay = 0;
        this.totalDays = 0;
    }

    get paused() { return this.speed === 0; }
    get multiplier() { return SPEED_MULTIPLIERS[this.speed] ?? 1; }
    get dayFraction() { return this.msIntoDay / DAY_LENGTH_MS; }
    get hour() { return Math.floor(this.dayFraction * 24); }

    get label() {
        return `${MONTH_NAMES[this.month]} ${this.day}, ${this.year}`;
    }

    get clockLabel() {
        const minutes = Math.floor(this.dayFraction * 1440);
        const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
        const mm = String(minutes % 60).padStart(2, '0');
        return `${hh}:${mm}`;
    }

    /** How dark it is outside, 0 = noon, 1 = midnight. Drives the night tint. */
    get nightFactor() {
        const f = this.dayFraction;
        const daylight = Math.sin((f - 0.22) * Math.PI * 2 / 1.0);
        return Math.max(0, Math.min(1, 0.5 - daylight * 0.75));
    }

    setSpeed(speed) {
        this.speed = Math.max(0, Math.min(3, speed | 0));
        if (this.speed > 0) this.lastRunningSpeed = this.speed;
        eventBus.emit('time:speedChanged', this.speed);
    }

    togglePause() {
        this.setSpeed(this.paused ? this.lastRunningSpeed : 0);
        return this.paused;
    }

    /** Advance the clock. Returns simulated milliseconds elapsed. */
    update(realDtMs) {
        if (this.paused) return 0;
        const simDt = realDtMs * this.multiplier;
        this.msIntoDay += simDt;

        while (this.msIntoDay >= DAY_LENGTH_MS) {
            this.msIntoDay -= DAY_LENGTH_MS;
            this.day++;
            this.totalDays++;
            if (this.day > DAYS_PER_MONTH) {
                this.day = 1;
                this.month++;
                if (this.month > 11) { this.month = 0; this.year++; }
                eventBus.emit('time:newMonth', { month: this.month, year: this.year });
            }
            eventBus.emit('time:newDay', this.totalDays);
        }
        return simDt;
    }

    serialize() {
        return {
            speed: this.speed, day: this.day, month: this.month, year: this.year,
            msIntoDay: this.msIntoDay, totalDays: this.totalDays
        };
    }

    restore(data = {}) {
        this.speed = data.speed ?? 1;
        if (this.speed > 0) this.lastRunningSpeed = this.speed;
        this.day = data.day ?? 1;
        this.month = data.month ?? 0;
        this.year = data.year ?? 2025;
        this.msIntoDay = data.msIntoDay ?? 0;
        this.totalDays = data.totalDays ?? 0;
    }
}
