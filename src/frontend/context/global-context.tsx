// context/global-context.tsx


import { appConfig } from "@/lib/app-config"
import type { DeepPartial, GlobalSettings } from "@/types" // Adjust path
import { createContext, useState, useEffect, useContext, useCallback, useMemo, type ReactNode } from "react"

// --- Notification Types (Keep as is) ---
export interface VersionInfo {
  version: string
  releaseDate: string
  downloadUrl: string
  changelog?: string[]
}

export interface NotificationAction {
  label: string
  url?: string
  type: "link" | "action" | "dismiss"
  actionId?: string
}

export interface Notification {
  id: string
  type: "info" | "warning" | "error" | "update"
  title: string
  message: string
  priority: number
  startDate: string
  endDate?: string
  dismissible: boolean
  isRead: boolean
  actions?: NotificationAction[]
  displayType?: "modal" | "toast" | "list"
}

export interface YtdlpVersions {
  stable: VersionInfo | null
  nightly: VersionInfo | null
}

// --- App Config API Response Types ---
interface AppConfigResponse {
  success: boolean
  timestamp: string
  data: {
    ytdlp: {
      stable: VersionInfo
      nightly: VersionInfo
    }
    app: {
      latestVersion: VersionInfo
    }
    notifications: Notification[]
  }
}


export type AppState = {
  criticalProcessing: {
    playlistFetching?: boolean
  } | null
}


export type YtdlpUpdateType = "stable" | "nightly"
export type LocalYtdlpType = YtdlpUpdateType | "unknown"


export interface GlobalContextTypes {
  
  globalSettings: GlobalSettings | null
  isSettingsLoading: boolean
  settingsError: string | null
  refreshGlobalSettings: () => Promise<void>
  updateGlobalSettings: (update: DeepPartial<GlobalSettings>) => Promise<boolean> 

  // YT-DLP Binary Info & Update Status
  binaries: {
    localYtdlpVersion: string | null
    localYtdlpType: LocalYtdlpType
    latestYtdlpVersions: YtdlpVersions | null 
    targetVersionForUpdate: VersionInfo | null 
    needsUpdate: boolean 
    isUpdating: boolean 
    lastChecked: Date | null 
    updateCheckError: string | null 
    isCheckingForUpdates: boolean 
  }
  updateYtdlpTo: (type: YtdlpUpdateType) => Promise<boolean> 
  checkForUpdates: (force?: boolean) => Promise<void> 

  
  notifications: Notification[]
  dismissNotification: (id: string) => void
  markAllNotificationsAsRead: () => void
  executeNotificationAction: (notificationId: string, actionId: string) => void

  // App State Management
  appState: AppState | null
  setPlaylistProcessing: (isProcessing: boolean) => void
}

// --- Initial States ---
const initialBinariesState = {
  localYtdlpVersion: null,
  localYtdlpType: "unknown" as LocalYtdlpType,
  latestYtdlpVersions: null,
  targetVersionForUpdate: null,
  needsUpdate: false,
  isUpdating: false,
  lastChecked: null,
  updateCheckError: null,
  isCheckingForUpdates: false,
}

const initialAppState: AppState = {
  criticalProcessing: { playlistFetching: false },
}

// --- Context Definition ---
const GlobalContext = createContext<GlobalContextTypes | undefined>(undefined)

export const useGlobalContext = () => {
  const context = useContext(GlobalContext)
  if (context === undefined) {
    throw new Error("useGlobalContext must be used within a GlobalContextProvider")
  }
  return context
}


export const determineYtdlpType = (version: string | null): LocalYtdlpType => {
  if (!version) return "unknown"
  const nightlyRegex = /^\d{4}\.\d{2}\.\d{2}\.\d+$/ // YYYY.MM.DD.build
  const nightlyDotRegex = /^\d{4}\.\d{2}\.\d{2}\.nightly\.\d+$/ // YYYY.MM.DD.nightly.build
  const stableRegex = /^\d{4}\.\d{2}\.\d{2}$/ // YYYY.MM.DD

  if (nightlyRegex.test(version) || nightlyDotRegex.test(version)) return "nightly"
  if (stableRegex.test(version)) return "stable"
  return "unknown"
}

