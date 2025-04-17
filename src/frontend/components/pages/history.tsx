

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ExternalLink, Trash2, FolderOpen, Play, Search, X, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { JobInfo } from "@/types/FfmpegCore"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatBytes, formatDate, formatTime } from "@/lib/utils"
import { PageHeader } from "../common/page-header"
import { ElectronLink } from "../electron-hyperlink"


const ITEMS_PER_PAGE = 50

export default function DownloadHistoryPage() {
  const [downloadHistory, setDownloadHistory] = useState<JobInfo[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Load history from local storage
  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    setIsLoading(true)
    try {
      const storedHistory = localStorage.getItem("downloadHistory")
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory)
        setDownloadHistory(parsedHistory)
      }
    } catch (error) {
      console.error("Failed to load download history:", error)
    } finally {
      setIsLoading(false)
    }
  }


  // Filtered history
  const filteredHistory = useMemo(() => {
    return downloadHistory.filter((item) => {
      if (!searchQuery.trim()) return true

      const query = searchQuery.toLowerCase()
      return (
        item.title?.toLowerCase().includes(query) ||
        item.outputPath?.toLowerCase().includes(query) ||
        (typeof item.platformUrl === "string" && item.platformUrl.toLowerCase().includes(query)) ||
        item.jobId?.toLowerCase().includes(query)
      )
    })
  }, [downloadHistory, searchQuery])

  // Paginated history
  const paginatedHistory = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredHistory, currentPage])

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE)

  // Handle file operations
  const handleOpenFile = (filePath: string) => {
    if (window.electronAPI?.shell?.openFile) {
      window.electronAPI.shell.openFile(filePath)
    } else {
      console.warn("Shell API not available")
    }
  }

  const handleOpenFolder = (filePath: string) => {
    if (window.electronAPI?.shell?.showItemInFolder) {
      window.electronAPI.shell.showItemInFolder(filePath)
    } else {
      console.warn("Shell API not available")
    }
  }

  const handleClearHistory = () => {
    localStorage.removeItem("downloadHistory")
    setDownloadHistory([])
    setShowClearDialog(false)
  }

  const handleClearHistoryItem = (jobId: string) => {
    const updatedHistory = downloadHistory.filter((item) => item.jobId !== jobId)
    localStorage.setItem("downloadHistory", JSON.stringify(updatedHistory))
    setDownloadHistory(updatedHistory)
  }


 

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download History</CardTitle>
          <CardDescription>Loading your download history...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (downloadHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download History</CardTitle>
          <CardDescription>Your download history will appear here</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No download history yet. Complete some downloads to see them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mx-auto py-6">
    
      <Card>
        <CardHeader className="flex flex-row items-center">
          <div>
            <CardTitle>Download History</CardTitle>
            {/* <CardDescription>
              {downloadHistory.length} downloads (max {MAX_HISTORY_ITEMS})
            </CardDescription> */}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={loadHistory}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowClearDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-4">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search downloads by title, path, URL or ID..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1) // Reset to first page on search
              }}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1.5 h-7 w-7 px-0"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="rounded-md border overflow-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No downloads match your search criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedHistory.map((item) => (
                    <TableRow key={item.jobId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.thumbnail && (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-8 h-8 object-cover rounded"
                              onError={(e) => {
                                ;(e.target as HTMLImageElement).style.display = "none"
                              }}
                            />
                          )}
                          <div>
                           <Tooltip>
                            <TooltipTrigger>
                            <div className="font-medium truncate max-w-xs">
                              {item.title || item.outputPath?.split(/[/\\]/).pop() || "Download"}
                            </div>
                            </TooltipTrigger>
                            <TooltipContent>
                           <p className="max-w-md">{item.title || item.outputPath?.split(/[/\\]/).pop() || "Download"}</p>
                            </TooltipContent>
                           </Tooltip>
                            {item.platformUrl && typeof item.platformUrl === "string" && (
                              <ElectronLink
                                href={item.platformUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary flex items-center"
                              >
                                <span className="truncate max-w-[180px]">{item.platformUrl}</span>
                                <ExternalLink className="h-3 w-3 ml-1 flex-shrink-0" />
                              </ElectronLink>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : "Unknown"}
                      </TableCell>
                      <TableCell>{item.fileSize ? formatBytes(item.fileSize) : "Unknown"}</TableCell>
                      <TableCell>
                        <div className="text-sm">{formatDate(item.endTime)}</div>
                        {item.timeElapsed && (
                          <div className="text-xs text-muted-foreground">
                            Duration: {formatTime(item.duration)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {item.outputPath && item.status === "completed" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenFile(item.outputPath!)}
                                title="Open file"
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenFolder(item.outputPath!)}
                                title="Open file location"
                              >
                                <FolderOpen className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleClearHistoryItem(item.jobId!)}
                            title="Remove from history"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length} downloads
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm px-2">
                  Page {currentPage} of {totalPages}
                </div>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>

        {/* Clear History Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear Download History</DialogTitle>
              <DialogDescription>
                Are you sure you want to clear your download history? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleClearHistory}>
                Clear History
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  switch (status) {
    case "queued":
      return <Badge variant="outline">Queued</Badge>
    case "downloading":
      return (
        <Badge variant="secondary" className="animate-pulse">
          Downloading
        </Badge>
      )
    case "completed":
      return (
        <Badge variant="default" className="bg-green-500">
          Completed
        </Badge>
      )
    case "error":
      return <Badge variant="destructive">Error</Badge>
    case "cancelled":
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-500">
          Cancelled
        </Badge>
      )
    default:
      return <Badge variant="outline">Unknown</Badge>
  }
}

