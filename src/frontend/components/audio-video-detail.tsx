import { useState, useEffect, useMemo, useCallback } from "react"; // Added useCallback
import Markdown from "react-markdown";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Download,
  Film,
  FileVideo,
  Music,
  Check,
  Calendar,
  Clock,
  ExternalLink,
  Eye,
  ThumbsUp,
  DownloadIcon,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DownloadStatus, useDownload } from "@/context/download-context";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  AudioFormat,
  FormatBase,
  VideoFormat,
  YtDlpAudioMetadata,
  YtDlpMediaMetadata,
  YtDlpMediaType,
} from "@/types";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { MediaType } from "@/types/FfmpegCore";
import { formatDuration } from "@/lib/utils";
import { Toggle } from "./ui/toggle";
import { ElectronLink } from "./electron-hyperlink";

// Helper to sort quality strings like "1080p", "720p", etc.
const sortQualityStrings = (a: string, b: string): number => {
  const numA = parseInt(a.replace(/[^0-9]/g, ""), 10);
  const numB = parseInt(b.replace(/[^0-9]/g, ""), 10);
  if (!isNaN(numA) && !isNaN(numB)) {
    return numB - numA; // Higher number first
  }
  // Fallback for non-numeric strings (less reliable)
  return b.localeCompare(a);
};

// Helper function to determine the default download type based on data and available formats
const getDefaultDownloadType = (
  dataType: YtDlpMediaType | undefined,
  hasCombined: boolean,
  hasVideo: boolean,
  hasAudio: boolean
): MediaType => {
  if (dataType === "audio" && hasAudio) {
    return "audio";
  }
  if (dataType === "video") {
    // PRIORITIZE VIDEO TAB if available for video types
    if (hasVideo) return "video";
    if (hasCombined) return "combined"; // Fallback to combined
    if (hasAudio) return "audio"; // Fallback to audio if only that exists
  }
  // Fallback priority if data type unknown or not video/audio
  if (hasCombined) return "combined";
  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  // Default fallback
  return "video";
};

