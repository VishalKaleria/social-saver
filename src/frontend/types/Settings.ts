// types.ts
import type { MediaType, QualityOption } from "./FfmpegCore";
import { YtDlpServiceOptions } from "./YtDlpCore";

// --- Filename Variables (Unchanged) ---
export type FilenameVariable =
  | "title"
  | "id"
  | "uploader"
  | "channel"
  | "upload_date"
  | "timestamp"
  | "duration"
  | "view_count"
  | "like_count"
  | "resolution"
  | "ext"
  | "format_id"
  | "quality"
  | "type"
  | "artist"
  | "album"
  | "track";

// --- Filename Template (Unchanged) ---
export interface FilenameTemplate {
  enabled: boolean;
  template: string;
  sanitizeFilename: boolean;
  maxLength: number;
  dateFormat: string; // Consider removing if not used in generateFilename
  handleDuplicates: boolean; // Consider removing if not used in createOutputFilePath
}

// --- UI Settings (Unchanged) ---
export interface UiSettings {
  theme: "light" | "dark" | "system";
  autoStart: boolean;
  saveHistory: boolean;
  showNotifications: boolean;
  confirmBeforeDelete: boolean;
  maxHistoryItems: number;
}

// --- Site Settings (UPDATED) ---
export interface SiteSettings {
  autoCheckUpdates: boolean; // Check for yt-dlp updates?
  notifyOnUpdates: boolean; // Show notification if yt-dlp update available?
  checkFrequency: "hourly" | "daily" | "weekly" | "monthly" | "never";
  lastUpdateCheck: string | null; // Store as ISO string for JSON compatibility
  preferNightlyYtdlp: boolean; // NEW: Preference for yt-dlp channel
  autoUpdateYtdlp: boolean; // NEW: Automatically update yt-dlp if preferred channel has update
}

// --- FFmpeg Settings (Unchanged) ---
export interface FFmpegSettings {
  ffmpegPath?: string;
  defaultQuality: QualityOption;
  defaultVideoFormat: string;
  defaultAudioFormat: string;
  defaultImageFormat: string;
  maxConcurrentJobs: number;
  cooldownTimeBetweenJobs: number; // seconds
  maxCompletedJobsToKeep: number;
  autoCleanupCompletedJobs: boolean;
  autoCleanupTimeMs: number; // ms
}

// --- YtDlp Options (Imported, Unchanged Structurally) ---
export type { YtDlpServiceOptions };

// --- Media Type & Quality (Imported, Unchanged Structurally) ---
export type { MediaType, QualityOption };


// --- Global Settings (UPDATED with SiteSettings) ---
export interface GlobalSettings {
  downloadPaths: {
    video: string;
    audio: string;
    image: string;
    combined: string; // Often same as video
    playlist: string; // Often a subdirectory within video/audio
  };
  ffmpeg: FFmpegSettings;
  filenameTemplate: FilenameTemplate;
  ui: UiSettings;
  ytdlp: YtDlpServiceOptions;
  site: SiteSettings; // Changed from optional to required
}

// --- Default Filename Template (Unchanged) ---
export const DEFAULT_FILENAME_TEMPLATE: FilenameTemplate = {
  enabled: true,
  template: "${resolution} ${title} [${id}]",
  sanitizeFilename: true,
  maxLength: 250,
  dateFormat: "YYYY-MM-DD", // Kept for potential future use
  handleDuplicates: true,   // Kept for potential future use
};