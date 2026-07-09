import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type { PrayerName } from './constants.js';

const APP_ID = 'prayer-times@gawad-b.github.io';
let _actionCounter = 0;

/**
 * Send notification with optional "Stop Adhan" action button.
 * Action registered on default Gio.Application (GNOME Shell), unique name
 * per call to avoid collision, removed after activation or after 60s TTL.
 */
function sendNotification(title: string, body: string, id: string, onStop?: () => void): void {
  try {
    const notification = new Gio.Notification();
    notification.set_title(title);
    notification.set_body(body);
    notification.set_priority(Gio.NotificationPriority.HIGH);
    notification.set_default_action('app.show');

    const app = Gio.Application.get_default();

    if (app && onStop) {
      const actionName = `stop-adhan-${_actionCounter++}`;
      const action = new Gio.SimpleAction({ name: actionName });

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) return;
        cleaned = true;
        app.remove_action(actionName);
      };

      action.connect('activate', () => {
        onStop();
        app.withdraw_notification(id);
        cleanup();
      });

      app.add_action(action);
      notification.add_button('Stop Adhan', `app.${actionName}`);

      // Safety cleanup — action orphan if notification ignored/expire
      GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 60, () => {
        cleanup();
        return GLib.SOURCE_REMOVE;
      });
    }

    if (app) {
      app.send_notification(id, notification);
    } else {
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

export function notifyBefore(prayer: PrayerName, minutesBefore: number): void {
  const title = `🕌 ${prayer} in ${minutesBefore} minutes`;
  const body = `Time to prepare for ${prayer} prayer.`;
  sendNotification(title, body, `prayer-before-${prayer.toLowerCase()}`);
}

/**
 * "Prayer time NOW" notification. onStop wire to AudioPlayer.stop()
 * so user silence adhan mid-play from notification itself.
 */
export function notifyPrayerTime(prayer: PrayerName, onStop?: () => void): void {
  const title = prayer === 'Sunrise' ? '🌅 Sunrise' : `🕌 Time for ${prayer}`;
  const body = prayer === 'Sunrise'
    ? 'The sun has risen.'
    : `It is time for ${prayer} prayer.`;
  sendNotification(title, body, `prayer-now-${prayer.toLowerCase()}`, onStop);
}

export function notifyAfter(prayer: PrayerName, minutesAfter: number): void {
  if (prayer === 'Sunrise') return;
  const title = `⏰ ${prayer} reminder`;
  const body = `${minutesAfter} minutes have passed since ${prayer} started.`;
  sendNotification(title, body, `prayer-after-${prayer.toLowerCase()}`);
}