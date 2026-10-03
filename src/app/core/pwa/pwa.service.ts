import { afterNextRender, inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
@Injectable({ providedIn: 'root' })
export class PwaService {
  readonly offline = signal(false);
  readonly installable = signal(false);
  readonly updateReady = signal(false);
  private installEvent?: InstallEvent;
  constructor() {
    const updates = inject(SwUpdate, { optional: true });
    if (updates?.isEnabled)
      updates.versionUpdates.subscribe((event) => {
        if (event.type === 'VERSION_READY') this.updateReady.set(true);
      });
    afterNextRender(() => {
      this.offline.set(!navigator.onLine);
      window.addEventListener('online', () => this.offline.set(false));
      window.addEventListener('offline', () => this.offline.set(true));
      window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        this.installEvent = event as InstallEvent;
        this.installable.set(true);
      });
      window.addEventListener('appinstalled', () => {
        this.installEvent = undefined;
        this.installable.set(false);
      });
    });
  }
  async install() {
    if (!this.installEvent) return;
    await this.installEvent.prompt();
    await this.installEvent.userChoice;
    this.installEvent = undefined;
    this.installable.set(false);
  }
  reload() {
    window.location.reload();
  }
}
