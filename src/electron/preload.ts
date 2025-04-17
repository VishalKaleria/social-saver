import { ipcRenderer, contextBridge } from "electron"
import type { FFmpegDownloadOptions } from "@/types/FfmpegCore"

// Helper to create event listener functions
const createEventListener = (channel: string) => {
  return {
    subscribe: (callback: (data: any) => void) => {
      const listener = (_: any, data: any) => callback(data)
      ipcRenderer.on(channel, listener)
      return () => {
        ipcRenderer.removeListener(channel, listener)
      }
    },
    unsubscribe: (callback: (data: any) => void) => {
      ipcRenderer.removeListener(channel, callback)
    },
    unsubscribeAll: () => {
      ipcRenderer.removeAllListeners(channel)
    },
  }
}

// Expose API to the renderer process
contextBridge.exposeInMainWorld("electronAPI", {
  settings: {
    getSettings: () => ipcRenderer.invoke("settings:getSettings"),
    updateSettings: (settings: any) => ipcRenderer.invoke("settings:updateSettings", settings),
    resetToDefaults: () => ipcRenderer.invoke("settings:resetToDefaults"),
  },
  dialog: {
    selectDirectory: () => ipcRenderer.invoke("dialog:selectDirectory"),
    selectFile: () => ipcRenderer.invoke("dialog:selectFile"),
  },
  shell: {
    openFile: (path: string) => ipcRenderer.invoke("shell:openFile", path),
    openFolder: (path: string) => ipcRenderer.invoke("shell:openFolder", path),
    showItemInFolder: (path: string) => ipcRenderer.invoke("shell:showItemInFolder", path),
    openExternal: (path: string) => ipcRenderer.invoke("shell:openExternal", path),
  },

  // YtDlp methods
  getJSON: (url: string, options = {}) => {
    return ipcRenderer.invoke("ytdlp:getJSON", url, options)
  },
  executeCommand: (args: string[]) => {
    return ipcRenderer.invoke("ytdlp:executeCommand", args)
  },

  // FFmpeg service
  ffmpeg: {
    // Core methods
    download: (options: FFmpegDownloadOptions) => {
      return ipcRenderer.invoke("ffmpeg:download", options)
    },
    getActiveJobs: () => {
      return ipcRenderer.invoke("ffmpeg:getActiveJobs")
    },
    cancelJob: (jobId: string) => {
      return ipcRenderer.invoke("ffmpeg:cancelJob", jobId)
    },
    getJobInfo: (jobId: string) => {
      return ipcRenderer.invoke("ffmpeg:getJobInfo", jobId)
    },
    listJobs: () => {
      return ipcRenderer.invoke("ffmpeg:listJobs")
    },
    retryJob: (jobId: string) => {
      return ipcRenderer.invoke("ffmpeg:retryJob", jobId)
    },

    // New queue management methods
    getQueuedJobs: () => {
      return ipcRenderer.invoke("ffmpeg:getQueuedJobs")
    },
    getCompletedJobs: () => {
      return ipcRenderer.invoke("ffmpeg:getCompletedJobs")
    },
    clearQueue: () => {
      return ipcRenderer.invoke("ffmpeg:clearQueue")
    },
    cleanupCompletedJobs: (maxAgeMs = 3600000) => {
      return ipcRenderer.invoke("ffmpeg:cleanupCompletedJobs", maxAgeMs)
    },

    // Event system with proper cleanup methods
    events: {
      progress: createEventListener("ffmpeg:progress"),
      start: createEventListener("ffmpeg:start"),
      end: createEventListener("ffmpeg:end"),
      error: createEventListener("ffmpeg:error"),
      jobCancelled: createEventListener("ffmpeg:job:cancelled"),
      jobStart: createEventListener("ffmpeg:job:start"),

      // New queue-related events
      queueUpdate: createEventListener("ffmpeg:queue:update"),
      queueCleared: createEventListener("ffmpeg:queue:cleared"),
    },
  }
})

// Also expose the standard ipcRenderer methods as in the default vite-electron template
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },
})
