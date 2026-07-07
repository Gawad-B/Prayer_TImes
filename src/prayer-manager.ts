// src/prayer-manager.ts
// Core prayer time calculation and scheduling engine.
//
// Uses the `adhan` npm package (bundled by esbuild).
// All calculation is done offline — zero network requests.
//
// Scheduling strategy:
//   - One GLib.timeout every LABEL_UPDATE_MS (10 s) to update the panel label.
//   - Separate per-prayer GLib.timeout_add_seconds() for notifications/adhan.
//   - At midnight (or on date change), times are recomputed.
 
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
 
import {
  Coordinates,
  PrayerTimes,
  CalculationMethod,
  CalculationParameters,
  Madhab,
  HighLatitudeRule,
} from 'adhan';
 
import type { Coordinates as GeoCoords } from './location.js';
import { type PrayerName, LABEL_UPDATE_MS } from './constants.js';
import { notifyBefore, notifyPrayerTime, notifyAfter } from './notifications.js';
import { AudioPlayer } from './audio.js';
 
export interface PrayerEntry {
  name: PrayerName;
  time: Date;
}
 
/** Callback: receives panel label text. */
export type LabelCallback = (label: string) => void;
 
export class PrayerManager {
  private _settings: Gio.Settings;
  private _audio: AudioPlayer;
  private _coords: GeoCoords | null = null;
  private _todayTimes: PrayerEntry[] = [];
  private _tomorrowFajr: Date | null = null;
 
  // GLib source IDs — must all be removed on destroy()
  private _labelTimerId: number = 0;
  private _prayerTimers: number[] = [];
 
  private _labelCallback: LabelCallback | null = null;
 
  constructor(settings: Gio.Settings, audio: AudioPlayer) {
    this._settings = settings;
    this._audio = audio;
  }
 
  setLabelCallback(cb: LabelCallback): void {
    this._labelCallback = cb;
  }
 
  setCoordinates(coords: GeoCoords): void {
    this._coords = coords;
    this._recompute();
  }
 
  /** Compute today's prayer times and reschedule all timers. */
  private _recompute(): void {
    this._clearPrayerTimers();
 
    if (!this._coords) return;
 
    const now = new Date();
    const params = this._buildParams();
    const coords = new Coordinates(this._coords.latitude, this._coords.longitude);
 
    const times = new PrayerTimes(coords, now, params);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowTimes = new PrayerTimes(coords, tomorrowDate, params);
 
    this._todayTimes = this._extractEntries(times);
    this._tomorrowFajr = tomorrowTimes.fajr;
 
    this._scheduleAllNotifications(now);
    this._startLabelTimer();
  }
 
  private _buildParams(): CalculationParameters {
    const methodKey = this._settings.get_string('calculation-method');
    const madhabKey = this._settings.get_string('madhab');
    const hlrKey    = this._settings.get_string('high-latitude-rule');
 
    // Retrieve calculation method — fallback to MuslimWorldLeague
    type MethodKey = keyof typeof CalculationMethod;
    const methodFn = CalculationMethod[methodKey as MethodKey] as (() => CalculationParameters) | undefined;
    const params: CalculationParameters = typeof methodFn === 'function'
      ? methodFn()
      : CalculationMethod.MuslimWorldLeague();
 
    params.madhab = madhabKey === 'Hanafi' ? Madhab.Hanafi : Madhab.Shafi;
 
    if (hlrKey !== 'None') {
      type HLRKey = keyof typeof HighLatitudeRule;
      params.highLatitudeRule = HighLatitudeRule[hlrKey as HLRKey] ?? HighLatitudeRule.MiddleOfTheNight;
    }
 
    return params;
  }
 
  private _extractEntries(times: PrayerTimes): PrayerEntry[] {
    return [
      { name: 'Fajr',    time: times.fajr },
      { name: 'Sunrise', time: times.sunrise },
      { name: 'Dhuhr',   time: times.dhuhr },
      { name: 'Asr',     time: times.asr },
      { name: 'Maghrib', time: times.maghrib },
      { name: 'Isha',    time: times.isha },
    ] satisfies PrayerEntry[];
  }
 
