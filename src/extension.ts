// src/extension.ts
// Entry point for the GNOME Shell extension (GNOME 45–50).
 
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
 
import { PrayerIndicator, type PrayerIndicatorInstance } from './indicator.js';
import { PrayerManager } from './prayer-manager.js';
import { AudioPlayer } from './audio.js';
import { getCurrentLocation } from './location.js';
import { SCHEMA_ID } from './constants.js';
 
/**
 * Maps setting value → GNOME panel box + index.
 * addToStatusArea(name, indicator, position, box)
 *   far-left  → box='left',   position=0
 *   left      → box='left',   position=1
 *   center    → box='center', position=0
 *   right     → box='right',  position=1
 *   far-right → box='right',  position=0
 */
function getPanelPlacement(val: string): { box: string; position: number } {
  switch (val) {
    case 'far-left':  return { box: 'left',   position: 0 };
    case 'left':      return { box: 'left',   position: 1 };
    case 'center':    return { box: 'center', position: 0 };
    case 'far-right': return { box: 'right',  position: 0 };
    case 'right':
    default:          return { box: 'right',  position: 1 };
  }
}
 
export default class PrayerTimesExtension extends Extension {
  private _indicator: PrayerIndicatorInstance | null = null;
  private _manager: PrayerManager | null = null;
  private _audio: AudioPlayer | null = null;
  private _settings: Gio.Settings | null = null;
  private _settingsSignals: number[] = [];
 
  override enable(): void {
    this._settings = this.getSettings(SCHEMA_ID);
    this._audio    = new AudioPlayer(this.path);
    this._manager  = new PrayerManager(this._settings, this._audio);
 
    this._addIndicator();
    this._wireLabelCallback();
 
    // Watch calculation/notification/display settings
    const watchKeys = [
      'calculation-method', 'madhab', 'high-latitude-rule',
      'notify-before-minutes', 'notify-after-minutes',
      'muezzin', 'custom-audio-path', 'audio-volume',
      'show-seconds', 'show-prayer-name',
    ];
    for (const key of watchKeys) {
      this._settingsSignals.push(
        this._settings!.connect(`changed::${key}`, () => this._manager?.refresh())
      );
    }
 
    // Location changes → re-fetch
    for (const key of ['location-auto', 'latitude', 'longitude']) {
      this._settingsSignals.push(
        this._settings!.connect(`changed::${key}`, () => this._fetchLocation())
      );
    }
 
    // Position changes → re-add indicator
    this._settingsSignals.push(
      this._settings!.connect('changed::panel-position', () => {
        this._removeIndicator();
        this._addIndicator();
        this._wireLabelCallback();
        this._manager?.refresh();
      })
    );
 
    this._fetchLocation();
  }
 
  private _wireLabelCallback(): void {
    this._manager?.setLabelCallback((label) => {
      // Safe optional chain — indicator may be null during position switch
      this._indicator?.updateLabel(label);
      const entries = this._manager?.getTodayEntries() ?? [];
      const now = new Date();
      const next = entries.find((e) => e.time > now);
      this._indicator?.updatePrayerList(entries, next?.name ?? null);
    });
  }
 
  private _addIndicator(): void {
    const pos = this._settings?.get_string('panel-position') ?? 'right';
    const { box, position } = getPanelPlacement(pos);
    this._indicator = new PrayerIndicator();
    Main.panel.addToStatusArea('prayer-times', this._indicator, position, box);
  }
 
  private _removeIndicator(): void {
    this._indicator?.destroy();
    this._indicator = null;
  }
 
  private _fetchLocation(): void {
    if (!this._settings || !this._manager) return;
 
    const autoDetect = this._settings.get_boolean('location-auto');
 
    if (!autoDetect) {
      const lat = this._settings.get_double('latitude');
      const lon = this._settings.get_double('longitude');
      if (lat !== 0.0 || lon !== 0.0) {
        this._manager.setCoordinates({ latitude: lat, longitude: lon, accuracy: 0 });
      } else {
        this._indicator?.showError('Set location in prefs');
        this._indicator?.showLocationPrompt();
      }
      return;
    }
 
    // Try GeoClue — but first use cached coords so menu shows immediately
    const cachedLat = this._settings.get_double('latitude');
    const cachedLon = this._settings.get_double('longitude');
    if (cachedLat !== 0.0 || cachedLon !== 0.0) {
      // Show cached times immediately while we update location in background
      this._manager.setCoordinates({ latitude: cachedLat, longitude: cachedLon, accuracy: 0 });
    } else {
      this._indicator?.showError('Locating...');
    }
 
    // Attempt GeoClue in background
    getCurrentLocation()
      .then((coords) => {
        if (!this._settings || !this._manager) return; // disabled meanwhile
        // Only update if still in auto-detect mode (user may have switched to manual)
        if (!this._settings.get_boolean('location-auto')) return;
        this._settings.set_double('latitude', coords.latitude);
        this._settings.set_double('longitude', coords.longitude);
        this._manager.setCoordinates(coords);
      })
      .catch((err: Error) => {
        console.warn('[Prayer] GeoClue failed:', err.message);
        // Already showed cached times above — if no cache, prompt user
        if (cachedLat === 0.0 && cachedLon === 0.0) {
          this._indicator?.showError('Location failed — set in prefs');
          this._indicator?.showLocationPrompt();
        }
      });
  }
 
  override disable(): void {
    if (this._settings) {
      for (const id of this._settingsSignals) {
        this._settings.disconnect(id);
      }
      this._settingsSignals = [];
    }
    this._manager?.destroy();
    this._manager = null;
    this._audio?.destroy();
    this._audio = null;
    this._removeIndicator();
    this._settings = null;
  }
}