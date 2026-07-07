// src/constants.ts
// Shared constants and type definitions.
 
export const EXT_UUID = 'prayer-times@islamic.gnome';
export const SCHEMA_ID = 'org.gnome.shell.extensions.prayer-times';
 
/** Names of the 5 daily prayers in order. */
export const PRAYER_NAMES = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
export type PrayerName = (typeof PRAYER_NAMES)[number];
 
/** Adhan calculation method IDs matching adhan npm package exports. */
export const CALCULATION_METHODS: Record<string, string> = {
  MuslimWorldLeague: 'MuslimWorldLeague',
  NorthAmerica:      'NorthAmerica',
  MoonsightingCommittee: 'MoonsightingCommittee',
  UmmAlQura:         'UmmAlQura',
  Egyptian:          'Egyptian',
  Karachi:           'Karachi',
  Tehran:            'Tehran',
  Dubai:             'Dubai',
  Singapore:         'Singapore',
  Turkey:            'Turkey',
};
 
export const CALCULATION_METHOD_LABELS: Record<string, string> = {
  MuslimWorldLeague:     'Muslim World League',
  NorthAmerica:          'ISNA (North America)',
  MoonsightingCommittee: 'Moonsighting Committee',
  UmmAlQura:             'Umm Al-Qura (Makkah)',
  Egyptian:              'Egyptian General Authority',
  Karachi:               'University of Islamic Sciences, Karachi',
  Tehran:                'Tehran (Shia)',
  Dubai:                 'Dubai',
  Singapore:             'Singapore',
  Turkey:                'Turkey (Diyanet)',
};
 
/** Allowed audio MIME types for custom adhan files. */
export const ALLOWED_AUDIO_MIME = ['audio/ogg', 'audio/mpeg', 'audio/flac', 'audio/x-flac', 'audio/wav', 'audio/x-wav'];
 
/** GLib priority for our main-loop timers. */
export const TIMER_PRIORITY = 200; // GLib.PRIORITY_DEFAULT_IDLE
 
/** Update interval for the panel label (milliseconds). */
export const LABEL_UPDATE_MS = 10_000; // 10 seconds — precise enough, light on CPU