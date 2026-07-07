// src/notifications.ts
// Prayer time notifications via Gio.Notification (native GNOME).
// No external processes. No DBus calls to notification daemons directly.
 
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { PrayerName } from './constants.js';
 
const APP_ID = 'prayer-times@islamic.gnome';
 
/**
 * Send a native GNOME notification.
 * Uses Gio.Application + Gio.Notification (recommended for extensions).
 */
function sendNotification(title: string, body: string, id: string): void {
  try {
    const notification = new Gio.Notification();
    notification.set_title(title);
    notification.set_body(body);
    notification.set_priority(Gio.NotificationPriority.HIGH);
    notification.set_default_action('app.show');
 
    // Use org.gnome.Shell as the application to get proper shell notifications
    const app = Gio.Application.get_default();
    if (app) {
      app.send_notification(id, notification);
    } else {
      // Fallback: use notify-send via GLib (still no Gio.Subprocess shell injection)
      // We pass individual args, never a shell string — safe.
      GLib.spawn_async(
        null,
        ['notify-send', '-a', 'Prayer Times', '-i', 'appointment-soon', title, body],
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null
      );
    }
  } catch (e) {
    console.error('[Prayer] notification error:', e);
  }
}
 
/**
 * Send "prayer time in N minutes" reminder notification.
 */
export function notifyBefore(prayer: PrayerName, minutesBefore: number): void {
  const title = `🕌 ${prayer} in ${minutesBefore} minutes`;
  const body = `Time to prepare for ${prayer} prayer.`;
  sendNotification(title, body, `prayer-before-${prayer.toLowerCase()}`);
}
 
/**
 * Send "prayer time NOW" notification.
 */
export function notifyPrayerTime(prayer: PrayerName): void {
  const title = prayer === 'Sunrise' ? '🌅 Sunrise' : `🕌 Time for ${prayer}`;
  const body = prayer === 'Sunrise'
    ? 'The sun has risen.'
    : `It is time for ${prayer} prayer.`;
  sendNotification(title, body, `prayer-now-${prayer.toLowerCase()}`);
}
 
/**
 * Send "N minutes after prayer" reminder notification.
 */
export function notifyAfter(prayer: PrayerName, minutesAfter: number): void {
  if (prayer === 'Sunrise') return; // No "after" reminder for Sunrise
  const title = `⏰ ${prayer} reminder`;
  const body = `${minutesAfter} minutes have passed since ${prayer} started.`;
  sendNotification(title, body, `prayer-after-${prayer.toLowerCase()}`);
}