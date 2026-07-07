// src/audio.ts
// GStreamer-based adhan audio player.
//
// Security:
//  - Custom path must be under $HOME, regular file, MIME in allowlist.
//  - URI built with GLib.filename_to_uri() — no string concat into URI.
//  - No subprocess. Gst.playbin runs in-process.
//  - Bundled sound looked up by scanning sounds/ dir — no path injection.
 
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gst from 'gi://Gst';
import { ALLOWED_AUDIO_MIME } from './constants.js';
 
let gstInitialized = false;
 
function ensureGstInit(): void {
  if (!gstInitialized) {
    Gst.init(null);
    gstInitialized = true;
  }
}
 
/**
 * Find the audio file for a given muezzin key in the sounds directory.
 * Key is the filename stem (without extension).
 * Returns absolute path or null if not found.
 */
function findSoundFile(soundsDir: string, key: string): string | null {
  const extensions = ['.ogg', '.mp3', '.flac', '.wav'];
  for (const ext of extensions) {
    const candidate = GLib.build_filenamev([soundsDir, key + ext]);
    const gfile = Gio.File.new_for_path(candidate);
    if (gfile.query_exists(null)) return candidate;
  }
  return null;
}
 
export class AudioPlayer {
  private _pipeline: Gst.Element | null = null;
  private _busWatchId: number = 0;
  private _extensionPath: string;
 
  constructor(extensionPath: string) {
    this._extensionPath = extensionPath;
  }
 
  /**
   * Play adhan audio.
   * @param muezzin - filename stem (e.g. 'azan') | 'custom' | 'muted'
   * @param customPath - used only when muezzin === 'custom'
   * @param volume - 0.0–1.0
   */
  play(muezzin: string, customPath: string, volume: number): void {
    this.stop();
 
    if (muezzin === 'muted') return;
 
    let uri: string | null = null;
 
    if (muezzin === 'custom') {
      uri = this._validateAndBuildUri(customPath);
      if (!uri) {
        console.error('[Prayer] custom audio path invalid or unsafe — skipping');
        return;
      }
    } else {
      // Look up file in sounds/ by stem name
      const soundsDir = GLib.build_filenamev([this._extensionPath, 'sounds']);
      const filePath = findSoundFile(soundsDir, muezzin);
      if (!filePath) {
        console.error(`[Prayer] sound file not found for muezzin key: ${muezzin}`);
        return;
      }
      uri = GLib.filename_to_uri(filePath, null);
    }
 
    if (!uri) return;
 
    // Lazy-init GStreamer only when actually needed
    try {
      ensureGstInit();
    } catch (e) {
      console.error('[Prayer] GStreamer init failed:', e);
      return;
    }
 
    const pipeline = Gst.ElementFactory.make('playbin', 'prayer-player');
    if (!pipeline) {
      console.error('[Prayer] GStreamer: could not create playbin element');
      return;
    }
 
    pipeline.set_property('uri', uri);
    pipeline.set_property('volume', Math.max(0, Math.min(1, volume)));
 
    // Watch bus for EOS / error → auto cleanup
    const bus = (pipeline as unknown as { get_bus(): Gst.Bus }).get_bus();
    if (bus) {
      bus.add_signal_watch();
      this._busWatchId = bus.connect('message', (_bus: Gst.Bus, msg: Gst.Message) => {
        if (msg.type === Gst.MessageType.EOS || msg.type === Gst.MessageType.ERROR) {
          if (msg.type === Gst.MessageType.ERROR) {
            const [err] = (msg as unknown as { parse_error(): [GLib.Error, string] }).parse_error();
            console.error(`[Prayer] GStreamer error: ${err.message}`);
          }
          this.stop();
        }
      });
    }
 
    const ret = pipeline.set_state(Gst.State.PLAYING);
    if (ret === Gst.StateChangeReturn.FAILURE) {
      console.error('[Prayer] GStreamer: failed to set PLAYING state');
      pipeline.set_state(Gst.State.NULL);
      return;
    }
 
    this._pipeline = pipeline;
  }
 
  stop(): void {
    if (!this._pipeline) return;
    try {
      const bus = (this._pipeline as unknown as { get_bus(): Gst.Bus }).get_bus();
      if (bus && this._busWatchId) {
        bus.disconnect(this._busWatchId);
        bus.remove_signal_watch();
        this._busWatchId = 0;
      }
      this._pipeline.set_state(Gst.State.NULL);
    } catch (e) {
      console.error('[Prayer] error stopping pipeline:', e);
    }
    this._pipeline = null;
  }
 
  destroy(): void {
    this.stop();
  }
 
  /**
   * Validate user-supplied path before passing to GStreamer.
   * 1. Absolute path
   * 2. Under $HOME (no escape)
   * 3. Regular file, exists
   * 4. MIME type in allowlist
   */
  private _validateAndBuildUri(rawPath: string): string | null {
    if (!rawPath || !rawPath.trim()) return null;
    if (!GLib.path_is_absolute(rawPath)) return null;
 
    const home = GLib.get_home_dir();
    if (!rawPath.startsWith(home + '/')) return null;
 
    const gfile = Gio.File.new_for_path(rawPath);
    let fileInfo: Gio.FileInfo;
    try {
      fileInfo = gfile.query_info(
        'standard::type,standard::content-type',
        Gio.FileQueryInfoFlags.NONE,
        null
      );
    } catch (_e) {
      return null;
    }
 
    if (fileInfo.get_file_type() !== Gio.FileType.REGULAR) return null;
 
    const mimeType = fileInfo.get_content_type();
    if (!mimeType || !ALLOWED_AUDIO_MIME.includes(mimeType)) return null;
 
    return GLib.filename_to_uri(rawPath, null);
  }
}