  private _scheduleAllNotifications(now: Date): void {
    const beforeMin = this._settings.get_int('notify-before-minutes');
    const afterMin  = this._settings.get_int('notify-after-minutes');
 
    for (const entry of this._todayTimes) {
      const msToTime = entry.time.getTime() - now.getTime();
 
      // "Before" notification
      if (beforeMin > 0) {
        const msBefore = msToTime - beforeMin * 60_000;
        if (msBefore > 0) {
          const secBefore = Math.floor(msBefore / 1000);
          this._prayerTimers.push(
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secBefore, () => {
              notifyBefore(entry.name, beforeMin);
              return GLib.SOURCE_REMOVE;
            })
          );
        }
      }
 
      // "At time" notification + adhan
      if (msToTime > 0) {
        const secToTime = Math.floor(msToTime / 1000);
        this._prayerTimers.push(
          GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secToTime, () => {
            notifyPrayerTime(entry.name);
            if (entry.name !== 'Sunrise') {
              this._audio.play(
                this._settings.get_string('muezzin'),
                this._settings.get_string('custom-audio-path'),
                this._settings.get_double('audio-volume')
              );
            }
            return GLib.SOURCE_REMOVE;
          })
        );
      }
 
      // "After" notification
      if (afterMin > 0 && entry.name !== 'Sunrise') {
        const msAfter = msToTime + afterMin * 60_000;
        if (msAfter > 0) {
          const secAfter = Math.floor(msAfter / 1000);
          this._prayerTimers.push(
            GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secAfter, () => {
              notifyAfter(entry.name, afterMin);
              return GLib.SOURCE_REMOVE;
            })
          );
        }
      }
    }
 
    // Midnight recompute — schedule recompute at tomorrow's Fajr time minus 1 hour
    // so new day's times are ready before Fajr.
    if (this._tomorrowFajr) {
      const msToMidnightRecompute = this._tomorrowFajr.getTime() - 3600_000 - now.getTime();
      if (msToMidnightRecompute > 0) {
        const secToRecompute = Math.floor(msToMidnightRecompute / 1000);
        this._prayerTimers.push(
          GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, secToRecompute, () => {
            this._recompute();
            return GLib.SOURCE_REMOVE;
          })
        );
      }
    }
  }
 
  private _startLabelTimer(): void {
    this._stopLabelTimer();
    // Immediate update
    this._updateLabel();
    // Then every 10 seconds
    this._labelTimerId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, LABEL_UPDATE_MS, () => {
      this._updateLabel();
      return GLib.SOURCE_CONTINUE;
    });
  }
 
  private _stopLabelTimer(): void {
    if (this._labelTimerId) {
      GLib.source_remove(this._labelTimerId);
      this._labelTimerId = 0;
    }
  }
 
  private _clearPrayerTimers(): void {
    for (const id of this._prayerTimers) {
      GLib.source_remove(id);
    }
    this._prayerTimers = [];
  }
 
  private _updateLabel(): void {
    if (!this._labelCallback) return;
    const now = new Date();
    const { nextPrayer, timeRemaining } = this._getNextPrayerInfo(now);
 
    let label: string;
    if (!nextPrayer) {
      label = '🕌';
    } else {
      const showName = this._settings.get_boolean('show-prayer-name');
      const showSec  = this._settings.get_boolean('show-seconds');
      const parts: string[] = [];
      if (showName) parts.push(nextPrayer.name);
      parts.push(this._formatDuration(timeRemaining, showSec));
      label = parts.join(' ');
    }
 
    this._labelCallback(label);
  }
 
  private _getNextPrayerInfo(now: Date): { nextPrayer: PrayerEntry | null; timeRemaining: number } {
    let nextPrayer: PrayerEntry | null = null;
    let timeRemaining = 0;
 
    // First check today's remaining prayers
    for (const entry of this._todayTimes) {
      const diff = entry.time.getTime() - now.getTime();
      if (diff > 0) {
        nextPrayer = entry;
        timeRemaining = diff;
        break;
      }
    }
 
    // If all today's prayers passed, show tomorrow's Fajr
    if (!nextPrayer && this._tomorrowFajr) {
      nextPrayer = { name: 'Fajr', time: this._tomorrowFajr };
      timeRemaining = this._tomorrowFajr.getTime() - now.getTime();
    }
 
    return { nextPrayer, timeRemaining };
  }
 
  /** Format milliseconds into "HH:MM" or "HH:MM:SS". */
  private _formatDuration(ms: number, showSeconds: boolean): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
 
    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
 
    if (showSeconds) {
      return `${hStr}:${mStr}:${String(s).padStart(2, '0')}`;
    }
    return `${hStr}:${mStr}`;
  }
 
  /** Return current today's prayer entries (for popup menu display). */
  getTodayEntries(): PrayerEntry[] {
    return [...this._todayTimes];
  }
 
  /** Force re-read settings and recompute (call when settings change). */
  refresh(): void {
    this._recompute();
  }
 
  destroy(): void {
    this._stopLabelTimer();
    this._clearPrayerTimers();
    this._labelCallback = null;
  }
}