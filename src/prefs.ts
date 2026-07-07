// src/prefs.ts
// Extension preferences window using Adwaita (libadwaita).
// Compatible with GNOME 45–50.
//
// NOTE: Gtk.FileDialog was introduced in GTK 4.10 / GNOME 44.
// We use Gtk.FileChooserNative instead — available from GTK 4.0,
// works on all supported GNOME versions.
 
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
 
import {
  SCHEMA_ID,
  CALCULATION_METHOD_LABELS,
  ALLOWED_AUDIO_MIME,
} from './constants.js';
 
export default class PrayerTimesPrefs extends ExtensionPreferences {
  // Extension install path — available via this.path
  private _extPath: string = '';
 
  override fillPreferencesWindow(window: Adw.PreferencesWindow): void {
    this._extPath = this.path;
    const settings = this.getSettings(SCHEMA_ID);
    window.set_default_size(620, 760);
 
    window.add(this._buildLocationPage(settings));
    window.add(this._buildCalculationPage(settings));
    window.add(this._buildNotificationsPage(settings));
    window.add(this._buildAudioPage(settings, window));
    window.add(this._buildDisplayPage(settings));
  }
 
  // ─── Location ────────────────────────────────────────────────────────────────
 
  private _buildLocationPage(settings: Gio.Settings): Adw.PreferencesPage {
    const page = new Adw.PreferencesPage({
      title: 'Location',
      icon_name: 'find-location-symbolic',
    });
 
    const group = new Adw.PreferencesGroup({ title: 'Location Source' });
    page.add(group);
 
    const autoRow = new Adw.SwitchRow({
      title: 'Auto-detect location',
      subtitle: 'Uses system GeoClue2 — no internet required',
    });
    settings.bind('location-auto', autoRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    group.add(autoRow);
 
    // SpinRow saves on every value-change — no apply signal needed.
    // Step 0.0001 ≈ 11 m precision, sufficient for prayer times.
    const latRow = new Adw.SpinRow({
      title: 'Latitude',
      subtitle: 'e.g. 30.0444 for Cairo',
      adjustment: new Gtk.Adjustment({
        lower: -90,
        upper: 90,
        step_increment: 0.0001,
        page_increment: 1,
        value: settings.get_double('latitude'),
      }),
      digits: 4,
    });
    latRow.connect('notify::value', () => {
      settings.set_double('latitude', latRow.get_value());
    });
    settings.bind('location-auto', latRow, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
    group.add(latRow);
 
    const lonRow = new Adw.SpinRow({
      title: 'Longitude',
      subtitle: 'e.g. 31.2357 for Cairo',
      adjustment: new Gtk.Adjustment({
        lower: -180,
        upper: 180,
        step_increment: 0.0001,
        page_increment: 1,
        value: settings.get_double('longitude'),
      }),
      digits: 4,
    });
    lonRow.connect('notify::value', () => {
      settings.set_double('longitude', lonRow.get_value());
    });
    settings.bind('location-auto', lonRow, 'sensitive', Gio.SettingsBindFlags.INVERT_BOOLEAN);
    group.add(lonRow);
 
    const privacyRow = new Adw.ActionRow({
      title: 'Location stays on your device',
      subtitle: 'Never sent over the network. Used only for prayer calculation.',
      icon_name: 'security-high-symbolic',
      activatable: false,
    });
    group.add(privacyRow);
 
    return page;
 
  }
 
  // ─── Calculation ──────────────────────────────────────────────────────────────
 
  private _buildCalculationPage(settings: Gio.Settings): Adw.PreferencesPage {
    const page = new Adw.PreferencesPage({
      title: 'Calculation',
      icon_name: 'preferences-system-time-symbolic',
    });
 
    const group = new Adw.PreferencesGroup({ title: 'Prayer Calculation Method' });
    page.add(group);
 
    // Calculation method
    const methodKeys  = Object.keys(CALCULATION_METHOD_LABELS);
    const methodLabels = methodKeys.map((k) => CALCULATION_METHOD_LABELS[k]);
    const methodModel = Gtk.StringList.new(methodLabels);
 
    const methodRow = new Adw.ComboRow({
      title: 'Calculation method',
      subtitle: 'Defines Fajr and Isha angles',
      model: methodModel,
    });
    const curMethod = settings.get_string('calculation-method');
    methodRow.set_selected(Math.max(0, methodKeys.indexOf(curMethod)));
    methodRow.connect('notify::selected', () => {
      const idx = methodRow.get_selected();
      if (idx < methodKeys.length) settings.set_string('calculation-method', methodKeys[idx]);
    });
    group.add(methodRow);
 
    // Madhab
    const madhabModel = Gtk.StringList.new(['Shafi / Maliki / Hanbali (standard)', 'Hanafi (later Asr)']);
    const madhabRow = new Adw.ComboRow({
      title: 'Madhab (Asr shadow ratio)',
      model: madhabModel,
    });
    madhabRow.set_selected(settings.get_string('madhab') === 'Hanafi' ? 1 : 0);
    madhabRow.connect('notify::selected', () => {
      settings.set_string('madhab', madhabRow.get_selected() === 1 ? 'Hanafi' : 'Shafi');
    });
    group.add(madhabRow);
 
    // High latitude rule
    const hlrOptions: [string, string][] = [
      ['None', 'None (equatorial/tropical)'],
      ['MiddleOfTheNight', 'Middle of the Night'],
      ['SeventhOfTheNight', 'Seventh of the Night'],
      ['TwilightAngle', 'Twilight Angle'],
    ];
    const hlrModel = Gtk.StringList.new(hlrOptions.map(([, l]) => l));
    const hlrRow = new Adw.ComboRow({
      title: 'High latitude rule',
      subtitle: 'For locations above ~48°N/S',
      model: hlrModel,
    });
    const curHlr = settings.get_string('high-latitude-rule');
    hlrRow.set_selected(Math.max(0, hlrOptions.findIndex(([k]) => k === curHlr)));
    hlrRow.connect('notify::selected', () => {
      const idx = hlrRow.get_selected();
      settings.set_string('high-latitude-rule', hlrOptions[idx]?.[0] ?? 'None');
    });
    group.add(hlrRow);
 
    return page;
  }
 
  // ─── Notifications ────────────────────────────────────────────────────────────
 
  private _buildNotificationsPage(settings: Gio.Settings): Adw.PreferencesPage {
    const page = new Adw.PreferencesPage({
      title: 'Notifications',
      icon_name: 'preferences-system-notifications-symbolic',
    });
 
    const group = new Adw.PreferencesGroup({ title: 'Reminder Timing' });
    page.add(group);
 
    const beforeRow = new Adw.SpinRow({
      title: 'Notify before prayer (minutes)',
      subtitle: '0 = disabled',
      adjustment: new Gtk.Adjustment({
        lower: 0, upper: 60, step_increment: 1,
        value: settings.get_int('notify-before-minutes'),
      }),
    });
    beforeRow.connect('notify::value', () => {
      settings.set_int('notify-before-minutes', beforeRow.get_value());
    });
    group.add(beforeRow);
 
    const afterRow = new Adw.SpinRow({
      title: 'Remind again after prayer (minutes)',
      subtitle: '0 = disabled',
      adjustment: new Gtk.Adjustment({
        lower: 0, upper: 60, step_increment: 1,
        value: settings.get_int('notify-after-minutes'),
      }),
    });
    afterRow.connect('notify::value', () => {
      settings.set_int('notify-after-minutes', afterRow.get_value());
    });
    group.add(afterRow);
 
    return page;
  }
 
  // ─── Audio ────────────────────────────────────────────────────────────────────
 
  private _buildAudioPage(settings: Gio.Settings, parentWindow: Adw.PreferencesWindow): Adw.PreferencesPage {
    const page = new Adw.PreferencesPage({
      title: 'Audio',
      icon_name: 'audio-speakers-symbolic',
    });
 
    // --- Bundled / built-in sounds ---
    const bundledGroup = new Adw.PreferencesGroup({ title: 'Bundled Adhan Sounds' });
    page.add(bundledGroup);
 
    // Scan the sounds/ folder in the extension install path
    const soundsDir = GLib.build_filenamev([this._extPath, 'sounds']);
    const availableSounds = this._scanSoundsDir(soundsDir);
 
    // Build muezzin list: bundled files + custom + muted
    const muezzinOptions: [string, string][] = [];
    for (const [key, label] of availableSounds) {
      muezzinOptions.push([key, label]);
    }
    muezzinOptions.push(['custom', 'Custom audio file…']);
    muezzinOptions.push(['muted', 'Muted (no audio)']);
 
    const muezzinModel = Gtk.StringList.new(muezzinOptions.map(([, l]) => l));
    const muezzinRow = new Adw.ComboRow({
      title: 'Muezzin',
      subtitle: 'Which adhan to play at prayer time',
      model: muezzinModel,
    });
 
    const curMuezzin = settings.get_string('muezzin');
    const curMuezzinIdx = muezzinOptions.findIndex(([k]) => k === curMuezzin);
    muezzinRow.set_selected(Math.max(0, curMuezzinIdx));
 
    // Track whether custom row is visible
    let isCustomSelected = curMuezzin === 'custom';
 
    bundledGroup.add(muezzinRow);
 
    // Available sounds info row
    if (availableSounds.length === 0) {
      const noSoundsRow = new Adw.ActionRow({
        title: 'No bundled sounds found',
        subtitle: `Add OGG/MP3 files to: ${soundsDir}`,
        icon_name: 'dialog-warning-symbolic',
        activatable: false,
      });
      bundledGroup.add(noSoundsRow);
    } else {
      const soundsInfoRow = new Adw.ActionRow({
        title: `${availableSounds.length} sound(s) found`,
        subtitle: soundsDir,
        icon_name: 'folder-music-symbolic',
        activatable: false,
      });
      bundledGroup.add(soundsInfoRow);
    }
 
    // --- Custom audio ---
    const customGroup = new Adw.PreferencesGroup({ title: 'Custom Audio File' });
    page.add(customGroup);
 
    const currentCustomPath = settings.get_string('custom-audio-path');
    const customFileRow = new Adw.ActionRow({
      title: 'Audio file',
      subtitle: currentCustomPath || 'No file selected',
      activatable: false,
    });
    customGroup.set_sensitive(isCustomSelected);
 
    const fileButton = new Gtk.Button({
      label: 'Choose…',
      valign: Gtk.Align.CENTER,
    });
    fileButton.connect('clicked', () => {
      // Use FileChooserNative — available on GTK 4.0, works on all GNOME 45-50
      const chooser = new Gtk.FileChooserNative({
        title: 'Select Adhan Audio File',
        action: Gtk.FileChooserAction.OPEN,
        accept_label: 'Open',
        cancel_label: 'Cancel',
        transient_for: parentWindow,
        modal: true,
      });
 
      const audioFilter = new Gtk.FileFilter();
      audioFilter.set_name('Audio files (OGG, MP3, FLAC, WAV)');
      audioFilter.add_mime_type('audio/ogg');
      audioFilter.add_mime_type('audio/mpeg');
      audioFilter.add_mime_type('audio/flac');
      audioFilter.add_mime_type('audio/x-flac');
      audioFilter.add_mime_type('audio/wav');
      audioFilter.add_mime_type('audio/x-wav');
      audioFilter.add_pattern('*.ogg');
      audioFilter.add_pattern('*.mp3');
      audioFilter.add_pattern('*.flac');
      audioFilter.add_pattern('*.wav');
      chooser.add_filter(audioFilter);
 
      const allFilter = new Gtk.FileFilter();
      allFilter.set_name('All files');
      allFilter.add_pattern('*');
      chooser.add_filter(allFilter);
 
      // Pre-select current file if exists
      const currentPath = settings.get_string('custom-audio-path');
      if (currentPath) {
        try {
          chooser.set_file(Gio.File.new_for_path(currentPath));
        } catch (_e) { /* ignore */ }
      }
 
      chooser.connect('response', (dlg: Gtk.FileChooserNative, responseId: number) => {
        if (responseId !== Gtk.ResponseType.ACCEPT) return;
 
        const file = dlg.get_file();
        if (!file) return;
 
        const path = file.get_path();
        if (!path) return;
 
        // Security: must be under $HOME
        const home = GLib.get_home_dir();
        if (!path.startsWith(home + '/')) {
          console.warn('[Prayer] prefs: rejected path outside $HOME:', path);
          return;
        }
 
        // Security: validate MIME type
        let mimeType: string | null = null;
        try {
          const info = file.query_info('standard::content-type', Gio.FileQueryInfoFlags.NONE, null);
          mimeType = info.get_content_type();
        } catch (_e) {
          console.warn('[Prayer] prefs: could not read MIME type');
          return;
        }
        if (!mimeType || !ALLOWED_AUDIO_MIME.includes(mimeType)) {
          console.warn('[Prayer] prefs: rejected MIME type:', mimeType);
          return;
        }
 
        settings.set_string('custom-audio-path', path);
        customFileRow.set_subtitle(path);
      });
 
      chooser.show();
    });
 
    const clearButton = new Gtk.Button({
      label: 'Clear',
      valign: Gtk.Align.CENTER,
      css_classes: ['destructive-action'],
    });
    clearButton.connect('clicked', () => {
      settings.set_string('custom-audio-path', '');
      customFileRow.set_subtitle('No file selected');
    });
 
    customFileRow.add_suffix(clearButton);
    customFileRow.add_suffix(fileButton);
    customGroup.add(customFileRow);
 
    // Wire muezzin selection → enable/disable custom group
    muezzinRow.connect('notify::selected', () => {
      const idx = muezzinRow.get_selected();
      const selected = muezzinOptions[idx]?.[0] ?? 'makkah';
      settings.set_string('muezzin', selected);
      isCustomSelected = selected === 'custom';
      customGroup.set_sensitive(isCustomSelected);
    });
 
    // --- Volume ---
    const volumeGroup = new Adw.PreferencesGroup({ title: 'Volume' });
    page.add(volumeGroup);
 
    const volumeRow = new Adw.ActionRow({ title: 'Adhan volume' });
    const volumeScale = new Gtk.Scale({
      orientation: Gtk.Orientation.HORIZONTAL,
      adjustment: new Gtk.Adjustment({
        lower: 0, upper: 1, step_increment: 0.05,
        value: settings.get_double('audio-volume'),
      }),
      draw_value: true,
      value_pos: Gtk.PositionType.RIGHT,
      hexpand: true,
      valign: Gtk.Align.CENTER,
    });
    volumeScale.set_digits(2);
    volumeScale.connect('value-changed', () => {
      settings.set_double('audio-volume', volumeScale.get_value());
    });
    volumeRow.add_suffix(volumeScale);
    volumeGroup.add(volumeRow);
 
    return page;
  }
 
  // ─── Display ──────────────────────────────────────────────────────────────────
 
  private _buildDisplayPage(settings: Gio.Settings): Adw.PreferencesPage {
    const page = new Adw.PreferencesPage({
      title: 'Display',
      icon_name: 'video-display-symbolic',
    });
 
    // Panel label options
    const labelGroup = new Adw.PreferencesGroup({ title: 'Panel Label' });
    page.add(labelGroup);
 
    const showNameRow = new Adw.SwitchRow({
      title: 'Show prayer name',
      subtitle: 'e.g. "Dhuhr 02:35" vs just "02:35"',
    });
    settings.bind('show-prayer-name', showNameRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    labelGroup.add(showNameRow);
 
    const showSecRow = new Adw.SwitchRow({
      title: 'Show seconds in countdown',
    });
    settings.bind('show-seconds', showSecRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    labelGroup.add(showSecRow);
 
    // Panel position
    const posGroup = new Adw.PreferencesGroup({ title: 'Panel Position' });
    page.add(posGroup);
 
    const posOptions: [string, string][] = [
      ['far-left',  '⟸ Far Left  (leftmost)'],
      ['left',      '← Left'],
      ['center',    '— Center'],
      ['right',     '→ Right'],
      ['far-right', '⟹ Far Right (rightmost, near clock)'],
    ];
    const posModel = Gtk.StringList.new(posOptions.map(([, l]) => l));
    const posRow = new Adw.ComboRow({
      title: 'Position in top bar',
      subtitle: 'Takes effect immediately',
      model: posModel,
    });
 
    const curPos = settings.get_string('panel-position');
    posRow.set_selected(Math.max(0, posOptions.findIndex(([k]) => k === curPos)));
    posRow.connect('notify::selected', () => {
      const idx = posRow.get_selected();
      settings.set_string('panel-position', posOptions[idx]?.[0] ?? 'right');
    });
    posGroup.add(posRow);
 
    return page;
  }
 
  // ─── Helpers ──────────────────────────────────────────────────────────────────
 
  /**
   * Scan the sounds/ directory and return [key, label] pairs.
   * key = filename without extension (used as muezzin setting value)
   * label = display name
   */
  private _scanSoundsDir(soundsDir: string): [string, string][] {
    const result: [string, string][] = [];
    try {
      const dir = Gio.File.new_for_path(soundsDir);
      const enumerator = dir.enumerate_children(
        'standard::name,standard::type',
        Gio.FileQueryInfoFlags.NONE,
        null
      );
 
      let info: Gio.FileInfo | null;
      while ((info = enumerator.next_file(null)) !== null) {
        const name = info.get_name();
        if (!name) continue;
        // Only accept audio extensions
        const lower = name.toLowerCase();
        if (!lower.endsWith('.ogg') && !lower.endsWith('.mp3') &&
            !lower.endsWith('.flac') && !lower.endsWith('.wav')) continue;
 
        // Key = filename without extension
        const key = name.replace(/\.[^.]+$/, '');
        // Label = capitalize first letter, replace underscores/dashes with spaces
        const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/[-_]/g, ' ');
        result.push([key, label]);
      }
      enumerator.close(null);
    } catch (e) {
      console.warn('[Prayer] prefs: could not scan sounds dir:', soundsDir, e);
    }
    return result;
  }
}