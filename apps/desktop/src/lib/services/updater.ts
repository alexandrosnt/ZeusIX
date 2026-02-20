import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export async function checkForUpdates(silent = true): Promise<void> {
	try {
		const update = await check();

		if (!update) {
			if (!silent) console.log('[updater] No update available');
			return;
		}

		console.log(`[updater] Update available: v${update.version}`);

		await update.downloadAndInstall();
		console.log('[updater] Update installed, relaunching...');
		await relaunch();
	} catch (err) {
		if (!silent) console.error('[updater] Update check failed:', err);
	}
}