const isNewerVersion = (v1: string, v2: string): boolean => {
  if (!v1) return true // If no local version, any remote version is newer
  if (!v2) return false // If no remote version, local is considered newer or same

  // Simple lexicographical comparison often works for YYYY.MM.DD based versions
  
  const parseVersion = (v: string) => v.split(".").map((part) => Number.parseInt(part.replace("nightly", "0"), 10) || 0) 

  const parts1 = parseVersion(v1)
  const parts2 = parseVersion(v2)

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const num1 = parts1[i] || 0 // Pad with 0 if one version string is shorter
    const num2 = parts2[i] || 0

    if (num2 > num1) return true
    if (num2 < num1) return false
  }

  return false // Versions are identical
}

// --- Provider Component ---
export const GlobalContextProvider = ({
  children,
}: {
  children: ReactNode
}) => {
  // Settings State
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null)
  const [isSettingsLoading, setIsSettingsLoading] = useState<boolean>(true)
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // Binaries State
  const [binaries, setBinaries] = useState(initialBinariesState)

  // Notifications State (Now loaded from API)
  const [notifications, setNotifications] = useState<Notification[]>([])

  // App State
  const [appState, setAppState] = useState<AppState | null>(initialAppState)

  // --- Effects ---

  // 1. Load Global Settings on Mount
  useEffect(() => {
    const loadInitialSettings = async () => {
      if (!window?.electronAPI?.settings?.getSettings) {
        console.error("Settings API not available on mount.")
        setSettingsError("Critical Error: Cannot load application settings.")
        setIsSettingsLoading(false)
        return
      }
      console.log("Attempting to load initial settings...")
      setIsSettingsLoading(true)
      setSettingsError(null)
      try {
        const { success, data } = await window.electronAPI.settings.getSettings()
        if (success && data) {
          console.log("Initial settings loaded successfully:", data)
          setGlobalSettings(data)
        } else {
          throw new Error("Failed to load settings data.")
        }
      } catch (err: any) {
        console.error("Failed to load initial settings:", err)
        setSettingsError(err.message || "An unknown error occurred while loading settings.")
        setGlobalSettings(null) // Ensure settings are null on error
      } finally {
        setIsSettingsLoading(false)
      }
    }
    loadInitialSettings()
  }, []) // Run only once

  // 2. Load Local YT-DLP Version & Check for Updates on Settings Load/Change
  useEffect(() => {
    if (globalSettings && !isSettingsLoading) {
      console.log("Global settings loaded/changed, initiating version load and update check...")
      // Load local version first
      loadLocalYtdlpVersion().then(() => {
        // Then check for updates if enabled
        if (globalSettings.site.autoCheckUpdates) {
          console.log("Auto-check for updates enabled, running check...")
          checkForUpdates() // Don't force check here, respect frequency
        } else {
          console.log("Auto-check for updates disabled.")
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalSettings, isSettingsLoading]) // Re-run when settings are loaded or change

  // 3. Load notification read status from localStorage on mount
  useEffect(() => {
    const loadNotificationReadStatus = () => {
      try {
        const savedReadStatus = localStorage.getItem("notification-read-status")
        if (savedReadStatus) {
          const readStatusMap = JSON.parse(savedReadStatus)
          // Apply read status to notifications
          setNotifications((prev) =>
            prev.map((notification) => ({
              ...notification,
              isRead: readStatusMap[notification.id] === true || notification.isRead,
            })),
          )
        }
      } catch (error) {
        console.error("Failed to load notification read status from localStorage:", error)
      }
    }

    loadNotificationReadStatus()
  }, [])

  // 4. Save notification read status to localStorage when it changes
  useEffect(() => {
    if (notifications.length > 0) {
      try {
        const readStatusMap = notifications.reduce(
          (acc, notification) => {
            acc[notification.id] = notification.isRead
            return acc
          },
          {} as Record<string, boolean>,
        )

        localStorage.setItem("notification-read-status", JSON.stringify(readStatusMap))
      } catch (error) {
        console.error("Failed to save notification read status to localStorage:", error)
      }
    }
  }, [notifications])

  // 5. Load dismissed notification IDs from localStorage on mount
  useEffect(() => {
    const loadDismissedNotifications = () => {
      try {
        const savedDismissedIds = localStorage.getItem("notification-dismissed-ids")
        if (savedDismissedIds) {
          const dismissedIds = JSON.parse(savedDismissedIds) as string[]
          // Filter out any notifications that were previously dismissed
          setNotifications((prev) => prev.filter((notification) => !dismissedIds.includes(notification.id)))
        }
      } catch (error) {
        console.error("Failed to load dismissed notification IDs from localStorage:", error)
      }
    }

    loadDismissedNotifications()
  }, [])


  // --- Settings Management ---
  const refreshGlobalSettings = useCallback(async () => {
    if (!window?.electronAPI?.settings?.getSettings) {
      console.error("Settings API not available for refresh.")
      return
    }
    console.log("Refreshing global settings...")
    setIsSettingsLoading(true) // Indicate loading during refresh
    setSettingsError(null)
    try {
      const { success, data } = await window.electronAPI.settings.getSettings()
      if (success && data) {
        console.log("Global settings refreshed successfully.")
        setGlobalSettings(data)
      } else {
        throw new Error("Failed to refresh settings data.")
      }
    } catch (err: any) {
      console.error("Failed to refresh global settings:", err)
      // Keep existing settings on error, but maybe show a temporary error message?
      setSettingsError(`Failed to refresh settings: ${err.message}`)
    } finally {
      setIsSettingsLoading(false)
    }
  }, [])

  const updateGlobalSettings = useCallback(
    async (settingsUpdate: DeepPartial<GlobalSettings>): Promise<boolean> => {
      if (!window?.electronAPI?.settings?.updateSettings) {
        console.error("Settings API not available for update.")
        return false // Indicate failure
      }
      console.log("Attempting to update global settings via API:", settingsUpdate)
      try {
        
        

        const { success, data } = await window.electronAPI.settings.updateSettings(settingsUpdate)
        if (success && data) {
          console.log("Global settings updated successfully via API.")
          setGlobalSettings(data) // Update context with the confirmed saved state
          return true // Indicate success
        } else {
          throw new Error("Failed to update settings via API.")
        }
      } catch (err: any) {
        console.error("Failed to update global settings:", err)
        

        addNotification({
          id: `settings-update-error-${Date.now()}`,
          type: "error",
          title: "Settings Update Failed",
          message: err.message || "Failed to update settings",
          priority: 3,
          startDate: new Date().toISOString(),
          dismissible: true,
          actions: [
            {
              label: "Try Again",
              actionId: "retry-settings-update",
              type: "action",
            },
          ],
          isRead: false,
        })
        await refreshGlobalSettings() 
        return false // Indicate failure
      }
    },
    [refreshGlobalSettings],
  )

  // --- YT-DLP Version & Update Management ---

  const loadLocalYtdlpVersion = useCallback(
    async (setState = true): Promise<string | null> => {
      if (!window.electronAPI?.executeCommand) {
        console.error("Electron API not available for version check.")
        if (setState) {
          setBinaries((prev) => ({
            ...prev,
            updateCheckError: "Cannot check local version: API unavailable.",
          }))
        }
        return null
      }
      console.log("Loading local yt-dlp version...")
      try {
        // Ensure ytdlp path from settings is used if available, otherwise rely on PATH
        const ytdlpPath = globalSettings?.ytdlp?.ytdlpPath
        const command = ytdlpPath ? [ytdlpPath, "--version"] : ["yt-dlp", "--version"] 
        console.log("Executing command:", command)
        const { success, data } = await window.electronAPI.executeCommand(["--version"]) 

        if (success && data?.stdout) {
          const version = data.stdout.trim()
          const type = determineYtdlpType(version)
          if (setState) {
            setBinaries((prev) => ({
              ...prev,
              localYtdlpVersion: version,
              localYtdlpType: type,
              updateCheckError: null, // Clear previous error on success
            }))
          }
          console.log(`Local YT-DLP version: ${version} (Type: ${type})`)
          return version
        } else {
          throw new Error(data?.stderr || "Failed to execute version command.")
        }
      } catch (err: any) {
        console.error("Error getting local YT-DLP version:", err)
        if (setState) {
          setBinaries((prev) => ({
            ...prev,
            localYtdlpVersion: null,
            localYtdlpType: "unknown",
            updateCheckError: `Failed to get local version: ${err.message}`,
          }))
        }
        return null
      }
    },
    [globalSettings?.ytdlp?.ytdlpPath],
  ) // Depend on yt-dlp path setting

  // Fetch latest versions from API
  const fetchAppConfigFromApi = async (): Promise<{
    ytdlpVersions: YtdlpVersions
    appVersion: VersionInfo | null
    apiNotifications: Notification[]
  }> => {
    console.log("Fetching app config from API...")

    try {
      const response = await fetch(`${appConfig.apiBase}/api/app-config`)

      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      const data: AppConfigResponse = await response.json()

      if (!data.success) {
        throw new Error("API returned unsuccessful response")
      }

      console.log("API Response:", data)

      // Extract YT-DLP versions
      const ytdlpVersions: YtdlpVersions = {
        stable: data.data.ytdlp.stable,
        nightly: data.data.ytdlp.nightly,
      }

      // Extract app version
      const appVersion = data.data.app.latestVersion

      // Extract notifications
      const apiNotifications = data.data.notifications

      return {
        ytdlpVersions,
        appVersion,
        apiNotifications,
      }
    } catch (error) {
      console.error("Error fetching from API:", error)
      throw error
    }
  }

  const calculateUpdateStatus = useCallback(
    (
      localVersion: string | null,
      localType: LocalYtdlpType,
      latestVersions: YtdlpVersions | null,
      preferNightly: boolean, // From globalSettings.site
    ): { needsUpdate: boolean; targetVersion: VersionInfo | null } => {
      if (!latestVersions || (!latestVersions.stable && !latestVersions.nightly)) {
        console.log("Calculation skipped: No latest version info available.")
        return { needsUpdate: false, targetVersion: null }
      }

      // Determine the channel the user *effectively* wants based on preference
      const preferredChannel: YtdlpUpdateType = preferNightly ? "nightly" : "stable"
      const preferredVersionInfo = latestVersions[preferredChannel]

      // Determine the channel to *potentially* update *to*. This might differ from preference
      // if the user explicitly wants to stay on their current channel.
      // Let's prioritize the user's preference for the "target" version display.
      let targetVersionForDisplay = preferredVersionInfo

      // If the preferred channel has no update, but the *other* channel does,
      // we might still offer the other channel as an *alternative* update target,
      // but the primary "needsUpdate" flag should reflect the preferred channel.
      if (!targetVersionForDisplay) {
        console.log(`No version info found for preferred channel (${preferredChannel}).`)
        // Optional: Check if the other channel exists as a fallback target display?
        const alternativeChannel = preferNightly ? "stable" : "nightly"
        targetVersionForDisplay = latestVersions[alternativeChannel]
        if (targetVersionForDisplay) {
          console.log(`Using alternative channel (${alternativeChannel}) as potential update target.`)
        } else {
          console.log("No version info found for alternative channel either.")
          return { needsUpdate: false, targetVersion: null } // No target possible
        }
      }

      // Now, check if the *currently installed* version is older than the *targetVersionForDisplay*.
      const updateAvailableForTarget =
        localVersion && targetVersionForDisplay
          ? isNewerVersion(localVersion, targetVersionForDisplay.version)
          : !!targetVersionForDisplay // Update needed if no local version but remote exists

      // Determine if the main "Update Needed" flag should be true.
      // This should be true if the *preferred* channel has a newer version available.
      let isUpdateNeededForPreferred = false
      if (preferredVersionInfo) {
        isUpdateNeededForPreferred = localVersion ? isNewerVersion(localVersion, preferredVersionInfo.version) : true // Needs update if preferred exists and local doesn't
      }

      console.log("Update Status Calculation:", {
        localVersion,
        localType,
        preferNightly,
        preferredChannel,
        preferredVersion: preferredVersionInfo?.version,
        targetVersionForDisplay: targetVersionForDisplay?.version,
        updateAvailableForTarget,
        isUpdateNeededForPreferred,
      })

      // The 'needsUpdate' flag signals if the *preferred* channel requires an update.
      // The 'targetVersion' reflects the best candidate for update (usually the preferred one).
      return {
        needsUpdate: isUpdateNeededForPreferred,
        targetVersion: targetVersionForDisplay,
      }
    },
    [],
  )

  const checkForUpdates = useCallback(
    async (force = false) => {
      if (!globalSettings) {
        console.log("Update check skipped: Global settings not loaded yet.")
        return
      }

      // Frequency Check
      const now = new Date()
      const lastCheck = binaries.lastChecked
      const frequency = globalSettings.site.checkFrequency
      if (!force && lastCheck && frequency !== "never") {
        let intervalMs = 0
        switch (frequency) {
          case "hourly":
            intervalMs = 60 * 60 * 1000
            break
          case "daily":
            intervalMs = 24 * 60 * 60 * 1000
            break
          case "weekly":
            intervalMs = 7 * 24 * 60 * 60 * 1000
            break
          case "monthly":
            intervalMs = 30 * 24 * 60 * 60 * 1000
            break // Approx
        }
        if (now.getTime() - lastCheck.getTime() < intervalMs) {
          console.log(
            `Update check skipped: Within frequency interval (${frequency}). Last check: ${lastCheck.toISOString()}`,
          )
          return
        }
      }

      console.log("Checking for YT-DLP updates...")
      setBinaries((prev) => ({
        ...prev,
        isCheckingForUpdates: true,
        updateCheckError: null,
      }))

      try {
        // 1. Ensure local version is known
        let currentLocalVersion = binaries.localYtdlpVersion
        if (!currentLocalVersion) {
          console.log("Local version unknown, attempting to load...")
          currentLocalVersion = await loadLocalYtdlpVersion(false) // Load without setting state
          if (!currentLocalVersion) {
            console.warn("Failed to load local version during update check.")
            // Proceed without local version, update status will reflect this
          }
        }
        const currentLocalType = determineYtdlpType(currentLocalVersion) // Use the loaded version

        // 2. Fetch latest versions from API
        const { ytdlpVersions, apiNotifications } = await fetchAppConfigFromApi()

        // 3. Calculate update status using the helper and settings preference
        const preferNightly = globalSettings.site.preferNightlyYtdlp
        const { needsUpdate, targetVersion } = calculateUpdateStatus(
          currentLocalVersion,
          currentLocalType,
          ytdlpVersions,
          preferNightly,
        )

        // 4. Update State
        const checkTime = new Date()
        setBinaries((prev) => ({
          ...prev,
          // Keep local version info as determined above
          localYtdlpVersion: currentLocalVersion,
          localYtdlpType: currentLocalType,
          latestYtdlpVersions: ytdlpVersions,
          needsUpdate: needsUpdate,
          targetVersionForUpdate: targetVersion,
          lastChecked: checkTime,
          isCheckingForUpdates: false, // Done checking
          updateCheckError: null, // Clear error on success
        }))

        // 5. Process Notifications from API
        // Merge with existing notifications, preserving read status
        processApiNotifications(apiNotifications)

        console.log(
          `Update check complete. Needs update (preferred): ${needsUpdate}. Target: ${
            targetVersion?.version ?? "None"
          }`,
        )

        // 6. Handle Auto-Update Logic (Based on Global Settings)
        if (
          needsUpdate && // Update needed for the *preferred* channel
          targetVersion && // A target version exists
          globalSettings.site.autoUpdateYtdlp && // Auto-update enabled
          !binaries.isUpdating // Not already updating
        ) {
          const typeToUpdate = determineYtdlpType(targetVersion.version)
          // Auto-update only if the target version type MATCHES the preferred channel type
          // This prevents auto-switching from stable to nightly or vice-versa unintentionally.
          const preferredChannelType = preferNightly ? "nightly" : "stable"
          if (typeToUpdate === preferredChannelType) {
            console.log(`Auto-update triggered for preferred channel: ${typeToUpdate}`)
            await updateYtdlpTo(typeToUpdate) // Await the update
          } else {
            console.log(
              `Auto-update skipped: Target version type (${typeToUpdate}) does not match preferred channel (${preferredChannelType}).`,
            )
          }
        } else {
          if (!needsUpdate) console.log("Auto-update skipped: No update needed for preferred channel.")
          if (!targetVersion) console.log("Auto-update skipped: No target version available.")
          if (!globalSettings.site.autoUpdateYtdlp) console.log("Auto-update skipped: Disabled in settings.")
          if (binaries.isUpdating) console.log("Auto-update skipped: Already updating.")
        }
      } catch (err: any) {
        console.error("Error during update check process:", err)
        const message = err.message || "An unknown error occurred during update check"
        setBinaries((prev) => ({
          ...prev,
          isCheckingForUpdates: false,
          updateCheckError: message,
          lastChecked: new Date(), // Record check time even on failure
        }))
        // Add error notification
        addNotification({
          id: `error-update-check-${Date.now()}`,
          type: "error",
          title: "YT-DLP Update Check Failed",
          message: message.length > 100 ? message.substring(0, 97) + "..." : message,
          priority: 3,
          startDate: new Date().toISOString(),
          dismissible: true,
          actions: [
            {
              label: "Try Again",
              actionId: "retry-update-check",
              type: "action",
            },
          ],
          isRead: false,
        })
      }
    },
    [globalSettings, binaries.localYtdlpVersion, binaries.isUpdating, loadLocalYtdlpVersion, calculateUpdateStatus],
  )

  const updateYtdlpTo = useCallback(
    async (type: YtdlpUpdateType): Promise<boolean> => {
      if (!window.electronAPI?.executeCommand) {
        console.error("Electron API not available for update.")
        setBinaries((prev) => ({
          ...prev,
          updateCheckError: "Cannot update YT-DLP: API unavailable.",
        }))
        return false
      }
      if (binaries.isUpdating) {
        console.warn("Update request ignored: Already updating.")
        return false
      }

      console.log(`Attempting to update YT-DLP to latest ${type}...`)
      setBinaries((prev) => ({
        ...prev,
        isUpdating: true,
        updateCheckError: null,
      }))

      let success = false
      let finalErrorMessage: string | null = null

      try {
        // Use specific command yt-dlp provides for updating to channels
        const command = type === "stable" ? ["--update-to", "stable@latest"] : ["--update-to", "nightly"]
        console.log(`Executing YT-DLP update command: yt-dlp ${command.join(" ")}`)

        const { success: cmdSuccess, data } = await window.electronAPI.executeCommand(command)

        if (!cmdSuccess) {
          const stderr = data?.stderr?.toLowerCase() || ""
          console.error("Update command failed:", stderr)
          if (stderr.includes("is not writeable") || stderr.includes("permission denied")) {
            throw new Error(
              "Update failed: Permission denied. Try running as administrator or check folder permissions.",
            )
          } else if (
            stderr.includes("urlopen error") ||
            stderr.includes("connection") ||
            stderr.includes("network is unreachable")
          ) {
            throw new Error("Update failed: Network error connecting to update server.")
          } else if (stderr.includes("already up-to-date")) {
            // This isn't really an error, but the command might return non-zero exit code
            console.log(`Update command reported already up-to-date for ${type}. Verifying version...`)
            // Force a re-check of the local version to confirm
            const currentVersion = await loadLocalYtdlpVersion(true) // Update state with potentially confirmed version
            if (currentVersion) {
              success = true // Assume success if version check works after "up-to-date" message
            } else {
              throw new Error("Update command reported 'up-to-date', but failed to verify local version afterwards.")
            }
          } else {
            throw new Error(stderr || "Update command failed with an unknown error.")
          }
        }

        // If command succeeded or was 'already up-to-date' and verified
        if (cmdSuccess || success) {
          console.log(
            `Update command successful (or already up-to-date). Verifying new version... Output: ${
              data?.stdout || "N/A"
            }`,
          )
          const newVersion = await loadLocalYtdlpVersion(true) // Load and set state with new version

          if (!newVersion) {
            throw new Error("Update seems to have succeeded, but failed to verify the new version.")
          }

          const newType = determineYtdlpType(newVersion)
          console.log(`Successfully updated/verified to ${newVersion} (Type: ${newType})`)
          success = true // Confirm success

          // Immediately recalculate update status based on the *just installed* version
          const preferNightly = globalSettings?.site?.preferNightlyYtdlp ?? false
          const { needsUpdate: newNeedsUpdate, targetVersion: newTargetVersion } = calculateUpdateStatus(
            newVersion,
            newType,
            binaries.latestYtdlpVersions, // Use the previously fetched latest versions
            preferNightly,
          )

          // Update state fully: new version, type, update status, and clear updating flag
          setBinaries((prev) => ({
            ...prev,
            localYtdlpVersion: newVersion,
            localYtdlpType: newType,
            needsUpdate: newNeedsUpdate,
            targetVersionForUpdate: newTargetVersion,
            isUpdating: false, // Crucial: Set updating to false *here* on success
            lastChecked: new Date(), // Update last checked time after successful update
            updateCheckError: null,
          }))

          // Add success notification
          addNotification({
            id: `update-success-${type}-${Date.now()}`,
            type: "info",
            title: `YT-DLP Update Successful (${type})`,
            message: `Now using version ${newVersion}`,
            priority: 2,
            startDate: new Date().toISOString(),
            dismissible: true,
            isRead: false,
          })

          // Remove any old 'update available' or 'update failed' notifications for this type
          setNotifications((prev) =>
            prev.filter(
              (n) =>
                !(n.type === "update" && n.message.includes(type)) &&
                !(n.type === "error" && n.title.includes(`Update to ${type} Failed`)),
            ),
          )
        }
      } catch (err: any) {
        console.error(`Error updating YT-DLP to ${type}:`, err)
        finalErrorMessage = err.message || `Failed to update YT-DLP to ${type}`
        setBinaries((prev) => ({
          ...prev,
          isUpdating: false, // Ensure updating is false on failure
          updateCheckError: finalErrorMessage,
        }))
        // Add error notification
        addNotification({
          id: `update-error-${type}-${Date.now()}`,
          type: "error",
          title: `Update to ${type} Failed`,
          message: finalErrorMessage.length > 100 ? finalErrorMessage.substring(0, 97) + "..." : finalErrorMessage,
          priority: 4,
          startDate: new Date().toISOString(),
          dismissible: true,
          actions: [
            {
              label: "Try Again",
              actionId: `retry-ytdlp-update-${type}`,
              type: "action",
            },
          ],
          isRead: false,
        })
        success = false
      }

      return success
    },
    [
      binaries.isUpdating,
      binaries.latestYtdlpVersions,
      globalSettings?.site?.preferNightlyYtdlp,
      calculateUpdateStatus,
      loadLocalYtdlpVersion,
    ],
  )

  // --- Notification Management ---

  // Process notifications from API and merge with existing ones
  const processApiNotifications = useCallback((apiNotifications: Notification[]) => {
    // Get dismissed notification IDs from localStorage
    let dismissedIds: string[] = []
    try {
      const savedDismissedIds = localStorage.getItem("notification-dismissed-ids")
      dismissedIds = savedDismissedIds ? (JSON.parse(savedDismissedIds) as string[]) : []
    } catch (error) {
      console.error("Failed to load dismissed notification IDs:", error)
    }

    setNotifications((prevNotifications) => {
      // Create a map of existing notifications by ID for quick lookup
      const existingNotificationsMap = prevNotifications.reduce(
        (map, notification) => {
          map[notification.id] = notification
          return map
        },
        {} as Record<string, Notification>,
      )

      // Process each API notification, filtering out dismissed ones
      const mergedNotifications = apiNotifications
        .filter((notification) => !dismissedIds.includes(notification.id)) // Filter out dismissed notifications
        .map((apiNotification) => {
          const existingNotification = existingNotificationsMap[apiNotification.id]

          // If notification already exists, preserve its read status
          if (existingNotification) {
            return {
              ...apiNotification,
              isRead: existingNotification.isRead,
            }
          }

          // Otherwise use the API-provided read status or default to false
          return apiNotification
        })

      return mergedNotifications
    })
  }, [])

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      // Check if notification with same ID already exists
      const existingIndex = prev.findIndex((n) => n.id === notification.id)
      if (existingIndex > -1) {
        // Replace existing notification, keeping its read status unless explicitly overwritten
        const updatedNotifications = [...prev]
        updatedNotifications[existingIndex] = {
          ...notification,
          isRead: notification.isRead ?? prev[existingIndex].isRead, // Keep old read status if new one isn't provided
        }
        return updatedNotifications
      } else {
        // Add new notification to the beginning (making it most recent)
        return [{ ...notification, isRead: notification.isRead ?? false }, ...prev]
      }
    })
  }, [])

  const dismissNotification = useCallback((id: string) => {
    // First, remove the notification from state
    setNotifications((prev) => prev.filter((notification) => notification.id !== id))

    // Then, save the dismissed ID to localStorage
    try {
      const savedDismissedIds = localStorage.getItem("notification-dismissed-ids")
      const dismissedIds = savedDismissedIds ? (JSON.parse(savedDismissedIds) as string[]) : []

      // Add the new ID if it's not already in the list
      if (!dismissedIds.includes(id)) {
        dismissedIds.push(id)
        localStorage.setItem("notification-dismissed-ids", JSON.stringify(dismissedIds))
      }
    } catch (error) {
      console.error("Failed to save dismissed notification ID to localStorage:", error)
    }
  }, [])

  const markAllNotificationsAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => (notification.isRead ? notification : { ...notification, isRead: true })),
    )
  }, [])

  const executeNotificationAction = useCallback(
    (notificationId: string, actionId: string) => {
      console.log(`Executing action: ${actionId} for notification: ${notificationId}`)
      const notification = notifications.find((n) => n.id === notificationId)
      const action = notification?.actions?.find((a) => a.actionId === actionId)

      if (!action) return

      // Mark notification as read when an action is taken
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)))

      switch (actionId) {
        case "retry-update-check":
          checkForUpdates(true) // Force check
          break
        case "retry-ytdlp-update-stable":
          updateYtdlpTo("stable")
          break
        case "retry-ytdlp-update-nightly":
          updateYtdlpTo("nightly")
          break
        case "retry-settings-update":
          // This would need to store the last settings update attempt
          console.log("Settings update retry requested, but no stored update to retry")
          break
        // Add other specific actions here
        default:
          console.warn("Unknown notification action:", actionId)
      }

      // Dismiss notification after action if it's a dismiss action
      if (action.type === "dismiss") {
        dismissNotification(notificationId)
      }
      // Dismiss after any 'action' type action
      if (action.type === "action") {
        dismissNotification(notificationId)
      }
    },
    [notifications, checkForUpdates, updateYtdlpTo, dismissNotification],
  )

  // --- App State Management ---
  const setPlaylistProcessing = useCallback((isProcessing: boolean) => {
    setAppState((prev) => ({
      ...prev,
      criticalProcessing: {
        ...prev?.criticalProcessing,
        playlistFetching: isProcessing,
      },
    }))
  }, [])

  // --- Context Value ---
  const contextValue = useMemo(
    () => ({
      // Settings
      globalSettings,
      isSettingsLoading,
      settingsError,
      refreshGlobalSettings,
      updateGlobalSettings,

      // Binaries & Updates
      binaries,
      updateYtdlpTo,
      checkForUpdates,

      // Notifications
      notifications,
      dismissNotification,
      markAllNotificationsAsRead,
      executeNotificationAction,

      // App State
      appState,
      setPlaylistProcessing,
    }),
    [
      globalSettings,
      isSettingsLoading,
      settingsError,
      refreshGlobalSettings,
      updateGlobalSettings,
      binaries,
      updateYtdlpTo,
      checkForUpdates,
      notifications,
      dismissNotification,
      markAllNotificationsAsRead,
      executeNotificationAction,
      appState,
      setPlaylistProcessing,
    ],
  )



  if (settingsError && !globalSettings) {
    // Optional: Return an error boundary or specific error UI
    return <div>Error loading settings: {settingsError}</div>
  }

  return <GlobalContext.Provider value={contextValue}>{children}</GlobalContext.Provider>
}
