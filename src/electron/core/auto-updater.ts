import { autoUpdater } from "electron-updater";
import { type BrowserWindow } from "electron"; // Keep for type safety, though not actively used for UI

/**
 * Sets up a silent auto-updater.
 * Checks for updates automatically shortly after app launch.
 * If an update is found, it's downloaded silently in the background.
 * The update will be installed automatically the *next* time the user quits and restarts the app.
 *
 * @param mainWindow The main browser window instance (currently unused but kept for context).
 */
export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // mainWindow isn't strictly required anymore for this logic,
  // but keeping the check is good practice.
  if (!mainWindow) {
    console.warn("AutoUpdater setup skipped: mainWindow is null.");
    return;
  }

  console.log("Setting up silent auto-updater (install on quit)...");

  // --- Configuration ---
  // Download automatically when an update is found
  autoUpdater.autoDownload = true;
  // *** Install the downloaded update when the app quits normally ***
  autoUpdater.autoInstallOnAppQuit = true;

  // --- Event Handlers (Console Logging Only) ---

  autoUpdater.on("checking-for-update", () => {
    console.log("AutoUpdater: Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    // Download starts automatically due to autoDownload = true
    console.log(`AutoUpdater: Update available (${info.version}). Download will start automatically.`);
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log("AutoUpdater: No update available.", info);
  });

  autoUpdater.on("error", (err) => {
    // Log errors but don't bother the user
    console.error("AutoUpdater: Error:", err?.message || err);
  });

  autoUpdater.on("download-progress", (progressObj) => {
    // Log progress for debugging if needed
    console.log(`AutoUpdater: Download progress: ${Math.round(progressObj.percent)}%`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    // *** DO NOTHING HERE ***
    // The update is ready. autoInstallOnAppQuit = true handles the installation
    // the next time the application is closed and reopened by the user.
    console.log(`AutoUpdater: Update downloaded (${info.version}). Ready to install on next app restart.`);
  });

  // --- Initial Check ---
  // Check shortly after app start to avoid startup bottlenecks.
  const initialCheckDelay = 15000; // 15 seconds
  console.log(`AutoUpdater: Scheduling initial check in ${initialCheckDelay / 1000} seconds.`);

  setTimeout(() => {
    console.log("AutoUpdater: Performing initial check for updates...");
    autoUpdater.checkForUpdates().catch((err) => {
      // Log initial check errors separately if desired
      console.error("AutoUpdater: Initial check failed:", err?.message || err);
    });
  }, initialCheckDelay);
  return autoUpdater;
}