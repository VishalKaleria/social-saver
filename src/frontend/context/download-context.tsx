
import { selectFormat } from "@/lib/download-service"
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react"
import type { DeepPartial, YtDlpAudioVideoMetadata, YtDlpMediaMetadata } from "@/types"
import type {
  FFmpegDownloadOptions,
  ProgressResponse,
  CompletionResponse,
  ErrorResponse,
  JobInfo,
  DownloadConfig,
  JobSubmissionResult,
  PlaylistDownloadResult,
} from "@/types/FfmpegCore"
import type { GlobalSettings } from "@/types/Settings"
import { toast } from "sonner"

export type DownloadStatus = "idle" | "loading" | "success" | "error"

interface DownloadContextType {
  activeDownloads: Record<string, JobInfo>
  downloadHistory: JobInfo[]
  startDownload: (config: DownloadConfig) => Promise<any>
  cancelDownload: (jobId: string) => Promise<any>
  retryDownload: (jobId: string) => Promise<any>
  clearHistory: () => void
  clearHistoryItem: (id: string) => void
  getJobInfo: (jobId: string) => Promise<any>
  refreshJobs: () => Promise<void>
  clearQueue: () => Promise<any>
  cleanupCompletedJobs: (maxAgeMs?: number) => Promise<any>
  getQueuedJobs: () => Promise<any>
  getCompletedJobs: () => Promise<any>
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined)



