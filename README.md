# Prayer Times — GNOME Shell Extension

Islamic prayer times indicator for GNOME Shell. Shows next prayer countdown in the top bar, full timetable on click, adhan audio, and smart notifications.

## Features

- **Top-bar countdown** — next prayer name + time remaining (HH:MM, optional seconds)
- **Full timetable popup** — click indicator, see all 6 prayer times for today
- **Precise calculation** — offline, Jean Meeus astronomical algorithms via `adhan` npm package
- **City-level accuracy** — GeoClue2 auto-location or manual lat/lon
- **Notifications** — N minutes before prayer and N minutes after (both configurable, 0 = off)
- **Adhan audio** — bundled muezzins (Makkah, Madinah/`medina`, Egypt) or custom audio file, GStreamer playback
- **Mute option** — `muted` muezzin choice silences all adhan audio
- **Panel position** — far-left / left / center / right / far-right, switch takes effect immediately
- **Location prompt** — shown in menu when no location set yet

## Requirements

- GNOME Shell 45–50
- GStreamer 1.0 with `playbin` element (`gstreamer1.0-plugins-good`)
- GeoClue2 (optional, for auto-location)

**Note:** bundled adhan audio files (`sounds/makkah.*`, `sounds/medina.*`, `sounds/egypt.*`) must be present in the extension's `sounds/` directory before `make install`. Extension does not ship with audio files by default — supply your own OGG/MP3/FLAC/WAV, filename stem must match the muezzin key exactly.

## Build & Install

```bash
# Install build dependencies (once)
npm install

# Type check
npm run typecheck

# Build
npm run build

# Compile GSettings schema + install to ~/.local/share/gnome-shell/extensions/
make install

# Restart GNOME Shell
# Wayland: log out and back in
# X11: Alt+F2 → type "r" → Enter
```

## Settings Schema

`org.gnome.shell.extensions.prayer-times` — keys grouped as:

| Group | Keys |
|---|---|
| Location | `location-auto`, `latitude`, `longitude`, `location-name` |
| Calculation | `calculation-method`, `madhab`, `high-latitude-rule` |
| Notifications | `notify-before-minutes`, `notify-after-minutes` |
| Audio | `muezzin`, `custom-audio-path`, `audio-volume` |
| Display | `show-seconds`, `show-prayer-name`, `panel-position` |

## Calculation Methods

| ID | Authority |
|---|---|
| `MuslimWorldLeague` | Muslim World League (default) |
| `NorthAmerica` | ISNA |
| `UmmAlQura` | Umm Al-Qura University, Makkah |
| `Egyptian` | Egyptian General Authority of Survey |
| `Karachi` | University of Islamic Sciences, Karachi |
| `Tehran` | Institute of Geophysics, Tehran |
| `Dubai` | Dubai |
| `Singapore` | Singapore |
| `Turkey` | Diyanet İşleri Başkanlığı |
| `MoonsightingCommittee` | Moonsighting Committee |

## Security

- Zero network requests — all calculation offline
- Location via system GeoClue2 IPC only — no HTTP geolocation
- Custom audio validated — path must be under `$HOME`, MIME checked (`audio/ogg`, `audio/mpeg`, `audio/flac`, `audio/x-flac`, `audio/wav`, `audio/x-wav`) before GStreamer load
- No subprocess spawning — audio via in-process GStreamer, notifications via `Gio.Notification`
- All GLib timers tracked, cleaned up on `disable()`
- GSettings-only persistence, no raw file reads/writes for settings

## Adding Your Own Adhan Audio

1. Open extension preferences → Audio tab
2. Select "Custom audio file…" as muezzin
3. Choose OGG/MP3/FLAC/WAV file under `$HOME`

## Troubleshooting: Adhan Not Playing

1. Confirm `sounds/` dir under extension install path holds a file whose stem matches selected muezzin key (`makkah`, `medina`, `egypt`)
2. Confirm `gstreamer1.0-plugins-good` installed
3. Check logs: `journalctl -f -o cat | grep Prayer`
4. If custom audio: path under `$HOME`, MIME allowed, file exists
5. Check `audio-volume` setting > 0, `muezzin` not set to `muted`

## License

GPL-2.0-or-later
