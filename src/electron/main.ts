import { app, BrowserWindow, dialog, ipcMain, shell } from "electron"
import { fileURLToPath } from "node:url"
import path from "node:path"

import type { FFmpegDownloadOptions } from "@/types"
import { YtDlpService } from "./core/ytdlp-service"
import { FFmpegService } from "./core/ffmpeg-service"
import settingsService from "./core/settings-service"
import { setupAutoUpdater } from "./core/auto-updater"

const __filename = fileURLToPath(import.meta.url) // get the resolved path to the file
const __dirname = path.dirname(__filename) // get the name of the directory

// Create a new instance of FFmpegService
const ffmpegService = new FFmpegService()

process.env.APP_ROOT = path.join(__dirname, "..")
// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"]
export const MAIN_DIST = path.join(process.env.APP_ROOT, "electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "frontend")
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST

// Disable Cors
app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors")

// Create YtDlp service instance
const ytdlp = new YtDlpService()

let win: BrowserWindow | null = null

function createWindow() {
  // Determine the icon path based on platform
  let iconPath
  if (process.platform === "darwin") {
    iconPath = path.join(process.env.APP_ROOT, "frontend/icons/mac/icon.icns")
  } else if (process.platform === "win32") {
    iconPath = path.join(process.env.APP_ROOT, "frontend/icons/win/icon.ico")
  } else {
    iconPath = path.join(process.env.APP_ROOT, "frontend/icons/png/512x512.png")
  }

  // Create the browser window.
  win = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false, //disable cors
    },
  })

  // Maximize the window when created
  win.maximize()
  win.on("ready-to-show", () => {
    win?.show()
  })
  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"))
  }
  win.on("closed", () => {
    win = null
  })

  // Setup auto-updater after window is created
  setupAutoUpdater(win)
}

// Setup settings handlers
export function setupSettingsHandlers() {
  // Get settings
  ipcMain.handle("settings:getSettings", async () => {
    try {
      const settings = settingsService.getSettings()
      return {
        success: true,
        data: settings,
      }
    } catch (error) {
      console.error("Error getting settings:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error getting settings",
      }
    }
  })

  // Update settings
  ipcMain.handle("settings:updateSettings", async (_, newSettings) => {
    try {
      const updatedSettings = settingsService.updateSettings(newSettings)

      // Update FFmpeg service with new settings
      ffmpegService.updateSettings()

      return {
        success: true,
        data: updatedSettings,
      }
    } catch (error) {
      console.error("Error updating settings:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error updating settings",
      }
    }
  })

  // Reset settings to defaults
  ipcMain.handle("settings:resetToDefaults", async () => {
    try {
      const defaultSettings = settingsService.resetToDefaults()

      // Update FFmpeg service with default settings
      ffmpegService.updateSettings()

      return {
        success: true,
        data: defaultSettings,
      }
    } catch (error) {
      console.error("Error resetting settings:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error resetting settings",
      }
    }
  })
}

// Setup dialog handlers
function setupDialogHandlers() {
  // Add directory selection dialog
  ipcMain.handle("dialog:selectDirectory", async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ["openDirectory"],
      })

      if (result.canceled) {
        return { success: false, message: "Selection canceled" }
      }

      return {
        success: true,
        data: { path: result.filePaths[0] },
      }
    } catch (error) {
      console.error("Error selecting directory:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error selecting directory",
      }
    }
  })

  ipcMain.handle("dialog:selectFile", async (event, dialogOptions = {}) => {
    try {
      const defaultOptions = {
        properties: ["openFile"],
        title: "Select File",
        filters: [],
      }
      const options = { ...defaultOptions, ...dialogOptions }
      options.properties = ["openFile"]
      const result = await dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, message: "File selection canceled or no file chosen" }
      }
      return {
        success: true,
        data: { path: result.filePaths[0] },
      }
    } catch (error) {
      console.error("Error selecting file:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error selecting file",
      }
    }
  })
}

// Setup shell handlers
function setupShellHandlers() {
  ipcMain.handle("shell:openFile", async (_, filePath) => {
    try {
      await shell.openPath(filePath)
      return { success: true }
    } catch (error) {
      console.error("Error opening file:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error opening file",
      }
    }
  })

  ipcMain.handle("shell:openExternal", async (_, href) => {
    try {
      await shell.openExternal(href)
      return { success: true }
    } catch (error) {
      console.error("Error opening external link:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error opening external link",
      }
    }
  })

  ipcMain.handle("shell:openFolder", async (_, filePath) => {
    try {
      // Get the directory path if a file is provided
      const dirPath = path.dirname(filePath)
      await shell.openPath(dirPath)
      return { success: true }
    } catch (error) {
      console.error("Error opening folder:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error opening folder",
      }
    }
  })

  ipcMain.handle("shell:showItemInFolder", async (_, filePath) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      console.error("Error showing item in folder:", error)
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error showing item in folder",
      }
    }
  })
}