export function AudioVideoDownloadOptions({
  data,
  status,
}: {
  data: YtDlpMediaMetadata;
  status: DownloadStatus;
}) {
  const { startDownload } = useDownload();

  // State
  const [downloadType, setDownloadType] = useState<MediaType>("video"); // Default before data loads
  const [selectedQuality, setSelectedQuality] = useState(""); // For video tab
  const [selectedFormat, setSelectedFormat] = useState(""); // format_id
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Toggle handler
  const handleAudioToggle = () => {
    setIsAudioMuted(!isAudioMuted);
  };
  // --- Memoized Format Calculations ---

  // Get available quality strings sorted best to worst
  const availableQualities = useMemo(() => {
    if (
      !data ||
      data.__dataType === "playlist" ||
      !data.formats?.formatsByQuality
    ) {
      return [];
    }
    const qualities = Object.keys(data.formats.formatsByQuality);
    // Filter out qualities that don't have *any* video formats (video or combined)
    const qualitiesWithVideo = qualities.filter(
      (q) =>
        (data.formats.formatsByQuality[q]?.video?.length ?? 0) > 0 ||
        (data.formats.formatsByQuality[q]?.combined?.length ?? 0) > 0
    );
    return qualitiesWithVideo.sort(sortQualityStrings); // Sort highest first
  }, [data]);

  const memoizedGetFormatsForQuality = useMemo(() => {
    // useCallback ensures the function identity is stable if data hasn't changed
    return (quality: string) => {
      if (!data || data.__dataType === "playlist" || !quality)
        return { video: [], combined: [] };
      return {
        video: data.formats.formatsByQuality[quality]?.video || [],
        combined: data.formats.formatsByQuality[quality]?.combined || [],
      };
    };
  }, [data]); // Keep dependency on data

  // Audio formats grouped by quality tier
  const memoizedAudioFormatsByTier = useMemo(() => {
    if (!data || data.__dataType === "playlist" || !data.formats.audioFormats)
      return { high: [], medium: [], low: [] };

    // Deduplicate audio formats first
    const allRawAudio = [
      ...(data.formats.audioFormats?.high || []),
      ...(data.formats.audioFormats?.medium || []),
      ...(data.formats.audioFormats?.low || []),
    ];
    const uniqueAudioMap = new Map<string, AudioFormat>();
    allRawAudio.forEach((format) => {
      if (!uniqueAudioMap.has(format.format_id)) {
        uniqueAudioMap.set(format.format_id, format);
      }
    });
    const uniqueAudioFormats = Array.from(uniqueAudioMap.values());

    // Re-assign to tiers based on original data (or bitrate if needed)
    // This logic might need refinement based on how yt-dlp assigns tiers
    const highBitrateThreshold = 192; // Example threshold
    const mediumBitrateThreshold = 128; // Example threshold

    const tiers = {
      high: [] as AudioFormat[],
      medium: [] as AudioFormat[],
      low: [] as AudioFormat[],
    };
    uniqueAudioFormats.forEach((f) => {
      // Prefer original tier if available, otherwise guess by bitrate
      const originalTier = Object.keys(data.formats.audioFormats!).find(
        (tier) =>
          data.formats.audioFormats![
            tier as keyof typeof data.formats.audioFormats
          ]?.some((tf) => tf.format_id === f.format_id)
      );
      if (
        originalTier === "high" ||
        (!originalTier && f.abr >= highBitrateThreshold)
      ) {
        tiers.high.push(f);
      } else if (
        originalTier === "medium" ||
        (!originalTier && f.abr >= mediumBitrateThreshold)
      ) {
        tiers.medium.push(f);
      } else {
        tiers.low.push(f);
      }
    });

    return tiers;
  }, [data]);

  // Combined formats, sorted best to worst
  const sortedCombinedFormats = useMemo(() => {
    if (!data || data.__dataType === "playlist") return [];
    let combinedFormats: VideoFormat[] = [];
    const uniqueFormats = new Map<string, VideoFormat>();

    [...availableQualities, "*"].forEach((quality) => {
      const formats = data.formats.formatsByQuality[quality]?.combined || [];
      formats.forEach((format) => {
        if (!uniqueFormats.has(format.format_id)) {
          uniqueFormats.set(format.format_id, format as VideoFormat);
        }
      });
    });

    return Array.from(uniqueFormats.values()).sort((a, b) => {
      // Sort primarily by height, then bitrate, then format_id
      if (a.height && b.height) {
        if (a.height !== b.height) return b.height - a.height;
      }
      if (a.tbr && b.tbr) {
        if (a.tbr !== b.tbr) return b.tbr - a.tbr;
      }
      if (a.vbr && b.vbr) {
        // Fallback to video bitrate
        if (a.vbr !== b.vbr) return b.vbr - a.vbr;
      }
      return a.format_id.localeCompare(b.format_id);
    });
  }, [data, availableQualities]);

  // All unique audio formats, sorted best to worst
  const sortedAudioFormats = useMemo(() => {
    const allTiers = [
      ...(memoizedAudioFormatsByTier.high || []),
      ...(memoizedAudioFormatsByTier.medium || []),
      ...(memoizedAudioFormatsByTier.low || []),
    ];
    return allTiers.sort((a, b) => {
      if (a.abr && b.abr) {
        if (a.abr !== b.abr) return b.abr - a.abr; // Higher bitrate first
      }
      // Add other sorting criteria if needed (e.g., sample rate)
      return a.format_id.localeCompare(b.format_id);
    });
  }, [memoizedAudioFormatsByTier]);

  // Helper to get sorted video-only formats for a given quality
  const getSortedVideosForQuality = useCallback(
    (quality: string): VideoFormat[] => {
      if (!quality || !data || data.__dataType === "playlist") return [];
      const formats = memoizedGetFormatsForQuality(quality).video || [];
      return [...formats].sort((a, b) => {
        // Sort primarily by height (should be same for quality), then fps, then bitrate
        if (a.fps && b.fps) {
          if (a.fps !== b.fps) return b.fps - a.fps;
        }
        if (a.vbr && b.vbr) {
          if (a.vbr !== b.vbr) return b.vbr - a.vbr;
        }
        return a.format_id.localeCompare(b.format_id);
      });
    },
    [data, memoizedGetFormatsForQuality]
  ); // Depends on data

  // Determine which tabs should be visible
  const showCombinedTab = sortedCombinedFormats.length > 0;
  const showVideoTab = availableQualities.some(
    (q) => memoizedGetFormatsForQuality(q).video.length > 0
  );
  const showAudioTab = sortedAudioFormats.length > 0;

  // --- Effects ---

  // Effect 1: Set the initial/default download type when data loads/changes
  useEffect(() => {
    if (status === "success" && data && data.__dataType !== "playlist") {
      const defaultType = getDefaultDownloadType(
        data.__dataType,
        showCombinedTab,
        showVideoTab,
        showAudioTab
      );
      setDownloadType(defaultType);
      // Reset selections when data fundamentally changes
      // setSelectedQuality(""); // Let next effect handle this
      // setSelectedFormat(""); // Let next effect handle this
    }
    // Reset if status goes back to loading/error
    if (status !== "success") {
      setDownloadType("video"); // Reset to a sensible default
      setSelectedQuality("");
      setSelectedFormat("");
    }
  }, [data, status, showCombinedTab, showVideoTab, showAudioTab]);

  // Effect 2: Set default selections (quality & format) when downloadType changes or data loads
  useEffect(() => {
    // Don't run if data isn't loaded
    if (status !== "success" || !data || data.__dataType === "playlist") return;

    let defaultQuality = "";
    let defaultFormatId = "";

    if (downloadType === "video" && showVideoTab) {
      // Find best available quality that has video-only formats
      const bestQuality = availableQualities.find(
        (q) => memoizedGetFormatsForQuality(q).video.length > 0
      );
      if (bestQuality) {
        defaultQuality = bestQuality;
        const bestVideoInQuality = getSortedVideosForQuality(bestQuality)[0];
        if (bestVideoInQuality) {
          defaultFormatId = bestVideoInQuality.format_id;
        }
      }
    } else if (downloadType === "audio" && showAudioTab) {
      defaultQuality = ""; // No quality selection for audio tab
      const bestAudio = sortedAudioFormats[0];
      if (bestAudio) {
        defaultFormatId = bestAudio.format_id;
      }
    } else if (downloadType === "combined" && showCombinedTab) {
      defaultQuality = ""; // No quality selection for combined tab
      const bestCombined = sortedCombinedFormats[0];
      if (bestCombined) {
        defaultFormatId = bestCombined.format_id;
      }
    } else {
      // Handle cases where the default tab might not have content (e.g., video default but no video formats)
      // Maybe switch to another available tab? Or just leave blank. Let's leave blank for now.
      defaultQuality = "";
      defaultFormatId = "";
    }

    setSelectedQuality(defaultQuality);
    setSelectedFormat(defaultFormatId);

    // Trigger this effect when the determined downloadType changes, or when the underlying data/formats change
  }, [
    downloadType,
    status,
    data,
    availableQualities,
    showVideoTab,
    showAudioTab,
    showCombinedTab,
    sortedAudioFormats,
    sortedCombinedFormats,
    getSortedVideosForQuality,
    memoizedGetFormatsForQuality,
  ]);

  // --- Render Logic ---

  if (status !== "success" || !data) {
    return null;
  }
  if (data.__dataType === "playlist") {
    return (
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Playlist Detected</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Playlist downloads not fully supported here.</p>
        </CardContent>
      </Card>
    );
  }

  // --- Helper Functions ---

  const formatFileSize = (size: number | undefined | null) => {
    if (!size) return "Unknown Size";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; // Use 1 decimal for KB/MB
    if (size < 1024 * 1024 * 1024)
      return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const getFormatDisplayName = (format: AudioFormat | VideoFormat) => {
    let name = format.format_note || format.format || format.format_id;
    if (
      format.resolution &&
      !name.startsWith(format.height?.toString() ?? "")
    ) {
      name = `${format.resolution} ${name}`;
    } else if (format.abr && !name.includes("kbps") && !format.format_note) {
      // Add bitrate for audio if note missing
      name = `${format.abr}kbps ${name}`;
    }
    return name.replace("audio only", "").replace("video only", "").trim(); // Clean up notes
  };

  // Find format by id (searches all relevant lists)
  const findFormatById = (
    formatId: string
  ): AudioFormat | VideoFormat | null => {
    if (!formatId || !data) return null;

    const allKnownFormats: (AudioFormat | VideoFormat)[] = [
      ...sortedCombinedFormats,
      ...sortedAudioFormats,
      // Include all video formats across all qualities
      ...availableQualities.flatMap(
        (q) => memoizedGetFormatsForQuality(q).video
      ),
    ];
    // Use a map for faster lookup if list gets huge, but find is likely fine here
    return allKnownFormats.find((f) => f.format_id === formatId) || null;
  };

  const getBestAudioForVideo = (): AudioFormat | null => {
    return sortedAudioFormats[0] || null; // Already sorted best first
  };

  // --- Event Handlers ---

  const handleManualFormatSelect = (formatId: string) => {
    setSelectedFormat(formatId);
    // If we are in the video tab, ensure the quality matches the selected format
    if (downloadType === "video") {
      const format = findFormatById(formatId) as VideoFormat;
      if (format && format.height) {
        // Check if it's likely a video format
        // Find the quality string that exactly matches this format's quality
        // Instead of using includes() which can match partial strings (e.g. "144" in "1440")
        // Look for exact matches or height matches
        const qualityMatch = availableQualities.find((q) => {
          // Exact match for the quality string
          if (q === format.format_note) return true;

          // Match based on the exact height in pixels
          const heightInQuality = parseInt(q.replace(/[^0-9]/g, ""), 10);
          return heightInQuality === format.height;
        });

        if (qualityMatch && qualityMatch !== selectedQuality) {
          setSelectedQuality(qualityMatch); // Sync quality badge if format is chosen directly
        }
      }
    }
  };

  const handleManualQualitySelect = (quality: string) => {
    setSelectedQuality(quality);
    // Auto-select the best format within the newly selected quality
    const bestVideoInQuality = getSortedVideosForQuality(quality)[0];
    setSelectedFormat(bestVideoInQuality?.format_id || ""); // Reset if no video in quality
  };

  // Fix for the download function to properly handle muted video
  const handleDownload = async () => {
    if (!selectedFormat) {
      toast.error("Error", { description: "Please select a format." });
      return;
    }
    const format = findFormatById(selectedFormat);
    if (!format) {
      toast.error("Error", { description: "Invalid format selected." });
      return;
    }
    if (downloadType === "video" && !selectedQuality) {
      toast.error("Error", { description: "Please select a video quality." });
      return;
    }

    setIsDownloading(true);
    try {
      if (downloadType === "combined") {
        await startDownload({
          data: data,
          method: "byId",
          type: "combined",
          formatId: selectedFormat,
        });
      } else if (downloadType === "video") {
        const bestAudio = getBestAudioForVideo();
        if (isAudioMuted) {
          // Download video with no audio
          await startDownload({
            data: data,
            method: "byId",
            type: "muteVideo", // This is the special type for muted video
            videoFormatId: selectedFormat,
          });
        } else {
          // Download video with audio
          await startDownload({
            data: data,
            method: "byId",
            type: "video",
            videoFormatId: selectedFormat,
            audioFormatId: bestAudio?.format_id, // Pass best audio ID (might be undefined if none found)
          });
        }
      } else if (downloadType === "audio") {
        await startDownload({
          data: data,
          method: "byId",
          type: "audio",
          formatId: selectedFormat,
        });
      }
      toast.success("Download Started", { description: "Added to queue." });
    } catch (error) {
      console.error("Download Error:", error);
      toast.error("Download Failed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Also update the quick download function to handle muted state
  const handleQuickDownload = async () => {
    let bestFormat: FormatBase | null = null;

    if (data.__dataType === "video") {
      // Try best video first (needs audio pairing), then best combined
      const bestVideo =
        availableQualities.length > 0
          ? getSortedVideosForQuality(availableQualities[0])[0]
          : null;
      const bestAudio = getBestAudioForVideo();
      const bestCombined = sortedCombinedFormats[0];

      if (bestVideo) {
        bestFormat = bestVideo; // Will be treated as 'video' type download
      } else if (bestCombined) {
        bestFormat = bestCombined;
      } else if (bestAudio) {
        // Fallback to best audio if no video/combined
        bestFormat = bestAudio;
      }
    } else if (data.__dataType === "audio") {
      // Try best audio first, then best combined (unlikely but possible)
      const bestAudio = sortedAudioFormats[0];
      const bestCombined = sortedCombinedFormats[0];
      if (bestAudio) {
        bestFormat = bestAudio;
      } else if (bestCombined) {
        bestFormat = bestCombined; // A combined format for an audio source? Odd.
      }
    } else {
      // Unknown type: Try combined -> video -> audio
      bestFormat =
        sortedCombinedFormats[0] ||
        (availableQualities.length > 0
          ? getSortedVideosForQuality(availableQualities[0])[0]
          : null) ||
        sortedAudioFormats[0];
    }

    if (!bestFormat) {
      toast.error("Error", { description: "No suitable format found." });
      return;
    }

    setIsDownloading(true);
    try {
      // Determine download type based on the chosen bestFormat
      let downloadParams: Parameters<typeof startDownload>[0] | null = null;

      if (
        bestFormat.vcodec !== "none" &&
        bestFormat.acodec !== "none" &&
        sortedCombinedFormats.some((f) => f.format_id === bestFormat!.format_id)
      ) {
        downloadParams = {
          data: data,
          method: "byId",
          type: "combined",
          formatId: bestFormat.format_id,
        };
      } else if (bestFormat.vcodec !== "none") {
        // Includes video-only streams
        const audioToPair = getBestAudioForVideo();

        if (isAudioMuted) {
          // If muted, use the muteVideo type
          downloadParams = {
            data: data,
            method: "byId",
            type: "muteVideo",
            videoFormatId: bestFormat.format_id,
            // No audio format needed for muted video
          };
        } else {
          // Normal video download with audio
          downloadParams = {
            data: data,
            method: "byId",
            type: "video",
            videoFormatId: bestFormat.format_id,
            audioFormatId: audioToPair?.format_id,
          };
        }
      } else if (bestFormat.acodec !== "none") {
        // Audio only
        downloadParams = {
          data: data,
          method: "byId",
          type: "audio",
          formatId: bestFormat.format_id,
        };
      }

      if (!downloadParams) {
        throw new Error("Could not determine download parameters.");
      }

      await startDownload(downloadParams);
      toast.success("Quick Download Started", {
        description: `Using ${getFormatDisplayName(
          bestFormat as VideoFormat
        )} (ID: ${bestFormat.format_id})`,
      });
    } catch (error) {
      console.error("Quick Download Error:", error);
      toast.error("Quick Download Failed", {
        description: error instanceof Error ? error.message : "Unknown error.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // --- Render Component ---

  const renderFormatItem = (format: VideoFormat | AudioFormat) => {
    const isSelected = selectedFormat === format.format_id;
    const isVideo = format.vcodec && format.vcodec !== "none";
    const isAudio = format.acodec && format.acodec !== "none";

    // Determine the primary Quality identifier (Resolution or Bitrate)
    let qualityIdentifier = format.format_note || format.format_id; // Fallback
    if (isVideo && format.resolution) {
      qualityIdentifier = format.resolution; // e.g., 2160p
    } else if (isAudio && format.abr) {
      qualityIdentifier = `${format.abr}kbps`; // e.g., 192kbps
    }

    // Format the File Size
    const fileSize = formatFileSize(format.filesize || format.filesize_approx);

    // Get simplified codec names
    const videoCodec =
      format.vcodec && format.vcodec !== "none"
        ? format.vcodec.split(".")[0].split("(")[0].toUpperCase()
        : null;
    const audioCodec =
      format.acodec && format.acodec !== "none"
        ? format.acodec.split(".")[0].split("(")[0].toUpperCase()
        : null;

    return (
      <div
        key={format.format_id}
        className={`relative p-3 border rounded-md cursor-pointer hover:bg-muted/50 transition-colors ${
          isSelected ? "border-primary" : "border-border"
        }`}
        onClick={() => handleManualFormatSelect(format.format_id)}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ")
            handleManualFormatSelect(format.format_id);
        }}
        title={`Select format ${format.format_id} (${qualityIdentifier} - ${fileSize})`}
      >
        {/* Top Row: Quality Badge, Size Badge ---- Extension Badge */}
        <div className="flex justify-between items-center mb-2">
          {/* Left Group: Quality + Size Badges */}
          <div className="flex items-center gap-2">
            {/* Quality Badge (Main Info) */}
            <Badge
              variant={isSelected ? "default" : "outline"}
              className="px-2 py-0.5 text-sm font-medium"
            >
              {qualityIdentifier}
            </Badge>
            {/* Size Badge */}
            <Badge variant="secondary" className="px-2 py-1 text-xs">
              {fileSize}
            </Badge>
          </div>
          {/* Right Group: Extension Badge */}
          <Badge variant="secondary" className="text-xs ml-2">
            {format.ext}
          </Badge>{" "}
          {/* Added ml-2 for spacing */}
        </div>

        {/* Bottom Row: Details (ID, Codecs, FPS, Channels, HDR) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
          <span title={`Format ID: ${format.format_id}`}>
            ID: {format.format_id}
          </span>
          {videoCodec && (
            <span title={`Video Codec: ${format.vcodec}`}>V: {videoCodec}</span>
          )}
          {audioCodec && (
            <span title={`Audio Codec: ${format.acodec}`}>A: {audioCodec}</span>
          )}
          {format.fps && <span>{format.fps}fps</span>}
          {format.audio_channels === 1 && <span>Mono</span>}
          {format.audio_channels === 2 && <span>Stereo</span>}
          {format.audio_channels && format.audio_channels > 2 && (
            <span>{format.audio_channels}ch</span>
          )}
          {format.dynamic_range && (
            <Badge
              variant="outline"
              className="px-1.5 py-0 text-xs leading-tight"
            >
              {["hdr", "hdr10", "hlg", "dolby vision"].includes(
                format.dynamic_range.toLowerCase()
              )
                ? "HDR"
                : format.dynamic_range.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Selected Checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 p-0.5 bg-primary rounded-full text-primary-foreground shadow">
            <Check className="h-3 w-3" strokeWidth={3} />
          </div>
        )}
      </div>
    );
  };
  const thumbnailURL = data.thumbnail || data.thumbnails[0].url;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {status === "success" && data && (
        <div className="bg-background rounded-lg p-6 w-full">
          <h2 className="text-2xl font-bold mb-4">
            {data && data?.__dataType === "audio" ? "Audio" : "Video"} Details
          </h2>

          <div className="space-y-6">
            {/* Thumbnail */}
            <div className="relative rounded-lg overflow-hidden w-full flex justify-center group">
              <Button
                size="icon"
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/60 text-white hover:bg-black/80 rounded-full shadow-md"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent event bubbling
                  startDownload({
                    type: "image",
                    method: "byURL",
                    url: thumbnailURL,
                    title: `${data.title} - Thumbnail`,
                    data: data,
                  });
                }}
              >
                <DownloadIcon className="w-5 h-5" />
              </Button>
              <img
                src={thumbnailURL}
                crossOrigin="anonymous"
                alt={data.title}
                className="w-auto max-h-[350px] object-contain"
              />
            </div>

            {/* Title */}
            <h3 className="text-xl font-semibold">{data.title || "Video"}</h3>

            {/* Channel */}
            <div className="flex items-center gap-2">
              From
              <ElectronLink
                href={
                  data && data?.__dataType === "video"
                    ? data.channel_url || data.original_url
                    : data.original_url
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-1 text-primary hover:underline font-medium"
              >
                {data && data?.__dataType === "video"
                  ? data.channel || data.uploader || data.extractor
                  : data.title ||
                    (data as YtDlpAudioMetadata).album ||
                    data.extractor}
                <ExternalLink className="size-4 my-auto" />
              </ElectronLink>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {data.duration_string && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>
                    {data.duration_string ||
                      formatDuration(data.duration) ||
                      "N/A"}
                  </span>
                </div>
              )}

              {data.view_count && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>
                    {data.view_count?.toLocaleString() || "N/A"} views
                  </span>
                </div>
              )}

              {data.like_count && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ThumbsUp className="h-4 w-4" />
                  <span>
                    {data.like_count?.toLocaleString() || "N/A"} likes
                  </span>
                </div>
              )}

              {data.upload_date && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {data.upload_date
                      ? new Date(
                          data.upload_date.replace(
                            /(\d{4})(\d{2})(\d{2})/,
                            "$1-$2-$3"
                          )
                        ).toLocaleDateString()
                      : "N/A"}
                  </span>
                </div>
              )}
            </div>

            {/* Description */}
            {data.description && (
              <div className="mt-4">
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <ScrollArea className="h-40 pr-4">
                  <div className="text-sm text-muted-foreground">
                    <Markdown>{data.description}</Markdown>
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
      )}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div>
              <CardTitle>Download Options</CardTitle>
              <CardDescription>Select format and quality</CardDescription>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleQuickDownload}
                    disabled={
                      isDownloading ||
                      status !== "success" ||
                      (!showCombinedTab && !showVideoTab && !showAudioTab)
                    }
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Quick Download
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download best available quality</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs
            value={downloadType}
            onValueChange={(val) => setDownloadType(val as MediaType)}
          >
            <TabsList className="mb-4 grid w-full grid-cols-1 sm:grid-cols-3">
              {showCombinedTab && (
                <TabsTrigger value="combined">
                  <Film className="mr-2 h-4 w-4" />
                  Combined
                </TabsTrigger>
              )}
              {showVideoTab && (
                <TabsTrigger value="video">
                  <FileVideo className="mr-2 h-4 w-4" />
                  Video + Audio
                </TabsTrigger>
              )}
              {showAudioTab && (
                <TabsTrigger value="audio">
                  <Music className="mr-2 h-4 w-4" />
                  Audio Only
                </TabsTrigger>
              )}
              {/* Add placeholders if needed for layout consistency when tabs are missing */}
              {!showCombinedTab && <div />}
              {!showVideoTab && <div />}
              {!showAudioTab && <div />}
            </TabsList>

            {showCombinedTab && (
              <TabsContent value="combined">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">
                      Available Combined Formats
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {sortedCombinedFormats.map(renderFormatItem)}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {showVideoTab && (
              <TabsContent value="video">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-6">
                    {/* Quality selection */}
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Select Video Quality
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {availableQualities.map((quality) => {
                            // Ensure quality has video-only formats before rendering badge
                            const hasVideoOnly =
                              memoizedGetFormatsForQuality(quality).video
                                .length > 0;
                            if (!hasVideoOnly) return null;
                            return (
                              <Badge
                                variant={
                                  selectedQuality === quality
                                    ? "default"
                                    : "outline"
                                }
                                key={quality}
                                className={`cursor-pointer px-3 py-1 ${
                                  selectedQuality === quality
                                    ? "border-primary"
                                    : ""
                                }`}
                                onClick={() =>
                                  handleManualQualitySelect(quality)
                                }
                              >
                                {quality}
                              </Badge>
                            );
                          })}
                          {availableQualities.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No specific video qualities found.
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        {/* Audio toggle button with tooltip */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Toggle
                              asChild
                                pressed={isAudioMuted}
                                onPressedChange={handleAudioToggle}
                                aria-label={
                                  isAudioMuted ? "Enable audio" : "Mute audio"
                                }
                                className="h-10 px-3 flex items-center gap-2"
                              >
                               <Button variant="outline">
                                 {isAudioMuted ? (
                                  <VolumeX className="h-5 w-5" />
                                ) : (
                                  <Volume2 className="h-5 w-5" />
                                )}
                                <span className="sr-only md:not-sr-only md:text-sm">
                                  {isAudioMuted ? "Enable Audio" : "Mute Audio"}
                                </span>
                               </Button>
                              </Toggle>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                {isAudioMuted ? "Enable audio" : "Mute audio"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>

                    {/* Format selection */}
                    {selectedQuality && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">
                          Select Video Format{" "}
                          {!isAudioMuted && "(Audio Added Separately)"}
                        </h3>
                        <div className="grid grid-cols-1 gap-2">
                          {getSortedVideosForQuality(selectedQuality).length >
                          0 ? (
                            getSortedVideosForQuality(selectedQuality).map(
                              renderFormatItem
                            )
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No video-only formats for {selectedQuality}.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Audio info (Show if a video format is selected and audio is not muted) */}
                    {selectedFormat &&
                      downloadType === "video" &&
                      !isAudioMuted && (
                        <div>
                          <h3 className="text-sm font-medium mb-2">
                            {getBestAudioForVideo()
                              ? "Audio Track (Auto-Selected Best Quality)"
                              : "Audio Track"}
                          </h3>
                          {getBestAudioForVideo() ? (
                            <div className="p-3 border rounded-md bg-muted/50">
                              {/* Reuse renderFormatItem logic partially */}
                              <div className="flex justify-between items-center mb-1">
                                <div>
                                  <Badge className="px-2 py-0.5">
                                    {formatFileSize(
                                      getBestAudioForVideo().filesize ||
                                        getBestAudioForVideo().filesize_approx
                                    )}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className="px-2 py-0.5"
                                  >
                                    {getBestAudioForVideo().abr} kbps
                                  </Badge>
                                </div>
                                <Badge variant="secondary">
                                  {getBestAudioForVideo().ext}
                                </Badge>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3">
                                <span>
                                  ID: {getBestAudioForVideo().format_id}
                                </span>
                                <span>
                                  {formatFileSize(
                                    getBestAudioForVideo().filesize ||
                                      getBestAudioForVideo().filesize_approx
                                  )}
                                </span>
                                {getBestAudioForVideo().acodec && (
                                  <span>
                                    A: {getBestAudioForVideo().acodec}
                                  </span>
                                )}
                                {getBestAudioForVideo().abr && (
                                  <span>{getBestAudioForVideo().abr} kbps</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-destructive p-3 border border-destructive/50 rounded-md">
                              Warning: No separate audio formats found. Download
                              might be silent if the selected video has no
                              embedded audio.
                            </p>
                          )}
                        </div>
                      )}

                    {/* Show message when audio is muted */}
                    {selectedFormat &&
                      downloadType === "video" &&
                      isAudioMuted && (
                        <div className="p-3 border rounded-md bg-muted/50">
                          <p className="text-sm text-muted-foreground">
                            Audio is muted. Video will be downloaded without
                            sound.
                          </p>
                        </div>
                      )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {showAudioTab && (
              <TabsContent value="audio">
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-5">
                    {" "}
                    {/* Increased spacing */}
                    {/* <h3 className="text-sm font-medium -mb-2">Available Audio Formats</h3> */}
                    {/* Render High Quality */}
                    {memoizedAudioFormatsByTier.high.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2">
                          High Quality
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {memoizedAudioFormatsByTier.high
                            .sort((a, b) => b.abr - a.abr)
                            .map((audio) => renderFormatItem(audio))}
                        </div>
                      </div>
                    )}
                    {/* Render Medium Quality */}
                    {memoizedAudioFormatsByTier.medium.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2">
                          Medium Quality
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {memoizedAudioFormatsByTier.medium
                            .sort((a, b) => b.abr - a.abr)
                            .map(renderFormatItem)}
                        </div>
                      </div>
                    )}
                    {/* Render Low Quality */}
                    {memoizedAudioFormatsByTier.low.length > 0 && (
                      <div>
                        <h4 className="text-xs uppercase text-muted-foreground font-semibold mb-2">
                          Low Quality
                        </h4>
                        <div className="grid grid-cols-1 gap-2">
                          {memoizedAudioFormatsByTier.low
                            .sort((a, b) => b.abr - a.abr)
                            .map(renderFormatItem)}
                        </div>
                      </div>
                    )}
                    {/* Fallback if structure failed but formats exist */}
                    {memoizedAudioFormatsByTier.high.length === 0 &&
                      memoizedAudioFormatsByTier.medium.length === 0 &&
                      memoizedAudioFormatsByTier.low.length === 0 &&
                      sortedAudioFormats.length > 0 && (
                        <div className="grid grid-cols-1 gap-2">
                          {sortedAudioFormats.map(renderFormatItem)}
                        </div>
                      )}
                  </div>
                </ScrollArea>
              </TabsContent>
            )}

            {!showCombinedTab && !showVideoTab && !showAudioTab && (
              <p className="text-sm text-muted-foreground p-4 text-center">
                No downloadable formats found.
              </p>
            )}
          </Tabs>
        </CardContent>
        <CardFooter>
          <div className="w-full">
            {(showCombinedTab || showVideoTab || showAudioTab) && (
              <Button
                onClick={handleDownload}
                className="w-full"
                disabled={
                  isDownloading ||
                  !selectedFormat ||
                  (downloadType === "video" && !selectedQuality)
                }
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Processing..." : "Download Selected"}
              </Button>
            )}
            {/* Format selection summary */}
            {selectedFormat &&
              findFormatById(selectedFormat) && ( // Ensure format exists before showing summary
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  {downloadType === "combined" && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant="outline">Combined</Badge>
                      <span>
                        {getFormatDisplayName(findFormatById(selectedFormat)!)}
                      </span>
                      <span>(ID: {selectedFormat})</span>
                    </div>
                  )}
                  {downloadType === "video" && selectedQuality && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant="outline">Video</Badge>
                      <span>
                        {selectedQuality} /{" "}
                        {findFormatById(selectedFormat)?.ext}
                      </span>
                      <span>(ID: {selectedFormat})</span>
                      {(() => {
                        const bestAudio = getBestAudioForVideo();
                        if (bestAudio) {
                          return (
                            <>
                              <Badge variant="outline" className="ml-2">
                                Audio
                              </Badge>
                              <span>
                                {bestAudio.abr}k / {bestAudio.ext}
                              </span>
                              <span>(ID: {bestAudio.format_id})</span>
                            </>
                          );
                        }
                        // Check if selected video format itself has audio
                        const videoFormat = findFormatById(selectedFormat);
                        if (!videoFormat || videoFormat.acodec === "none") {
                          return (
                            <span className="text-destructive ml-2">
                              (No Audio Track Found)
                            </span>
                          );
                        }
                        // If video has embedded audio but no separate track, don't show audio badge
                        return null;
                      })()}
                    </div>
                  )}
                  {downloadType === "audio" && (
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                      <Badge variant="outline">Audio</Badge>
                      <span>
                        {getFormatDisplayName(findFormatById(selectedFormat)!)}
                      </span>
                      <span>(ID: {selectedFormat})</span>
                    </div>
                  )}
                </div>
              )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
