// src/location.ts
// Wraps GeoClue2 via GObject Introspection.
// Provides a single async function to get current coordinates.
// No network calls — uses system location services only.
 
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
 
export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
}
 
// GeoClue2 accuracy levels
const GEOCLUE_ACCURACY_EXACT = 8; // GeoclueAccuracyLevel.EXACT
 
/**
 * Get current location via GeoClue2.
 * Returns a promise that resolves with Coordinates or rejects on failure.
 *
 * Security note: uses system GeoClue2 IPC — no HTTP calls.
 * Requires GNOME location services enabled in Settings → Privacy → Location.
 */
export function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    // Use raw D-Bus because Geoclue GI typelib may not be installed on all distros.
    // This is safer and avoids optional dependency issues.
    try {
      const proxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'org.freedesktop.GeoClue2',
        '/org/freedesktop/GeoClue2/Manager',
        'org.freedesktop.GeoClue2.Manager',
        null
      );
 
      // GetClient → returns object path
      const result = proxy.call_sync(
        'GetClient',
        null,
        Gio.DBusCallFlags.NONE,
        -1,
        null
      );
 
      if (!result) {
        reject(new Error('GeoClue2: GetClient returned null'));
        return;
      }
 
      const [clientPath] = result.deep_unpack() as [string];
 
      const clientProxy = Gio.DBusProxy.new_for_bus_sync(
        Gio.BusType.SYSTEM,
        Gio.DBusProxyFlags.NONE,
        null,
        'org.freedesktop.GeoClue2',
        clientPath,
        'org.freedesktop.GeoClue2.Client',
        null
      );
 
      // Set desktop ID and accuracy level
      clientProxy.set_cached_property('DesktopId', GLib.Variant.new_string('prayer-times@islamic.gnome'));
      clientProxy.set_cached_property('RequestedAccuracyLevel', GLib.Variant.new_uint32(GEOCLUE_ACCURACY_EXACT));
 
      // Listen for LocationUpdated signal
      let signalId = 0;
      const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 15_000, () => {
        if (signalId) {
          clientProxy.disconnect(signalId);
        }
        clientProxy.call_sync('Stop', null, Gio.DBusCallFlags.NONE, -1, null);
        reject(new Error('GeoClue2: timed out after 15s'));
        return GLib.SOURCE_REMOVE;
      });
 
      signalId = clientProxy.connect('g-signal', (_proxy: Gio.DBusProxy, _sender: string | null, signalName: string, parameters: GLib.Variant) => {
        if (signalName !== 'LocationUpdated') return;
 
        GLib.source_remove(timeoutId);
        clientProxy.disconnect(signalId);
        clientProxy.call_sync('Stop', null, Gio.DBusCallFlags.NONE, -1, null);
 
        const [, newPath] = parameters.deep_unpack() as [string, string];
 
        try {
          const locProxy = Gio.DBusProxy.new_for_bus_sync(
            Gio.BusType.SYSTEM,
            Gio.DBusProxyFlags.NONE,
            null,
            'org.freedesktop.GeoClue2',
            newPath,
            'org.freedesktop.GeoClue2.Location',
            null
          );
 
          const lat = locProxy.get_cached_property('Latitude')?.unpack() as number;
          const lon = locProxy.get_cached_property('Longitude')?.unpack() as number;
          const acc = locProxy.get_cached_property('Accuracy')?.unpack() as number;
 
          if (typeof lat !== 'number' || typeof lon !== 'number') {
            reject(new Error('GeoClue2: invalid coordinates received'));
            return;
          }
 
          resolve({ latitude: lat, longitude: lon, accuracy: acc ?? 0 });
        } catch (e) {
          reject(e);
        }
      });
 
      // Start the client
      clientProxy.call_sync('Start', null, Gio.DBusCallFlags.NONE, -1, null);
 
    } catch (e) {
      reject(e);
    }
  });
}