// Setup YtDlp handlers
function setupYtDlpHandlers() {
  ipcMain.handle("ytdlp:getJSON", async (_, url: string, options = {}) => {
    try {
      console.log(`Getting info for: ${url}`)
      return await ytdlp.getJson(url, options)
    } catch (error: any) {
      console.error("Error getting video info:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ytdlp:executeCommand", async (_, args: string[]) => {
    try {
      console.log(`Executing command with args:`, args)
      return await ytdlp.executeCommand(args)
    } catch (error: any) {
      console.error("Error executing command:", error)
      return {
        success: false,
        code: 1,
        data: { stdout: "", stderr: error.message || "Unknown error" },
        message: error.message || "Unknown error",
      }
    }
  })
}

// Setup FFmpeg handlers
function setupFFmpegHandlers() {
  ipcMain.handle("ffmpeg:download", async (_, options: FFmpegDownloadOptions) => {
    try {
      console.log("Starting FFmpeg download with options:", { url: options.url, quality: options.quality })

      // Start the download process
      const result = await ffmpegService.download(options)

      return {
        success: true,
        code: 0,
        data: result,
        message: "Download started successfully",
      }
    } catch (error: any) {
      console.error("Error during FFmpeg download:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:getActiveJobs", () => {
    try {
      const activeJobs = ffmpegService.getActiveJobs()
      return {
        success: true,
        code: 0,
        data: { activeJobs },
        message: "Active jobs retrieved",
      }
    } catch (error: any) {
      console.error("Error getting active jobs:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:cancelJob", (_, jobId: string) => {
    try {
      const success = ffmpegService.cancelJob(jobId)
      return {
        success: true,
        code: 0,
        data: { canceled: success },
        message: success ? "Job canceled successfully" : "Job not found or not running",
      }
    } catch (error: any) {
      console.error("Error canceling job:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:getJobInfo", (_, jobId: string) => {
    try {
      const jobInfo = ffmpegService.getJobInfo(jobId)
      return {
        success: true,
        code: 0,
        data: { jobInfo },
        message: jobInfo ? "Job info retrieved" : "Job not found",
      }
    } catch (error: any) {
      console.error("Error getting job info:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:listJobs", () => {
    try {
      const jobs = ffmpegService.getAllJobs()
      return {
        success: true,
        code: 0,
        data: { jobs },
        message: "Jobs list retrieved",
      }
    } catch (error: any) {
      console.error("Error listing jobs:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:retryJob", async (_, jobId: string) => {
    try {
      const result = await ffmpegService.retryJob(jobId)
      return {
        success: !!result,
        code: result ? 0 : 1,
        data: result,
        message: result ? "Job restarted successfully" : "Failed to retry job",
      }
    } catch (error: any) {
      console.error("Error retrying job:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  // Add new queue management IPC handlers
  ipcMain.handle("ffmpeg:getQueuedJobs", () => {
    try {
      const queuedJobs = ffmpegService.getQueuedJobs()
      return {
        success: true,
        code: 0,
        data: { queuedJobs },
        message: "Queued jobs retrieved",
      }
    } catch (error: any) {
      console.error("Error getting queued jobs:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:getCompletedJobs", () => {
    try {
      const completedJobs = ffmpegService.getCompletedJobs()
      return {
        success: true,
        code: 0,
        data: { completedJobs },
        message: "Completed jobs retrieved",
      }
    } catch (error: any) {
      console.error("Error getting completed jobs:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:clearQueue", () => {
    try {
      const clearedCount = ffmpegService.clearQueue()
      return {
        success: true,
        code: 0,
        data: { clearedCount },
        message: `Successfully cleared ${clearedCount} jobs from queue`,
      }
    } catch (error: any) {
      console.error("Error clearing queue:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })

  ipcMain.handle("ffmpeg:cleanupCompletedJobs", (_, maxAgeMs = 3600000) => {
    try {
      ffmpegService.cleanupCompletedJobs(maxAgeMs)
      return {
        success: true,
        code: 0,
        data: null,
        message: "Completed jobs cleanup successful",
      }
    } catch (error: any) {
      console.error("Error cleaning up completed jobs:", error)
      return {
        success: false,
        code: 1,
        data: null,
        message: error.message || "Unknown error",
      }
    }
  })
}

// Setup FFmpeg service event forwarding to renderer
function setupFFmpegEventForwarding() {
  // Forward progress events to renderer
  ffmpegService.on("progress", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:progress", data)
    }
  })

  // Forward start events
  ffmpegService.on("start", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:start", data)
    }
  })

  // Forward job:start events
  ffmpegService.on("job:start", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:job:start", data)
    }
  })

  // Forward end events
  ffmpegService.on("end", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:end", data)
    }
  })

  // Forward error events
  ffmpegService.on("error", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:error", data)
    }
  })

  // Forward job:cancelled events
  ffmpegService.on("job:cancelled", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:job:cancelled", data)
    }
  })

  // Forward queue:update events
  ffmpegService.on("queue:update", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:queue:update", data)
    }
  })

  // Forward queue:cleared events
  ffmpegService.on("queue:cleared", (data) => {
    if (win) {
      win.webContents.send("ffmpeg:queue:cleared", data)
    }
  })
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
    win = null
  }
})

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.whenReady().then(() => {
  // Setup all handlers
  setupSettingsHandlers()
  setupDialogHandlers()
  setupShellHandlers()
  setupYtDlpHandlers()
  setupFFmpegHandlers()

  // Setup FFmpeg event forwarding
  setupFFmpegEventForwarding()

  // IPC test
  ipcMain.on("ping", () => console.log("pong"))

  createWindow()
})

// Handle any crashes or errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error)
})
