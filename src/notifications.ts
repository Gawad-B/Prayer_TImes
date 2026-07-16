// src/notifications.ts
// Prayer time notifications via GNOME Shell MessageTray.
//
// Uses MessageTray.Source + MessageTray.Notification so that
// notification.addAction() callbacks fire directly in-process.
// This is the only reliable way to get actionable notifications
// in a GNOME Shell extension — Gio.Application action buttons
// go through D-Bus activation and never reach the Shell process.
//
// Compatible with GNOME Shell 45–50.

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import type { PrayerName } from './constants.js';

// One persistent source reused across all notifications.
let _source: MessageTray.Source | null = null;
let _sourceDestroyId: number = 0;

function getOrCreateSource(): MessageTray.Source {
  if (_source) return _source;

  // MessageTray.Source named-property constructor (GNOME 45+)
  _source = new MessageTray.Source({
    title: 'Prayer Times',
    iconName: 'appointment-soon-symbolic',
  });

  _sourceDestroyId = _source.connect('destroy', () => {
    _source = null;
    _sourceDestroyId = 0;
  });

  Main.messageTray.add(_source);
  return _source;
}

/** Call from extension disable() to clean up the MessageTray source. */
export function destroyNotificationSource(): void {
  if (_source) {
    if (_sourceDestroyId) {
      _source.disconnect(_sourceDestroyId);
      _sourceDestroyId = 0;
    }
    _source.destroy();
    _source = null;
  }
}

/**
 * Internal helper — sends a Shell notification.
 * @param title   - Notification title
 * @param body    - Notification body
 * @param onStop  - If provided, a "Stop Adhan" action button is added that
 *                  calls this callback when clicked.
 */
function sendNotification(title: string, body: string, onStop?: () => void): void {
  try {
    const source = getOrCreateSource();

    const notification = new MessageTray.Notification({
      source,
      title,
      body,
      isTransient: onStop === undefined, // prayer-time notifications stay; others auto-dismiss
    });

    if (onStop) {
      notification.addAction('Stop Adhan', () => {
        onStop();
      });
    }

    source.addNotification(notification);
  } catch (e) {
    console.error('[Prayer] notification error:', e);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** "N minutes before prayer" reminder. No stop button. */
export function notifyBefore(prayer: PrayerName, minutesBefore: number): void {
  const title = `🕌 ${prayer} in ${minutesBefore} minutes`;
  const body  = `Time to prepare for ${prayer} prayer.`;
  sendNotification(title, body);
}

/**
 * "Prayer time NOW" notification.
 * @param onStop - Callback wired to AudioPlayer.stop().
 *                 Passed in so user can silence adhan from the notification.
 */
export function notifyPrayerTime(prayer: PrayerName, onStop?: () => void): void {
  if (prayer === 'Sunrise') {
    sendNotification('🌅 Sunrise', 'The sun has risen.');
    return;
  }
  sendNotification(
    `🕌 Time for ${prayer}`,
    `It is time for ${prayer} prayer.`,
    onStop
  );
}

/** "N minutes after prayer" reminder. No stop button. */
export function notifyAfter(prayer: PrayerName, minutesAfter: number): void {
  if (prayer === 'Sunrise') return;
  sendNotification(
    `⏰ ${prayer} reminder`,
    `${minutesAfter} minutes have passed since ${prayer} started.`
  );
}