export function DownloadProvider({ children }: { children: ReactNode }) {
  // Store only minimal state in React
  const [activeDownloads, setActiveDownloads] = useState<Record<string, JobInfo>>({})
  const [downloadHistory, setDownloadHistory] = useState<JobInfo[]>([])

  // Use a ref for the electron API to avoid unnecessary re-renders
  const electronAPIRef = useRef(typeof window !== "undefined" ? window.electronAPI : null)



  // Simplified job refresh function - directly fetches from backend
  const refreshJobs = async () => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.listJobs) {
        console.warn("FFmpeg API not available")
        return
      }

      // Get all jobs from backend in a single call
      const response = await api.ffmpeg.listJobs()
      if (response.success && response.data?.jobs) {
        // Update active downloads state with the data from backend
        const jobsMap: Record<string, JobInfo> = {}
        response.data.jobs.forEach((job: JobInfo) => {
          if (
            job.jobId &&
            (job.status === "downloading" ||
              job.status === "queued" ||
              job.status === "processing" ||
              job.status === "error")
          ) {
            jobsMap[job.jobId] = job
          }
        })
        setActiveDownloads(jobsMap)
      }

      // Get completed job history
      const historyResponse = await api.ffmpeg.getCompletedJobs()
      if (historyResponse.success && historyResponse.data?.completedJobs) {
        setDownloadHistory(historyResponse.data.completedJobs)
      }
    } catch (error) {
      console.error("Failed to refresh jobs:", error)
    }
  }

  // Update local storage with completed jobs
  const updateLocalStorageHistory = (newJobs: JobInfo[]) => {
    if (typeof window === "undefined") return

    try {
      // Get existing history from local storage
      const storedHistory = localStorage.getItem("downloadHistory")
      const parsedHistory: JobInfo[] = storedHistory ? JSON.parse(storedHistory) : []

      // Merge histories, removing duplicates by jobId
      const jobMap = new Map<string, JobInfo>()

      // Add old history to map
      parsedHistory.forEach((job) => {
        if (job.jobId) {
          jobMap.set(job.jobId, job)
        }
      })

      // Add or update with new jobs
      newJobs.forEach((job) => {
        if (job.jobId) {
          jobMap.set(job.jobId, job)
        }
      })

      // Convert map back to array and sort by endTime (newest first)
      const mergedHistory = Array.from(jobMap.values())
        .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))

      // Save back to local storage
      localStorage.setItem("downloadHistory", JSON.stringify(mergedHistory))
    } catch (error) {
      console.error("Failed to update local storage history:", error)
    }
  }

  useEffect(() => {
    refreshJobs()
  }, [])

  // Set up event listeners for FFmpeg events
  useEffect(() => {
    const api = electronAPIRef.current
    if (!api?.ffmpeg?.events) {
      console.warn("FFmpeg events API not available")
      return
    }

    // Event handlers that update local state when backend events occur
    const handlers = {
      progress: (event: ProgressResponse) => {
        // Only update the specific job that has progress
        setActiveDownloads((prev) => ({
          ...prev,
          [event.jobId]: {
            ...prev[event.jobId],
            ...event,
            status: "downloading",
          },
        }))
      },

      jobStart: (event: any) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [event.jobId]: {
            ...prev[event.jobId],
            status: "started",
          },
        }))

        toast.success("Download Started", {
          description: `${event.title || "Download"} has started.`,
          duration: 5000,
          closeButton: true,
          richColors: true,
        })
      },

      end: async (event: CompletionResponse) => {
        // When download completes, remove from active downloads and refresh history
        setActiveDownloads((prev) => {
          const newState = { ...prev }
          delete newState[event.jobId]
          return newState
        })

        // Get the completed job data
        try {
          const jobInfo = await electronAPIRef.current?.ffmpeg?.getJobInfo(event.jobId)
          if (jobInfo?.success && jobInfo?.data) {
            // Update local storage with the completed job
            updateLocalStorageHistory([jobInfo.data.jobInfo])
          }
        } catch (error) {
          console.error("Failed to get completed job info:", error)
        }

        // Refresh history to include the completed job
        await refreshJobs()

        toast.success("Download Complete", {
          description: `Your download has completed successfully.`,
          duration: 5000,
          closeButton: true,
          richColors: true,
        })
      },

      error: (event: ErrorResponse) => {
        setActiveDownloads((prev) => ({
          ...prev,
          [event.jobId]: {
            ...prev[event.jobId],
            status: "error",
            error: event.error,
          },
        }))
        toast.error("Download Error", {
          description: event.error || "An error occurred during download",
          duration: 5000,
          closeButton: true,
          richColors: true,
        })
      },

      jobCancelled: (event: any) => {
        setActiveDownloads((prev) => {
          const newState = { ...prev }
          delete newState[event.jobId]
          return newState
        })

        toast.warning("Download Cancelled", {
          description: "The download has been cancelled",
          duration: 5000,
          closeButton: true,
          richColors: true,
        })
      },

      queueUpdate: () => {
        // Refresh all jobs when queue is updated
        refreshJobs()
      },

      queueCleared: (event: any) => {
        // Remove all queued jobs from the active downloads
        setActiveDownloads((prev) => {
          const newState = { ...prev }
          Object.keys(newState).forEach((jobId) => {
            if (newState[jobId].status === "queued") {
              delete newState[jobId]
            }
          })
          return newState
        })

        toast.warning("Queue Cleared", {
          description: `${event?.clearedCount || "All"} queued downloads have been removed.`,
          duration: 5000,
          closeButton: true,
          richColors: true,
        })
      },
    }

    // Subscribe to all events
    const unsubscribeFunctions: Array<() => void> = []

    try {
      // Register event handlers
      if (api.ffmpeg.events.progress) {
        unsubscribeFunctions.push(api.ffmpeg.events.progress.subscribe(handlers.progress))
      }

      if (api.ffmpeg.events.jobStart) {
        unsubscribeFunctions.push(api.ffmpeg.events.jobStart.subscribe(handlers.jobStart))
      }

      if (api.ffmpeg.events.end) {
        unsubscribeFunctions.push(api.ffmpeg.events.end.subscribe(handlers.end))
      }

      if (api.ffmpeg.events.error) {
        unsubscribeFunctions.push(api.ffmpeg.events.error.subscribe(handlers.error))
      }

      if (api.ffmpeg.events.jobCancelled) {
        unsubscribeFunctions.push(api.ffmpeg.events.jobCancelled.subscribe(handlers.jobCancelled))
      }

      if (api.ffmpeg.events.queueUpdate) {
        unsubscribeFunctions.push(api.ffmpeg.events.queueUpdate.subscribe(handlers.queueUpdate))
      }

      if (api.ffmpeg.events.queueCleared) {
        unsubscribeFunctions.push(api.ffmpeg.events.queueCleared.subscribe(handlers.queueCleared))
      }

      console.log("Successfully subscribed to all FFmpeg events")
    } catch (error) {
      console.error("Error subscribing to FFmpeg events:", error)
    }

    // Return cleanup function that unsubscribes all event handlers
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => {
        try {
          unsubscribe()
        } catch (error) {
          console.error("Error unsubscribing from event:", error)
        }
      })
    }
  }, [])

  
  function isAudioVideoMetadata(data: YtDlpMediaMetadata): data is YtDlpAudioVideoMetadata {
      return data.__dataType === "video" || data.__dataType === "audio"
    }

    
    // Full updated startDownload function
