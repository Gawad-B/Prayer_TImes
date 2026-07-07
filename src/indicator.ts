// src/indicator.ts
// GNOME Shell panel indicator: PanelMenu.Button subclass.
//
// CRITICAL GJS NOTE: GObject.registerClass subclasses CANNOT use ES class field
// initializers (e.g. `private _foo: X[] = []`). The GObject metaclass intercepts
// class construction and the initializers run before GObject's own _init chain,
// leaving fields as `undefined` when methods are called.
// RULE: declare types with `!`, assign ALL values inside _init().
 
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import type { PrayerEntry } from './prayer-manager.js';
 
export const PrayerIndicator = GObject.registerClass(
  class PrayerIndicator extends PanelMenu.Button {
    // TYPE declarations only — NO initializers.
    // All assignments in _init().
    declare private _label!: St.Label;
    declare private _prayerItems!: PopupMenu.PopupMenuItem[];
    declare private _locationPromptItem!: PopupMenu.PopupMenuItem;
 
    _init(): void {
      super._init(0.0, 'Prayer Times');
 
      // ── Initialize ALL fields here ──────────────────────────────────────
      this._prayerItems = [];
 
      this._label = new St.Label({
        text: '🕌 ...',
        y_align: Clutter.ActorAlign.CENTER,
      });
      this.add_child(this._label);
 
      // ── Popup menu ───────────────────────────────────────────────────────
      const headerItem = new PopupMenu.PopupMenuItem('🕌  Prayer Times Today', {
        reactive: false,
      });
      headerItem.label.set_style('font-weight: bold; font-size: 1.05em;');
      this.menu.addMenuItem(headerItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
 
      // Location prompt (shown only when no location set)
      this._locationPromptItem = new PopupMenu.PopupMenuItem(
        '⚙  Open Preferences to set location', { reactive: false }
      );
      this._locationPromptItem.label.set_style('color: #f0a500;');
      this._locationPromptItem.hide();
      this.menu.addMenuItem(this._locationPromptItem);
 
      // 6 prayer time rows
      for (let i = 0; i < 6; i++) {
        const item = new PopupMenu.PopupMenuItem('', { reactive: false });
        this._prayerItems.push(item);
        this.menu.addMenuItem(item);
      }
 
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    }
 
    updateLabel(label: string): void {
      if (!this._label) return; // guard against use-after-destroy
      this._label.set_text(`🕌 ${label}`);
    }
 
    showError(msg: string): void {
      if (!this._label) return;
      this._label.set_text(`🕌 ${msg}`);
    }
 
    showLocationPrompt(): void {
      if (!this._locationPromptItem) return;
      this._locationPromptItem.show();
    }
 
    hideLocationPrompt(): void {
      if (!this._locationPromptItem) return;
      this._locationPromptItem.hide();
    }
 
    updatePrayerList(entries: PrayerEntry[], nextPrayerName: string | null): void {
      if (!this._prayerItems) return;
 
      // Hide location prompt if we have entries
      if (entries.length > 0) this.hideLocationPrompt();
 
      const now = new Date();
 
      for (let i = 0; i < this._prayerItems.length; i++) {
        const item = this._prayerItems[i];
        const entry = entries[i];
 
        if (!entry) {
          item.label.set_text('');
          item.set_style('');
          continue;
        }
 
        const timeStr = entry.time.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
 
        // Monospace alignment: pad name to 8 chars
        item.label.set_text(`${entry.name.padEnd(8)}${timeStr}`);
        item.label.set_style('font-family: monospace;');
 
        if (entry.name === nextPrayerName) {
          item.set_style('font-weight: bold; color: #f0a500;');
        } else if (entry.time < now) {
          item.set_style('color: #666;');
        } else {
          item.set_style('');
        }
      }
    }
  }
);
 
export type PrayerIndicatorInstance = InstanceType<typeof PrayerIndicator>;