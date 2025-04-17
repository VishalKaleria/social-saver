

import type React from "react"

import { AudioVideoDownloadOptions } from "@/components/audio-video-detail"
import { PageHeader } from "@/components/common/page-header"
import { useRef, useState, useEffect, type ReactElement, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, Download } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { DownloadStatus } from "@/context/download-context"
import { toast } from "sonner"
import type { YtDlpMediaMetadata } from "@/types"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ActiveDownloads } from "@/components/active-downloads"
import { isValidUrl } from "./lib/download-service"
import PlaylistDownloader from "./components/playlist-downloader"
import { appConfig } from "@/lib/app-config"
import { useGlobalContext } from "@/context/global-context"

// Define Session Storage Keys
const SESSION_KEYS = {
  LINK: "socialsaver_link",
  STATUS: "socialsaver_status",
  ERROR: "socialsaver_error",
  MEDIA_DATA: "socialsaver_media_data",
  ACTIVE_TAB: "socialsaver_active_tab",
}

// Define app variable
const app = appConfig

export default function App(): ReactElement {
  // Initialize states with session storage values if available
  const [link, setLink] = useState<string>("")
  const [status, setStatus] = useState<DownloadStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [mediaData, setMediaData] = useState<YtDlpMediaMetadata | null>(null)
  const [activeTab, setActiveTab] = useState<string>("mediaInfo")

  const electronAPIRef = useRef(typeof window !== "undefined" ? window.electronAPI : null)
  const { appState } = useGlobalContext()

  // Check if critical processing is happening
  const isCriticalProcessing = useMemo(() => {
    return !!appState?.criticalProcessing?.playlistFetching
  }, [appState?.criticalProcessing?.playlistFetching])

  // Load saved state from session storage on initial render
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Retrieve stored values
      const storedLink = sessionStorage.getItem(SESSION_KEYS.LINK) || ""
      const storedStatus = (sessionStorage.getItem(SESSION_KEYS.STATUS) as DownloadStatus) || "idle"
      const storedError = sessionStorage.getItem(SESSION_KEYS.ERROR) || null
      const storedTab = sessionStorage.getItem(SESSION_KEYS.ACTIVE_TAB) || "mediaInfo"

      // Try to parse stored media data if it exists
      try {
        const storedMediaDataString = sessionStorage.getItem(SESSION_KEYS.MEDIA_DATA)
        const storedMediaData = storedMediaDataString ? JSON.parse(storedMediaDataString) : null

        // Update state with stored values
        setLink(storedLink)
        setStatus(storedStatus)
        setError(storedError)
        setMediaData(storedMediaData)
        setActiveTab(storedTab)
      } catch (error) {
        console.error("Failed to parse stored media data:", error)
        // Clear potentially corrupted data
        sessionStorage.removeItem(SESSION_KEYS.MEDIA_DATA)
      }
    }
  }, [])

  // Save states to session storage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(SESSION_KEYS.LINK, link)
      sessionStorage.setItem(SESSION_KEYS.STATUS, status === "loading" ? "idle" : status)
      sessionStorage.setItem(SESSION_KEYS.ACTIVE_TAB, activeTab)

      if (error) {
        sessionStorage.setItem(SESSION_KEYS.ERROR, error)
      } else {
        sessionStorage.removeItem(SESSION_KEYS.ERROR)
      }

      if (mediaData) {
        try {
          sessionStorage.setItem(SESSION_KEYS.MEDIA_DATA, JSON.stringify(mediaData))
        } catch (error) {
          console.error("Failed to stringify media data:", error)
        }
      } else {
        sessionStorage.removeItem(SESSION_KEYS.MEDIA_DATA)
      }
    }
  }, [link, status, error, mediaData, activeTab])

  // Reset component state when unmounted
  useEffect(() => {
    return () => {
      if (isCriticalProcessing) {
        // Update global context to reset critical processing state
        // implemented in global context
        // resetCriticalProcessingState()
      }
    }
  }, [isCriticalProcessing])

  const fetchMediaInfo = async (url: string): Promise<YtDlpMediaMetadata> => {
    setStatus("loading")
    setError(null)

    try {
      const api = electronAPIRef.current
      if (!api?.getJSON) {
        throw new Error("Electron API not available")
      }

      const response = await api.getJSON(url, {
        flatPlaylist: true,
      })

      if (response && response.success && response.data) {
        const mediadata = response.data as YtDlpMediaMetadata
        setStatus("success")
        return mediadata
      } else {
        setStatus("error")
        const errorMsg = response?.message || "Failed to fetch video information"
        setError(errorMsg)
        throw new Error(errorMsg)
      }
    } catch (error) {
      setStatus("error")
      const errorMsg = error instanceof Error ? error.message : "An unknown error occurred"
      setError(errorMsg)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedLink = link.trim()
    if (!trimmedLink || !isValidUrl(trimmedLink)) {
      toast.error("Invalid URL", {
        description: "Please enter a valid video or media page URL.",
      })
      return
    }

    setMediaData(null)

    try {
      const fetchedData = await fetchMediaInfo(trimmedLink)
      setMediaData(fetchedData)

      // Auto-switch to media info tab when new data is loaded
      setActiveTab("mediaInfo")
    } catch (error) {
      console.error("Fetch failed in App component:", error)
      setMediaData(null)
    }
  }

  // Check if we have a playlist
  const isPlaylist = mediaData && mediaData.__dataType === "playlist"

  // Render content based on the status and data type
  const renderMediaContent = () => {
    switch (status) {
      case "loading":
        return (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading media information...
          </div>
        )
      case "error":
        return (
          <div className="flex items-center justify-center py-10 text-destructive">
            <AlertCircle className="mr-2 h-5 w-5" />
            Failed to load media info. See error above or try again.
          </div>
        )
      case "success":
        if (mediaData?.__dataType === "playlist") {
          return <PlaylistDownloader playlistData={mediaData} />
        } else if (mediaData?.__dataType === "audio" || mediaData?.__dataType === "video") {
          return <AudioVideoDownloadOptions status={status} data={mediaData} />
        } else {
          return <p>No content found for this URL</p>
        }
      case "idle":
      default:
        return (
          <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
            <Download className="h-16 w-16 text-primary opacity-80" />
            <p className="text-muted-foreground">Enter a URL above to download media</p>
          </div>
        )
    }
  }

  // When it's a playlist, render just the playlist component
  if (isPlaylist) {
    return (
      <div className="container mx-auto space-y-6">
        <PageHeader title={app.name} description={app.description} />
        <Card className="card-gradient">
          <div className="card-gradient-inner">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-end gap-3 sm:gap-4">
                  <div className="w-full">
                    <Label htmlFor="link" className="mb-1.5 block text-sm font-medium">
                      Enter video or media link
                    </Label>
                    <Input
                      onChange={(e) => setLink(e.target.value)}
                      value={link}
                      type="url"
                      name="link"
                      id="link"
                      placeholder="https://www.example.com/video/..."
                      className="w-full"
                      aria-label="Media Link Input"
                      disabled={isCriticalProcessing || status === "loading"}
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto flex-shrink-0 btn-gradient"
                    disabled={status === "loading" || !link || !isValidUrl(link.trim()) || isCriticalProcessing}
                  >
                    {status === "loading" ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      "Search"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </div>
        </Card>

        {status === "error" && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error Fetching Media</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isCriticalProcessing && (
          <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-amber-700 dark:text-amber-300">Processing in Progress</AlertTitle>
            <AlertDescription className="text-amber-600 dark:text-amber-400">
              Playlist processing is in progress. Please wait until it completes before starting a new search.
            </AlertDescription>
          </Alert>
        )}

        {/* For playlists, show only the PlaylistDownloader component */}
        <PlaylistDownloader playlistData={mediaData} />
      </div>
    )
  }

  // Regular layout for non-playlist media
  return (
    <div className="container mx-auto space-y-6">
      <PageHeader title={appConfig.name} description={appConfig.description} />
      <Card className="card-gradient">
        <div className="card-gradient-inner">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col sm:flex-row items-end gap-3 sm:gap-4">
                <div className="w-full">
                  <Label htmlFor="link" className="mb-1.5 block text-sm font-medium">
                    Enter video or media link
                  </Label>
                  <Input
                    onChange={(e) => setLink(e.target.value)}
                    value={link}
                    type="url"
                    name="link"
                    id="link"
                    placeholder="https://www.example.com/video/..."
                    className="w-full"
                    aria-label="Media Link Input"
                    disabled={isCriticalProcessing || status === "loading"}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full sm:w-auto flex-shrink-0 btn-gradient"
                  disabled={status === "loading" || !link || !isValidUrl(link.trim()) || isCriticalProcessing}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </div>
      </Card>

      {status === "error" && error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Fetching Media</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isCriticalProcessing && (
        <Alert variant="default" className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-700 dark:text-amber-300">Processing in Progress</AlertTitle>
          <AlertDescription className="text-amber-600 dark:text-amber-400">
            Playlist processing is in progress. Please wait until it completes before starting a new search.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 my-4">
          <TabsTrigger value="mediaInfo">Media Info</TabsTrigger>
          <TabsTrigger value="activeDownloads">Downloads</TabsTrigger>
        </TabsList>
        <TabsContent value="mediaInfo" className="mt-4 rounded-md border bg-card text-card-foreground shadow-sm">
          <div className="p-4 md:p-6">{renderMediaContent()}</div>
        </TabsContent>
        <TabsContent value="activeDownloads" className="mt-4 rounded-md border bg-card text-card-foreground shadow-sm">
          <div>
            <ActiveDownloads />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