const startDownload = async (config: DownloadConfig): Promise<JobSubmissionResult | PlaylistDownloadResult> => {
  console.log(config)
  const api = electronAPIRef.current
  if (!api?.ffmpeg?.download) {
    throw new Error("Electron API (ffmpeg.download) not available")
  }

  // Handle direct image URL downloads
  if (config.type === "image" && config.method === "byURL" && config.url) {
    let jobResult: JobSubmissionResult = {
      success: false,
      title: config.title || "Image Download",
    }

    try {
      const downloadOptions: FFmpegDownloadOptions = {
        type: "image",
        url: config.url,
        platformUrl: config.url,
        title: config.title || "Image Download",
        size: 0, // Size usually unknown beforehand for direct image downloads
        outputPath: config.outputPath,
        scale: config.scale, // Add support for scaling if needed
        customOptions: config.customOptions, // Pass any custom ffmpeg options
      }

      console.log(`Submitting image download for: ${downloadOptions.title}`)
      const response = await api.ffmpeg.download(downloadOptions)

      if (response && response.success && response.data?.jobId) {
        toast.success("Image Download Added", {
          description: `${downloadOptions.title} has been added to the download queue.`,
          duration: 5000,
          closeButton: true,
          richColors: true,
        })

        refreshJobs()

        return {
          success: true,
          jobId: response.data.jobId,
          title: downloadOptions.title,
        }
      } else {
        const errMsg = response?.message || "Failed to start image download via backend"
        throw new Error(errMsg)
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`Error starting image download:`, errorMsg)
      toast.error(`Image Download Error`, {
        description: errorMsg,
        duration: 7000,
        richColors: true,
      })
      return { ...jobResult, success: false, error: errorMsg }
    }
  }
  
  // Handle media downloads using YtDlpAudioVideoMetadata
  if (config.data && isAudioVideoMetadata(config.data)) {
    const itemMetadata = config.data
    let jobResult: JobSubmissionResult = {
      success: false,
      title: itemMetadata.title || itemMetadata.id,
    }

    try {
      // Handle thumbnail extraction
      if (config.type === "image" && itemMetadata.thumbnail) {
        // Extract thumbnail as an image
        const downloadOptions: FFmpegDownloadOptions = {
          type: "image",
          // url: itemMetadata.thumbnail,
          platformUrl: itemMetadata.webpage_url || itemMetadata.original_url!,
          title: `${itemMetadata.title} - Thumbnail`,
          size: 0, // Size usually unknown for thumbnails
          metadata: itemMetadata,
          outputPath: config.outputPath ?? undefined,
        }

        console.log(`Submitting thumbnail download for: ${downloadOptions.title}`)
        const response = await api.ffmpeg.download(downloadOptions)

        if (response && response.success && response.data?.jobId) {
          toast.success("Thumbnail Download Added", {
            description: `Thumbnail for ${itemMetadata.title} has been added to the download queue.`,
            duration: 5000,
            closeButton: true,
            richColors: true,
          })

          refreshJobs()

          return {
            success: true,
            jobId: response.data.jobId,
            title: downloadOptions.title,
          }
        } else {
          const errMsg = response?.message || "Failed to start thumbnail download via backend"
          throw new Error(errMsg)
        }
      }

      // Handle regular media downloads
      console.log(`Selecting format for: ${itemMetadata.title}`)
      const {
        ffmpegOptions,
        error: formatError,
        skip,
      } = selectFormat(
        itemMetadata,
        config.type,
        config.method === "byFilter" ? config.filter : undefined,
        config.method === "byId"
          ? {
              formatId: config.formatId,
              videoFormatId: config.videoFormatId,
              audioFormatId: config.audioFormatId,
            }
          : undefined,
      )

      if (skip || formatError || !ffmpegOptions) {
        const reason = formatError || "Format selection failed"
        console.warn(`Cannot download ${itemMetadata.title}: ${reason}`)
        toast.error(`Cannot start download for "${itemMetadata.title}"`, {
          description: reason,
          duration: 7000,
          richColors: true,
        })
        return { ...jobResult, success: false, skipped: true, error: reason }
      }

      // Construct final FFmpegDownloadOptions with settings
      const downloadOptions: FFmpegDownloadOptions = {
        type: ffmpegOptions.type!,
        url: ffmpegOptions.url!,
        platformUrl: itemMetadata.webpage_url || itemMetadata.original_url!,
        title: itemMetadata.title,
        size: ffmpegOptions.size || 0,
        metadata: itemMetadata,
        formatId: ffmpegOptions.formatId,
        // Use settings for output path if available
        outputPath: config.outputPath ?? undefined,
      }

      // Call backend download API
      console.log(`Submitting download for: ${downloadOptions.title}`)
      const response = await api.ffmpeg.download(downloadOptions)

      if (response && response.success && response.data?.jobId) {
        // The job was added to the queue successfully
        toast.success("Download Added", {
          description: `${downloadOptions.title} has been added to the download queue.`,
          duration: 5000,
          closeButton: true,
          richColors: true,
        })

        // Trigger a refresh to update the UI with the new job
        refreshJobs()

        return {
          success: true,
          jobId: response.data.jobId,
          title: downloadOptions.title,
        }
      } else {
        const errMsg = response?.message || "Failed to start download via backend"
        throw new Error(errMsg)
      }
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`Error starting download for "${itemMetadata.title || itemMetadata.id}":`, errorMsg)
      toast.error(`Download Error for "${itemMetadata.title}"`, {
        description: errorMsg,
        duration: 7000,
        richColors: true,
      })
      return { ...jobResult, success: false, error: errorMsg }
    }
  } else {
    console.error("Invalid data type provided to startDownload:", config)
    toast.error("Download Error", {
      description: "Invalid data provided for download.",
      richColors: true,
    })
    return { success: false, error: "Invalid data type provided" }
  }
}

  // Simplified API methods that rely on backend state
  const cancelDownload = async (jobId: string) => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.cancelJob) {
        throw new Error("Electron API not available")
      }

      const response = await api.ffmpeg.cancelJob(jobId)
      if (!response || !response.success) {
        throw new Error(response?.message || "Failed to cancel download")
      }

      // Backend events will update the UI
      return response
    } catch (error) {
      console.error("Failed to cancel download:", error)
      toast.error("Error", {
        description: "Failed to cancel download",
        duration: 5000,
        richColors: true,
      })
      throw error
    }
  }

  const retryDownload = async (jobId: string) => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.retryJob) {
        throw new Error("Retry feature not available")
      }

      const response = await api.ffmpeg.retryJob(jobId)
      if (!response || !response.success) {
        throw new Error(response?.message || "Failed to retry download")
      }

      // Backend events will update the UI
      return response
    } catch (error) {
      console.error("Failed to retry download:", error)
      toast.error("Error", {
        description: "Failed to retry download",
        duration: 5000,
        richColors: true,
      })
      throw error
    }
  }

  // Local history management
  const clearHistory = () => {
    setDownloadHistory([])
    if (typeof window !== "undefined") {
      localStorage.removeItem("downloadHistory")
    }
  }

  const clearHistoryItem = (id: string) => {
    setDownloadHistory((prev) => prev.filter((item) => item.jobId !== id))

    // Also remove from local storage
    if (typeof window !== "undefined") {
      const storedHistory = localStorage.getItem("downloadHistory")
      if (storedHistory) {
        const parsedHistory: JobInfo[] = JSON.parse(storedHistory)
        const updatedHistory = parsedHistory.filter((item) => item.jobId !== id)
        localStorage.setItem("downloadHistory", JSON.stringify(updatedHistory))
      }
    }
  }

  // // Settings
  // const updateSettings = async (newSettings: Partial<GlobalSettings>) => {
  //   try {
  //     const api = electronAPIRef.current
  //     if (!api?.settings?.updateSettings) {
  //       throw new Error("Settings API not available")
  //     }

  //     const response = await api.settings.updateSettings(newSettings)
  //     if (!response.success) {
  //       throw new Error(response.message || "Failed to update settings")
  //     }

  //     await loadSettings()
  //   } catch (error) {
  //     console.error("Failed to update settings:", error)
  //     toast.error("Error", {
  //       description: "Failed to save settings",
  //       duration: 5000,
  //       richColors: true,
  //     })
  //   }
  // }

  // Job management methods
  const getJobInfo = async (jobId: string) => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.getJobInfo) {
        throw new Error("getJobInfo method not available")
      }

      const response = await api.ffmpeg.getJobInfo(jobId)
      if (response && response.success) {
        return response.data
      } else {
        throw new Error(response?.message || "Failed to get job information")
      }
    } catch (error) {
      console.error("Failed to get job info:", error)
      throw error
    }
  }

  const clearQueue = async () => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.clearQueue) {
        throw new Error("clearQueue method not available")
      }

      const response = await api.ffmpeg.clearQueue()
      if (response && response.success) {
        // Backend events will update the UI
        return response.data
      } else {
        throw new Error(response?.message || "Failed to clear queue")
      }
    } catch (error) {
      console.error("Failed to clear queue:", error)
      toast.error("Error", {
        description: "Failed to clear download queue",
        duration: 5000,
        richColors: true,
      })
      throw error
    }
  }

  const cleanupCompletedJobs = async (maxAgeMs = 3600000) => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.cleanupCompletedJobs) {
        throw new Error("cleanupCompletedJobs method not available")
      }

      const response = await api.ffmpeg.cleanupCompletedJobs(maxAgeMs)
      if (response && response.success) {
        // Refresh after cleanup
        await refreshJobs()
        return response.data
      } else {
        throw new Error(response?.message || "Failed to cleanup completed jobs")
      }
    } catch (error) {
      console.error("Failed to cleanup completed jobs:", error)
      return null
    }
  }

  const getQueuedJobs = async () => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.getQueuedJobs) {
        throw new Error("getQueuedJobs method not available")
      }

      const response = await api.ffmpeg.getQueuedJobs()
      if (response && response.success) {
        return response.data?.queuedJobs || []
      } else {
        throw new Error(response?.message || "Failed to get queued jobs")
      }
    } catch (error) {
      console.error("Failed to get queued jobs:", error)
      throw error
    }
  }

  const getCompletedJobs = async () => {
    try {
      const api = electronAPIRef.current
      if (!api?.ffmpeg?.getCompletedJobs) {
        throw new Error("getCompletedJobs method not available")
      }

      const response = await api.ffmpeg.getCompletedJobs()
      if (response && response.success) {
        // Update local history state
        setDownloadHistory(response.data?.completedJobs || [])
        return response.data?.completedJobs || []
      } else {
        throw new Error(response?.message || "Failed to get completed jobs")
      }
    } catch (error) {
      console.error("Failed to get completed jobs:", error)
      throw error
    }
  }

  const contextValue: DownloadContextType = {
    activeDownloads,
    downloadHistory,
    startDownload,
    cancelDownload,
    retryDownload,
    clearHistory,
    clearHistoryItem,
    getJobInfo,
    refreshJobs,
    clearQueue,
    cleanupCompletedJobs,
    getQueuedJobs,
    getCompletedJobs,
  }

  return <DownloadContext.Provider value={contextValue}>{children}</DownloadContext.Provider>
}

export function useDownload() {
  const context = useContext(DownloadContext)
  if (context === undefined) {
    throw new Error("useDownload must be used within a DownloadProvider")
  }
  return context
}

