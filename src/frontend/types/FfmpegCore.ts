import type {YtDlpAudioMetadata, YtDlpAudioVideoMetadata, YtDlpVideoMetadata } from "@/types"

export type MediaType = "combined" | "video" | "audio" | "image" | "muteVideo" | "playlist"
export type JobStatus = "waiting" | "extracting" | "idle" | "queued" | "processing"| "downloading" | "completed" | "error" | "cancelled"
export type QualityOption = "high" | "medium" | "low" | "original" // quality options that are used in postprocessors defined by settings

export type DownloadType = MediaType

export type DownloadMethod = "byFilter" | "byId"  | "byURL";

export type VideoQualityFilter = number | "max" | "highest"; // e.g., 1440, 1080, 720, 'max'
export type AudioQualityFilter = "high" | "medium" | "low";

export interface DownloadFilter {
  videoMaxQuality?: VideoQualityFilter; // Used for type 'video' and 'combined'
  audioQuality?: AudioQualityFilter;    // Used for type 'audio', potentially as fallback for 'video'
}

// Base options applicable to both single and playlist downloads
interface BaseDownloadConfig {
  type: DownloadType;
  method: DownloadMethod;
  filter?: DownloadFilter;
  formatId?: string;       // For combined/audio byId
  videoFormatId?: string;  // For video byId
  audioFormatId?: string;  // For video byId
  outputPath?: string;
  // Additional properties for image downloads
  url?: string;            // Direct URL for image downloads
  title?: string;          // Title for the download
  scale?: number;          // Scale factor for image resizing
  customOptions?: string[]; // Custom FFmpeg options
}

// Options for downloading a single media item
export interface SingleDownloadConfig extends BaseDownloadConfig {
  data: YtDlpAudioVideoMetadata; // Must be single video/audio metadata
}

// Updated interface for BaseDownloadConfig
interface BaseDownloadConfig {
  type: DownloadType;
  method: DownloadMethod;
  filter?: DownloadFilter;
  formatId?: string;       // For combined/audio byId
  videoFormatId?: string;  // For video byId
  audioFormatId?: string;  // For video byId
  outputPath?: string;
  // Additional properties for image downloads
  url?: string;            // Direct URL for image downloads
  title?: string;          // Title for the download
  scale?: number;          // Scale factor for image resizing
  customOptions?: string[]; // Custom FFmpeg options
}



// Interface specifically for image URL downloads
export interface ImageUrlDownloadConfig extends BaseDownloadConfig {
  type: "image";
  method: "byURL";
  url: string;
  data?: YtDlpAudioVideoMetadata; // Image URL downloads don't need metadata
}

export type DownloadConfig = SingleDownloadConfig;

// Define return types for clarity
export interface JobSubmissionResult {
  success: boolean;
  jobId?: string;
  error?: string;
  title?: string; // Add title for context in results
  skipped?: boolean; // Flag if skipped (e.g., format not found)
}

export interface PlaylistDownloadResult {
  overallSuccess: boolean; // True if at least one item started successfully
  results: JobSubmissionResult[]; // Results for each item processed
}
export interface FFmpegDownloadOptions {
  type: MediaType
  url?: string | { audio: string; video: string }
  platformUrl: string
  title?: string
  outputPath?: string
  filename?: string
  format?: string
  quality?: QualityOption
  scale?: number
  size: number
  customOptions?: string[]
  metadata?: YtDlpAudioMetadata | YtDlpVideoMetadata // Added for filename generation
  formatId?: string // Added for filename generation
}

export interface ProgressData {
  frames?: number
  fps?: number
  time?: string
  timemark?: string
  percent?: number
  size?: number
  bitrate?: string
  currentKbps?: number
  speed?: number // Ensure it's always a number
  timeElapsed?: number
  outputPath?: string
  url?: string
  eta?: string
}

export interface JobInfo {
  jobId: string
  type: MediaType
  title?: string
  platformUrl?: string
  percent: number
  startTime?: number
  fileSize?: number
  endTime?: number
  timeElapsed?: number
  outputPath?: string
  eta?: string // Remains optional
  status: JobStatus
  size?: number // Optional, since it's missing in some queued jobs
  bitrate?: string
  speed?: number
  fps?: any
  frames?: any
  duration?: number
  queuePosition?: number
  options?: FFmpegDownloadOptions
  thumbnail?: string
  error?: string
}

export interface ProgressResponse {
  jobId: string
  title: string
  platformUrl?: string
  percent: number
  eta?: string
  timeElapsed: number
  speed?: number
  bitrate?: string
  size?: number
  outputPath: string
  frames?: number
  fps?: number
  time?: string
}

export interface JobResponse {
  success: boolean
  jobId: string
  title?: string
  platformUrl?: string | { audio: string; video: string }
  outputPath?: string
  filename?: string
  message?: string
  type: MediaType
  started: number
  options?: FFmpegDownloadOptions
}

export interface ErrorResponse {
  jobId: string
  success: false
  error: string
  timeElapsed: number
}

export interface CompletionResponse {
  jobId: string
  success: true
  outputPath: string
  timeElapsed: number
  size?: number
  bitrate?: string
  averageSpeed?: number
}

