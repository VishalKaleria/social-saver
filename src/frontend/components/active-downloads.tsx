import React, { useState, useMemo, useEffect, useCallback } from "react"; // Added useCallback
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useDownload } from "@/context/download-context";
import {
  DownloadIcon,
  HistoryIcon,
  FilterIcon,
  XIcon,
  Clock,
  FileIcon,
  HardDriveIcon,
  Gauge,
  Layers,
  Timer,
  RefreshCw,
  ChevronDown, 
  ChevronRight,
  FileText,
  PlayCircle, 
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes, formatTime } from "@/lib/utils"; 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { JobInfo, JobStatus } from "@/types/FfmpegCore";



export function ActiveDownloads() {
  const {
    activeDownloads,
    downloadHistory,
    cancelDownload,
    refreshJobs,
    clearHistory,
  } = useDownload(); 

  const [activeTab, setActiveTab] = useState("active");
  const [isFiltering, setIsFiltering] = useState(false);
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 500); // Shorter delay
    return () => clearTimeout(timer);
  }, []);

  // --- Memoized Data Calculations ---

  // Memoize the entries array from activeDownloads
  const activeDownloadEntries = useMemo(
    () => Object.entries(activeDownloads || {}),
    [activeDownloads]
  );

  const filteredActiveDownloads = useMemo(() => {
    return activeDownloadEntries.filter(([_, job]) => {
      const isActiveStatus = ["queued", "started", "downloading"].includes(
        job.status
      );
      // Ensure job status is a valid JobStatus before comparing
      return statusFilter
        ? isActiveStatus && job.status === statusFilter
        : isActiveStatus;
    });
  }, [activeDownloadEntries, statusFilter]);

  const filteredHistory = useMemo(() => {
    // Filter directly on downloadHistory, ensuring job.status is valid JobStatus
    return statusFilter
      ? downloadHistory.filter((job) => job.status === statusFilter)
      : downloadHistory;
  }, [downloadHistory, statusFilter]);

  // Memoize counts based on original data sources
  const {
    activeCount,
    completedCount,
    errorCount,
    queuedCount,
    downloadingCount,
  } = useMemo(() => {
    let active = 0;
    let queued = 0;
    let downloading = 0;
    Object.values(activeDownloads || {}).forEach((j) => {
      if (["queued", "started", "downloading"].includes(j.status)) active++;
      if (j.status === "queued") queued++;
      if (j.status === "downloading" || j.status === "processing")
        downloading++; // Include 'started' in downloading count
    });

    const completed = downloadHistory.filter(
      (j) => j.status === "completed"
    ).length;
    const error = downloadHistory.filter((j) =>
      ["error", "cancelled"].includes(j.status)
    ).length;
    return {
      activeCount: active,
      completedCount: completed,
      errorCount: error,
      queuedCount: queued,
      downloadingCount: downloading,
    };
  }, [activeDownloads, downloadHistory]);

  // --- Memoized Callbacks ---

  const handleCancel = useCallback(
    (jobId: string) => {
      cancelDownload(jobId); // Assuming cancelDownload is stable from context
    },
    [cancelDownload]
  );

  const handleToggleExpand = useCallback((jobId: string) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  }, []); // Doesn't depend on external values other than setter

  // Filter handlers (no need for useCallback unless passed deeply)
  const handleStatusFilterChange = (status: JobStatus) => {
    setStatusFilter((prev) => (prev === status ? null : status));
    setExpandedJobId(null); // Collapse all when filter changes
  };
  const toggleFiltering = () => setIsFiltering(!isFiltering);
  const clearFilter = () => setStatusFilter(null);

  return (
    <Card className="w-full overflow-hidden">
      {" "}
      {/* Added overflow-hidden */}
      <CardHeader className="pb-3 border-b">
        {" "}
        {/* Added border */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
          {" "}
          {/* Changed items-center to start */}
          <div>
            {/* <CardTitle>Downloads</CardTitle> */}
            <CardDescription className="flex flex-wrap gap-2 mt-1 text-xs">
              {" "}
              {/* Made text smaller */}
              {/* Use memoized counts */}
              <Badge
                variant="outline"
                className="border-blue-500/50 text-blue-600 dark:text-blue-400"
              >
                {queuedCount} Queued
              </Badge>
              <Badge
                variant="outline"
                className="border-indigo-500/50 text-indigo-600 dark:text-indigo-400"
              >
                {downloadingCount} Downloading
              </Badge>
              <Badge
                variant="outline"
                className="border-green-500/50 text-green-600 dark:text-green-400"
              >
                {completedCount} Completed
              </Badge>
              <Badge
                variant="outline"
                className="border-red-500/50 text-red-600 dark:text-red-400"
              >
                {errorCount} Failed/Cancelled
              </Badge>
            </CardDescription>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {" "}
            {/* Prevent shrinking */}
            <Button
              variant="outline"
              size="sm"
              onClick={refreshJobs}
              aria-label="Refresh Downloads"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFiltering}
              aria-label="Toggle Filters"
            >
              <FilterIcon className="h-4 w-4" />
            </Button>
            {/* Clear History Button */}
            {activeTab === "history" && downloadHistory.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={clearHistory}
                      aria-label="Clear History"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Clear Download History</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
        {/* Filters */}
        {isFiltering && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            {" "}
            {/* Added border */}
            {(
              [
                "queued",
                "downloading",
                "completed",
                "error",
                "cancelled",
              ] as JobStatus[]
            ).map((status) => (
              <Badge
                key={status}
                variant={statusFilter === status ? "default" : "secondary"} // Use secondary for non-selected
                className="cursor-pointer hover:bg-muted capitalize" // Nicer hover, capitalize text
                onClick={() => handleStatusFilterChange(status)}
              >
                {status}
              </Badge>
            ))}
            {statusFilter && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1 text-muted-foreground hover:text-foreground"
                onClick={clearFilter}
              >
                <XIcon className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {" "}
        {/* Remove padding */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 m-2">
            {" "}
            {/* Removed rounded-none and border-b */}
            <TabsTrigger value="active">
              <DownloadIcon className="h-4 w-4" />
              Active {" "}
              <span className="text-xs ml-1 text-muted-foreground data-[state=active]:text-foreground">
                ({activeCount})
              </span>{" "}
              {/* Ensure count color also changes */}
            </TabsTrigger>
            <TabsTrigger value="history">
              <HistoryIcon className="h-4 w-4" />
              History{" "}
              <span className="text-xs ml-1 text-muted-foreground data-[state=active]:text-foreground">
                ({downloadHistory.length})
              </span>{" "}
              {/* Ensure count color also changes */}
            </TabsTrigger>
          </TabsList>

          {/* Active Tab Content */}
          <TabsContent value="active" className="mt-0">
            {isInitialLoading && activeDownloadEntries.length === 0 ? ( // Show spinner only if truly empty initially
              <div className="flex justify-center items-center py-8 h-[400px]">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredActiveDownloads.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground h-[400px] flex items-center justify-center">
                {statusFilter
                  ? `No downloads match the filter "${statusFilter}".`
                  : "No active downloads."}
              </div>
            ) : (
              <ScrollArea className="h-[500px] viewport-margins">
                {" "}
                {/* Add custom class */}
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  {/* Added fixed layout and width classes */}
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        {/* Added explicit widths - adjust percentages as needed */}
                        <TableHead className="w-[35%] pl-4">File</TableHead>
                        <TableHead className="w-[18%]">Status</TableHead>
                        <TableHead className="w-[18%]">Progress</TableHead>
                        <TableHead className="w-[10%]">Size</TableHead>
                        <TableHead className="w-[10%]">Speed</TableHead>
                        <TableHead className="w-[10%]">ETA</TableHead>
                        <TableHead className="w-[7%] text-center pr-4">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredActiveDownloads.map(([jobId, download]) => (
                        <MemoizedDownloadTableRow // Use memoized component
                          key={jobId}
                          jobId={jobId}
                          download={download}
                          onCancel={() => handleCancel(jobId)} // Pass stable callback
                          isExpanded={expandedJobId === jobId}
                          onToggleExpand={() => handleToggleExpand(jobId)} // Pass stable callback
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* History Tab Content */}
          <TabsContent value="history" className="mt-0">
            {downloadHistory.length === 0 && !statusFilter ? ( // Check original length before filtering for empty state
              <div className="p-6 text-center text-muted-foreground h-[400px] flex items-center justify-center">
                Your download history is empty.
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground h-[400px] flex items-center justify-center">
                {statusFilter
                  ? `No history items match the filter "${statusFilter}".`
                  : "No download history available."}
              </div>
            ) : (
              <ScrollArea className="h-[500px] viewport-margins">
                {/* Mobile View */}
                <div className="space-y-1 p-2 md:hidden">
                  {filteredHistory.map((job) => (
                    <MemoizedMobileHistoryCard // Use memoized component
                      key={job.jobId}
                      jobId={job.jobId}
                      download={job}
                      isExpanded={expandedJobId === job.jobId}
                      onToggleExpand={() => handleToggleExpand(job.jobId)} // Pass stable callback
                    />
                  ))}
                </div>
                {/* Desktop Table View */}
                <div className="hidden md:block">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40%] pl-4">File</TableHead>
                        <TableHead className="w-[12%]">Status</TableHead>
                        <TableHead className="w-[12%]">Type</TableHead>
                        <TableHead className="w-[12%]">Size</TableHead>
                        <TableHead className="w-[12%]">Time</TableHead>
                        <TableHead className="w-[16%]">Completed</TableHead>
                        <TableHead className="w-[8%] text-center pr-4">
                          Details
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredHistory.map((job) => (
                        <MemoizedHistoryTableRow // Use memoized component
                          key={job.jobId}
                          jobId={job.jobId}
                          download={job}
                          isExpanded={expandedJobId === job.jobId}
                          onToggleExpand={() => handleToggleExpand(job.jobId)} // Pass stable callback
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// --- Helper Components (Memoized) ---

interface TableRowProps {
  jobId: string;
  download: JobInfo; // Use the specific type from context/backend
  onCancel: () => void; // Use specific signature
  isExpanded: boolean;
  onToggleExpand: () => void; // Use specific signature
}

const MemoizedDownloadTableRow = React.memo(DownloadTableRow); // Export memoized version
function DownloadTableRow({
  jobId,
  download,
  onCancel,
  isExpanded,
  onToggleExpand,
}: TableRowProps) {
  // Memoize filename calculation if outputPath parsing is complex/frequent
  const filename = useMemo(() => {
    if (!download.outputPath)
      return download.title || `Download ${jobId.slice(0, 6)}`;
    // Basic parsing, should be fast enough without memo usually
    const pathParts = download.outputPath.split(/[/\\]/);
    return (
      pathParts[pathParts.length - 1] ||
      download.title ||
      `Download ${jobId.slice(0, 6)}`
    );
  }, [download.outputPath, download.title, jobId]);

  const progressPercent =
    download.percent ?? (download.status === "completed" ? 100 : 0);

  // Format speed directly, handle potential string '%' speed from FFmpeg during merge init
  const formattedSpeed = useMemo(() => {
    if (!download.speed) return "N/A";
    if (typeof download.speed === "number")
      return `${formatBytes(download.speed * 1024 * 1024)}/s`; // Assuming speed is MB/s
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("x")
    )
      return download.speed; // Keep "1.5x" as is
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("kB/s")
    )
      return download.speed; // Keep kbps as is
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("MB/s")
    )
      return download.speed; // Keep MBps as is
    return "..."; // Indicate calculating or unknown format
  }, [download.speed]);

  const formattedEta = useMemo(() => {
    if (download.status === "queued") return "Queued";
    if (download.status === "completed") return "Done";
    if (download.status === "error" || download.status === "cancelled")
      return "-";
    return download.eta || "Estimating...";
  }, [download.status, download.eta]);

  return (
    <>
      <TableRow
        className="text-sm hover:bg-muted/50 data-[state=expanded]:bg-muted/50" // Add expanded state style
        data-state={isExpanded ? "expanded" : "collapsed"}
      >
        {/* Use pl-4/pr-4 for padding on first/last cells */}
        <TableCell className="font-medium truncate pl-4" title={filename}>
          {filename}
        </TableCell>
        <TableCell>
          <StatusBadge status={download.status} />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Progress
              value={progressPercent}
              className="hidden lg:block w-full h-1.5"
            />{" "}
            {/* Smaller progress bar */}
            <span className="text-xs text-muted-foreground w-8 text-right">
              {progressPercent.toFixed(0)}%
            </span>
          </div>
        </TableCell>
        <TableCell className="text-xs">
          {download.size ? formatBytes(download.size) : "N/A"}
        </TableCell>
        <TableCell className="text-xs">{formattedSpeed}</TableCell>
        <TableCell className="text-xs">{formattedEta}</TableCell>
        <TableCell className="text-center pr-4">
          <div className="flex items-center justify-center gap-1">
            {/* Cancel Button */}
            {(download.status === "queued" ||
              download.status === "downloading" ||
              download.status === "processing") && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel();
                      }}
                      aria-label="Cancel Download"
                    >
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* Expand Button */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={onToggleExpand}
                    aria-label={
                      isExpanded ? "Collapse Details" : "Expand Details"
                    }
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isExpanded ? "Collapse" : "Expand"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/40">
          <TableCell colSpan={7} className="p-0">
            {" "}
            {/* Remove padding */}
            <div className="p-3 pl-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {" "}
              {/* Adjust grid and padding */}
              {/* Render relevant details using MemoizedDetailItem */}
              {download.type && (
                <MemoizedDetailItem
                  icon={<FileIcon className="h-4 w-4" />}
                  label="Type"
                  value={download.type}
                />
              )}
              {download.bitrate && (
                <MemoizedDetailItem
                  icon={<HardDriveIcon className="h-4 w-4" />}
                  label="Avg Bitrate"
                  value={download.bitrate}
                />
              )}
              {download.fps && (
                <MemoizedDetailItem
                  icon={<Gauge className="h-4 w-4" />}
                  label="FPS"
                  value={download.fps}
                />
              )}
              {download.frames && (
                <MemoizedDetailItem
                  icon={<Layers className="h-4 w-4" />}
                  label="Frames"
                  value={download.frames}
                />
              )}
              {download.startTime && download.endTime && (
                <MemoizedDetailItem
                  icon={<Timer className="h-4 w-4" />}
                  label="Duration"
                  value={formatTime(download.endTime - download.startTime)}
                />
              )}
              {download.timeElapsed && (
                <MemoizedDetailItem
                  icon={<Clock className="h-4 w-4" />}
                  label="Time Elapsed"
                  value={
                    typeof download.timeElapsed === "number"
                      ? formatTime(download.timeElapsed)
                      : download.timeElapsed
                  }
                />
              )}
              {/* Show output path, allow clicking */}
              {download.outputPath && (
                <MemoizedDetailItem
                  icon={<FileIcon className="h-4 w-4" />}
                  label="Output Path"
                  value={download.outputPath}
                  className="col-span-full" // Take full width
                  isPath={true} // Indicate it's a path
                />
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// --- History Table Row (Memoized) ---
interface HistoryTableRowProps {
  jobId: string;
  download: JobInfo;
  isExpanded: boolean;
  onToggleExpand: () => void;
}
const MemoizedHistoryTableRow = React.memo(HistoryTableRow);
function HistoryTableRow({
  jobId,
  download,
  isExpanded,
  onToggleExpand,
}: HistoryTableRowProps) {
  const filename = useMemo(() => {
    if (!download.outputPath)
      return download.title || `Download ${jobId.slice(0, 6)}`;
    const pathParts = download.outputPath.split(/[/\\]/);
    return (
      pathParts[pathParts.length - 1] ||
      download.title ||
      `Download ${jobId.slice(0, 6)}`
    );
  }, [download.outputPath, download.title, jobId]);

  const completedAt = download.endTime;
  const downloadTime =
    download.timeElapsed ??
    (download.endTime && download.startTime
      ? Math.floor((download.endTime - download.startTime) / 1000)
      : null);

  return (
    <>
      <TableRow
        className="text-sm hover:bg-muted/50 data-[state=expanded]:bg-muted/50"
        data-state={isExpanded ? "expanded" : "collapsed"}
      >
        <TableCell className="font-medium truncate pl-4" title={filename}>
          {filename}
        </TableCell>
        <TableCell>
          <StatusBadge status={download.status} />
        </TableCell>
        <TableCell>
        {download.type}
        </TableCell>
        <TableCell className="text-xs">
          {download.size ? formatBytes(download.size) : "N/A"}
        </TableCell>
        <TableCell className="text-xs">
          {typeof downloadTime === "number" ? formatTime(downloadTime) : "N/A"}
        </TableCell>
        <TableCell className="text-xs">
          {completedAt ? new Date(completedAt).toLocaleString() : "N/A"}
        </TableCell>
        <TableCell className="text-center pr-4">
          <div className="flex gap-1">
           <Tooltip>
            <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                window.electronAPI.shell.openFile(download.outputPath)
              }
            >
              <PlayCircle className="h-4 w-4" />
            </Button>
            </TooltipTrigger>
            <TooltipContent>Play Media</TooltipContent>
           </Tooltip>
           <Tooltip>
            <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                window.electronAPI.shell.showItemInFolder(download.outputPath)
              }
            >
              <FileText className="h-4 w-4" />
            </Button>
            </TooltipTrigger>
            <TooltipContent>Show in File Explorer</TooltipContent>
           </Tooltip>
           
          </div>
        </TableCell>
      </TableRow>
    </>
  );
}

const MemoizedMobileDownloadCard = React.memo(MobileDownloadCard);
function MobileDownloadCard({
  jobId,
  download,
  onCancel,
  isExpanded,
  onToggleExpand,
}: TableRowProps) {
  const filename = useMemo(() => {
    if (!download.outputPath)
      return download.title || `Download ${jobId.slice(0, 6)}`;
    const pathParts = download.outputPath.split(/[/\\]/);
    return (
      pathParts[pathParts.length - 1] ||
      download.title ||
      `Download ${jobId.slice(0, 6)}`
    );
  }, [download.outputPath, download.title, jobId]);

  const progressPercent =
    download.percent ?? (download.status === "completed" ? 100 : 0);

  const formattedSpeed = useMemo(() => {
    if (!download.speed) return "N/A";
    if (typeof download.speed === "number")
      return `${formatBytes(download.speed * 1024 * 1024)}/s`;
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("x")
    )
      return download.speed;
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("kB/s")
    )
      return download.speed;
    if (
      typeof download.speed === "string" &&
      (download.speed as string).includes("MB/s")
    )
      return download.speed;
    return "...";
  }, [download.speed]);

  const formattedEta = useMemo(() => {
    if (download.status === "queued") return "Queued";
    if (download.status === "completed") return "Done";
    if (download.status === "error" || download.status === "cancelled")
      return "-";
    return download.eta || "Estimating...";
  }, [download.status, download.eta]);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggleExpand}
      className="border rounded-lg overflow-hidden"
    >
      <div className="p-3 text-sm">
        {" "}
        {/* Reduced padding */}
        <div className="flex justify-between items-start mb-2">
          <CollapsibleTrigger asChild>
            <button className="font-medium truncate pr-2 text-left flex-grow hover:text-primary">
              {filename}
            </button>
          </CollapsibleTrigger>
          {(download.status === "queued" ||
            download.status === "downloading" ||
            download.status === "processing") && (
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-destructive flex-shrink-0 -mr-1 -mt-1"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={download.status} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Size</div>
            <div className="text-xs">
              {download.size ? formatBytes(download.size) : "N/A"}
            </div>
          </div>
        </div>
        <div className="mb-2">
          <div className="flex justify-between text-xs text-muted-foreground mb-0.5">
            <span>Progress</span>
            <span>{progressPercent.toFixed(0)}%</span>
          </div>
          <Progress value={progressPercent} className="w-full h-1.5" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <div className="text-xs text-muted-foreground">Speed</div>
            <div className="text-xs">{formattedSpeed}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">ETA</div>
            <div className="text-xs">{formattedEta}</div>
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-3 pt-2 pb-3 bg-muted/30 space-y-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            {download.type && (
              <MemoizedDetailItem
                icon={<FileIcon className="h-4 w-4" />}
                label="Type"
                value={download.type}
              />
            )}
            {download.bitrate && (
              <MemoizedDetailItem
                icon={<HardDriveIcon className="h-4 w-4" />}
                label="Avg Bitrate"
                value={download.bitrate}
              />
            )}
            {download.fps && (
              <MemoizedDetailItem
                icon={<Gauge className="h-4 w-4" />}
                label="FPS"
                value={download.fps}
              />
            )}
            {download.frames && (
              <MemoizedDetailItem
                icon={<Layers className="h-4 w-4" />}
                label="Frames"
                value={download.frames}
              />
            )}
            {download.startTime && download.endTime && (
              <MemoizedDetailItem
                icon={<Timer className="h-4 w-4" />}
                label="Duration"
                value={formatTime(download.endTime - download.startTime)}
              />
            )}
            {download.timeElapsed && (
              <MemoizedDetailItem
                icon={<Clock className="h-4 w-4" />}
                label="Time Elapsed"
                value={
                  typeof download.timeElapsed === "number"
                    ? formatTime(download.timeElapsed)
                    : download.timeElapsed
                }
              />
            )}
          </div>
          {download.outputPath && (
            <MemoizedDetailItem
              icon={<FileIcon className="h-4 w-4" />}
              label="Output Path"
              value={download.outputPath}
              className="col-span-full"
              isPath={true}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const MemoizedMobileHistoryCard = React.memo(MobileHistoryCard);
function MobileHistoryCard({ jobId, download, isExpanded, onToggleExpand }) {
  const filename = useMemo(() => {
    if (!download.outputPath)
      return download.title || `Download ${jobId.slice(0, 6)}`;
    const pathParts = download.outputPath.split(/[/\\]/);
    return (
      pathParts[pathParts.length - 1] ||
      download.title ||
      `Download ${jobId.slice(0, 6)}`
    );
  }, [download.outputPath, download.title, jobId]);

  const completedAt = download.endTime;
  const downloadTime =
    download.timeElapsed ??
    (download.endTime && download.startTime
      ? Math.floor((download.endTime - download.startTime) / 1000)
      : null);

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onToggleExpand}
      className="border rounded-lg overflow-hidden"
    >
      <div className="p-3 text-sm">
        <CollapsibleTrigger asChild>
          <button className="font-medium truncate pr-2 text-left w-full hover:text-primary mb-2">
            {filename}
          </button>
        </CollapsibleTrigger>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2">
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={download.status} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Size</div>
            <div className="text-xs">
              {download.size ? formatBytes(download.size) : "N/A"}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <div>
            <div className="text-xs text-muted-foreground">Completed</div>
            <div className="text-xs">
              {completedAt ? new Date(completedAt).toLocaleString() : "N/A"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Duration</div>
            <div className="text-xs">
              {typeof downloadTime === "number"
                ? formatTime(downloadTime)
                : "N/A"}
            </div>
          </div>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-3 pt-2 pb-3 bg-muted/30 space-y-2 border-t">
          <div className="grid grid-cols-2 gap-2">
            {download.type && (
              <MemoizedDetailItem
                icon={<FileIcon className="h-4 w-4" />}
                label="Type"
                value={download.type}
              />
            )}
            {download.bitrate && (
              <MemoizedDetailItem
                icon={<HardDriveIcon className="h-4 w-4" />}
                label="Avg Bitrate"
                value={download.bitrate}
              />
            )}
            {download.speed && (
              <MemoizedDetailItem
                icon={<Gauge className="h-4 w-4" />}
                label="Avg Speed"
                value={
                  typeof download.speed === "number"
                    ? `${formatBytes(download.speed * 1024 * 1024)}/s`
                    : download.speed
                }
              />
            )}
            {/* Add other relevant historical data */}
          </div>
          {download.outputPath && (
            <MemoizedDetailItem
              icon={<FileIcon className="h-4 w-4" />}
              label="Output Path"
              value={download.outputPath}
              className="col-span-full"
              isPath={true}
            />
          )}
          {download.status === "error" && download.error && (
            <MemoizedDetailItem
              icon={<XIcon className="h-4 w-4 text-destructive" />}
              label="Error"
              value={download.error}
              className="col-span-full text-destructive"
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const MemoizedDetailItem = React.memo(DetailItem); // Memoize DetailItem
interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | undefined | null; // Allow undefined/null
  className?: string;
  isPath?: boolean; // Optional flag for paths
}
function DetailItem({
  icon,
  label,
  value,
  className = "",
  isPath = false,
}: DetailItemProps) {
  const displayValue = value ?? "N/A"; // Handle null/undefined

  const handlePathClick = () => {
    if (isPath && typeof value === "string") {
      window.electronAPI.shell.openFile(value);
    }
  };

  return (
    <div className={`flex items-start gap-1.5 ${className}`}>
      <div className="mt-0.5 text-muted-foreground flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        {" "}
        {/* Prevent label/value overflow issues */}
        <div className="text-xs text-muted-foreground">{label}</div>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={`text-xs font-medium truncate ${
                  isPath
                    ? "cursor-pointer hover:underline text-blue-600 dark:text-blue-400"
                    : ""
                }`}
                onClick={handlePathClick}
                title={
                  typeof displayValue === "string" ? displayValue : undefined
                } // Show full value on hover
              >
                {/* If path, show only filename? Or keep full path? Let's keep full for now */}
                {displayValue}
              </div>
            </TooltipTrigger>
            {/* Show tooltip only if text is likely truncated or it's a path */}
            {(typeof displayValue === "string" && displayValue.length > 30) ||
            isPath ? (
              <TooltipContent align="start">
                <p className="max-w-xs break-words">{displayValue}</p>
                {isPath && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to Open File
                  </p>
                )}
              </TooltipContent>
            ) : null}
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

// Memoize StatusBadge too if status values change rapidly (unlikely, but good practice)
const MemoizedStatusBadge = React.memo(StatusBadge);
function StatusBadge({ status }: { status: JobStatus | undefined }) {
  // Allow undefined status
  const statusText = status || "unknown";
  let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
  let className = "";
  let icon = null; // Optional icon

  switch (status) {
    case "queued":
      variant = "outline";
      className = "border-blue-500/50 text-blue-600 dark:text-blue-400";
      // icon = <Clock className="h-3 w-3 mr-1" />; // Example icon
      break;
    case "processing": // Treat started visually like downloading
    case "downloading":
      variant = "secondary";
      className =
        "border-indigo-500/50 text-indigo-600 dark:text-indigo-400 animate-pulse"; // Keep pulse for downloading
      // icon = <DownloadIcon className="h-3 w-3 mr-1" />;
      break;
    case "completed":
      variant = "default";
      className =
        "bg-green-100 dark:bg-green-900/50 border border-green-500/50 text-green-700 dark:text-green-400"; // Softer green
      // icon = <Check className="h-3 w-3 mr-1" />;
      break;
    case "error":
      variant = "destructive";
      className =
        "bg-red-100 dark:bg-red-900/50 border border-red-500/50 text-red-700 dark:text-red-400"; // Softer red
      // icon = <XIcon className="h-3 w-3 mr-1" />;
      break;
    case "cancelled":
      variant = "outline";
      className = "border-amber-500/50 text-amber-600 dark:text-amber-400";
      // icon = <XIcon className="h-3 w-3 mr-1" />;
      break;
    default:
      variant = "outline";
      className = "text-muted-foreground";
  }

  return (
    <Badge
      variant={variant}
      className={`text-xs capitalize px-1.5 py-0.5 ${className}`}
    >
      {" "}
      {statusText}
    </Badge>
  );
}
