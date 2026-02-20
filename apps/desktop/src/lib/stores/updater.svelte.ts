import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

class UpdaterStore {
	available = $state(false);
	version = $state('');
	downloading = $state(false);

	private update: Update | null = null;
	private interval: ReturnType<typeof setInterval> | null = null;

	/** On launch: silently check and force-install if available. */
	async forceUpdate(): Promise<void> {
		try {
			const update = await check();
			if (!update) return;
			console.log(`[updater] Forcing update to v${update.version}`);
			await update.downloadAndInstall();
			await relaunch();
		} catch (err) {
			console.error('[updater] Force update failed:', err);
		}
	}

	/** Start periodic background checks (every 30 min). */
	startBackgroundCheck(intervalMs = 30 * 60 * 1000) {
		this.stopBackgroundCheck();
		const doCheck = async () => {
			try {
				const update = await check();
				if (update) {
					this.update = update;
					this.version = update.version;
					this.available = true;
				}
			} catch {}
		};
		doCheck();
		this.interval = setInterval(doCheck, intervalMs);
	}

	stopBackgroundCheck() {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}

	/** User clicked "Update now". */
	async install(): Promise<void> {
		if (!this.update) return;
		this.downloading = true;
		try {
			await this.update.downloadAndInstall();
			await relaunch();
		} catch (err) {
			console.error('[updater] Install failed:', err);
			this.downloading = false;
		}
	}

	dismiss() {
		this.available = false;
	}
}

export const updaterStore = new UpdaterStore();
