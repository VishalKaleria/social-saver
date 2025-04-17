import { app } from "electron";
import * as path from "path";
import * as fs from "fs";
import {
  FilenameTemplate,
  GlobalSettings,
  YtDlpServiceOptions,
  YtDlpAudioVideoMetadata,
  DEFAULT_FILENAME_TEMPLATE,
  MediaType,
  QualityOption,
  DeepPartial,
} from "@/types";
import { appConfig } from "@/lib/app-config";
import binaryManager from "@electron/core/binary-manager";

export class GlobalSettingsService {
  private static instance: GlobalSettingsService;
  private settingsPath: string;
  private settings: GlobalSettings;

  private readonly DEFAULT_SETTINGS: GlobalSettings = {
    downloadPaths: {
      video: path.join(
        app.getPath("downloads"),
        appConfig.name.replace(" ", "_"),
        "Videos"
      ),
      audio: path.join(
        app.getPath("downloads"),
        appConfig.name.replace(" ", "_"),
        "Audio"
      ),
      image: path.join(
        app.getPath("downloads"),
        appConfig.name.replace(" ", "_"),
        "Images"
      ),
      combined: path.join(
        app.getPath("downloads"),
        appConfig.name.replace(" ", "_"),
        "Videos"
      ),
      playlist: path.join(
        app.getPath("downloads"),
        appConfig.name.replace(" ", "_"),
        "Playlists"
      ),
    },
    ffmpeg: {
      ffmpegPath: binaryManager.getFFmpegPath(),
      defaultQuality: "original", // original quality provides best performance
      defaultVideoFormat: "mp4",
      defaultAudioFormat: "mp3",
      defaultImageFormat: "jpg",
      maxConcurrentJobs: 5,
      cooldownTimeBetweenJobs: 1, // seconds
      maxCompletedJobsToKeep: 1000,
      autoCleanupCompletedJobs: true,
      autoCleanupTimeMs: 24 * 60 * 60 * 1000, // 24 hours
    },
    filenameTemplate: DEFAULT_FILENAME_TEMPLATE,
    ui: {
      theme: "system",
      autoStart: true,
      saveHistory: true,
      showNotifications: true,
      confirmBeforeDelete: true,
      maxHistoryItems: 1000,
    },
    ytdlp: {
      ytdlpPath: binaryManager.getYtDlpPath(),
      maxRetries: 3,
      timeout: 60000, // 60 seconds
      verbose: false,
      proxy: "",
      cookies: "",
      userAgent: "",
      referer: "",
      skipUnavailableFragments: true,
      maxBuffer: 1024 * 1024 * 1024, // 1024MB buffer
    },
    site: {
      autoCheckUpdates: true,
      notifyOnUpdates: true,
      checkFrequency: "hourly" as const,
      lastUpdateCheck: null,
      autoUpdateYtdlp: true,
      preferNightlyYtdlp: false,
    },
  };

  private constructor() {
    this.settingsPath = path.join(app.getPath("userData"), "settings.json");
    this.settings = this.loadSettings();

    // Ensure download directories exist
    this.ensureDownloadDirectories();
  }

  public static getInstance(): GlobalSettingsService {
    if (!GlobalSettingsService.instance) {
      GlobalSettingsService.instance = new GlobalSettingsService();
    }
    return GlobalSettingsService.instance;
  }

  private loadSettings(): GlobalSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, "utf8");
        const loadedSettings = JSON.parse(data);

        // Merge with default settings to ensure all properties exist
        return this.mergeWithDefaults(loadedSettings);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }

    // If loading fails or file doesn't exist, return default settings
    return { ...this.DEFAULT_SETTINGS };
  }

  private mergeWithDefaults(
    loadedSettings: DeepPartial<GlobalSettings>
  ): GlobalSettings {
    const mergedSettings = { ...this.DEFAULT_SETTINGS };

    // Merge top-level properties
    for (const key in loadedSettings) {
      if (key in this.DEFAULT_SETTINGS) {
        const typedKey = key as keyof GlobalSettings;

        // Special handling for nested objects
        if (
          typedKey === "downloadPaths" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.downloadPaths = {
            ...mergedSettings.downloadPaths,
            ...(loadedSettings.downloadPaths as any),
          };
        } else if (
          typedKey === "ffmpeg" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.ffmpeg = {
            ...mergedSettings.ffmpeg,
            ...(loadedSettings.ffmpeg as any),
          };
        } else if (
          typedKey === "filenameTemplate" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.filenameTemplate = {
            ...mergedSettings.filenameTemplate,
            ...(loadedSettings.filenameTemplate as any),
          };
        } else if (
          typedKey === "ui" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.ui = {
            ...mergedSettings.ui,
            ...(loadedSettings.ui as any),
          };
        } else if (
          typedKey === "ytdlp" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.ytdlp = {
            ...mergedSettings.ytdlp,
            ...(loadedSettings.ytdlp as any),
          };
        } else if (
          typedKey === "site" &&
          typeof loadedSettings[typedKey] === "object"
        ) {
          mergedSettings.site = {
            ...mergedSettings.site,
            ...(loadedSettings.site as any),
          };
        } else {
          // For non-nested properties, just override
          (mergedSettings[typedKey] as any) = loadedSettings[typedKey];
        }
      }
    }
    return mergedSettings;
  }

  private saveSettings(): void {
    try {
      const dirPath = path.dirname(this.settingsPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Create a backup of the current settings file if it exists
      if (fs.existsSync(this.settingsPath)) {
        const backupPath = `${this.settingsPath}.backup`;
        fs.copyFileSync(this.settingsPath, backupPath);
      }

      // Write the new settings
      const settingsJson = JSON.stringify(this.settings, null, 2);
      fs.writeFileSync(this.settingsPath, settingsJson, "utf8");

      console.log(`Settings saved to ${this.settingsPath}`);
    } catch (error) {
      console.error("Error saving settings:", error);
      throw new Error(
        `Failed to save settings: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private ensureDownloadDirectories(): void {
    for (const type in this.settings.downloadPaths) {
      const dirPath = (this.settings.downloadPaths as any)[type];
      if (dirPath && typeof dirPath === "string") {
        try {
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
        } catch (error) {
          console.error(`Error creating directory ${dirPath}:`, error);
        }
      }
    }
  }

  public getSettings(): GlobalSettings {
    return { ...this.settings };
  }

  public updateSettings(
    newSettings: DeepPartial<GlobalSettings>
  ): GlobalSettings {
    console.log(
      "Updating settings with:",
      JSON.stringify(newSettings, null, 2)
    );

    // Create a deep copy of current settings
    const currentSettings = JSON.parse(JSON.stringify(this.settings));

    // Handle nested objects properly
    if (newSettings.downloadPaths) {
      currentSettings.downloadPaths = {
        ...currentSettings.downloadPaths,
        ...newSettings.downloadPaths,
      };
    }

    if (newSettings.ffmpeg) {
      currentSettings.ffmpeg = {
        ...currentSettings.ffmpeg,
        ...newSettings.ffmpeg,
      };
    }

    if (newSettings.filenameTemplate) {
      currentSettings.filenameTemplate = {
        ...currentSettings.filenameTemplate,
        ...newSettings.filenameTemplate,
      };
    }

    if (newSettings.ui) {
      currentSettings.ui = {
        ...currentSettings.ui,
        ...newSettings.ui,
      };
    }

    if (newSettings.ytdlp) {
      currentSettings.ytdlp = {
        ...currentSettings.ytdlp,
        ...newSettings.ytdlp,
      };
    }

    if (newSettings.site) {
      currentSettings.site = {
        ...currentSettings.site,
        ...newSettings.site,
      };
    }

    // Update the settings
    this.settings = currentSettings;

    // Save to disk
    this.saveSettings();

    // Ensure directories exist
    this.ensureDownloadDirectories();

    console.log(
      "Settings updated and saved:",
      JSON.stringify(this.settings, null, 2)
    );

    return { ...this.settings };
  }

  public getDownloadPath(type: MediaType): string {
    switch (type) {
      case "video":
      case "combined":
        return this.settings.downloadPaths.video;
      case "audio":
        return this.settings.downloadPaths.audio;
      case "image":
        return this.settings.downloadPaths.image;
      default:
        return this.settings.downloadPaths.video;
    }
  }

  public getDefaultQuality(): QualityOption {
    return this.settings.ffmpeg.defaultQuality;
  }

  public getDefaultFormat(type: MediaType): string {
    switch (type) {
      case "video":
      case "combined":
        return this.settings.ffmpeg.defaultVideoFormat;
      case "audio":
        return this.settings.ffmpeg.defaultAudioFormat;
      case "image":
        return this.settings.ffmpeg.defaultImageFormat;
      default:
        return this.settings.ffmpeg.defaultVideoFormat;
    }
  }

  public getMaxConcurrentJobs(): number {
    return this.settings.ffmpeg.maxConcurrentJobs;
  }

  public getCooldownTime(): number {
    return this.settings.ffmpeg.cooldownTimeBetweenJobs;
  }

  public getMaxCompletedJobsToKeep(): number {
    return this.settings.ffmpeg.maxCompletedJobsToKeep;
  }

  public shouldAutoCleanupCompletedJobs(): boolean {
    return this.settings.ffmpeg.autoCleanupCompletedJobs;
  }

  public getAutoCleanupTimeMs(): number {
    return this.settings.ffmpeg.autoCleanupTimeMs;
  }

  public getFilenameTemplate(): FilenameTemplate {
    return { ...this.settings.filenameTemplate };
  }

  public getUiSettings(): GlobalSettings["ui"] {
    return { ...this.settings.ui };
  }

  public getYtDlpSettings(): YtDlpServiceOptions {
    return { ...this.settings.ytdlp };
  }

  public getSiteSettings() {
    return { ...this.settings.site };
  }

  public resetToDefaults(): GlobalSettings {
    this.settings = { ...this.DEFAULT_SETTINGS };
    this.saveSettings();
    this.ensureDownloadDirectories();
    app.relaunch()
    app.exit(0)
    return { ...this.settings };
  }

  /**
   * Format a date string
   */
  private formatDate(dateStr?: string): string {
    if (!dateStr) return "";

    try {
      // YouTube-DL date format is YYYYMMDD
      if (dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}-${month}-${day}`;
      }
      return dateStr;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  }

  /**
   * Generate a filename based on the template and video/audio metadata
   */
  public generateFilename({
    metadata,
    type,
    formatId,
    quality,
  }: {
    metadata: Partial<YtDlpAudioVideoMetadata>;
    type: MediaType;
    formatId?: string;
    quality?: QualityOption;
  }): string {
    const template = this.settings.filenameTemplate;
    if (!template.enabled) {
      // If template is disabled, just return the title
      return this.sanitizeFilename({
        filename: metadata.title || `download_${Date.now()}`,
        sanitize: template.sanitizeFilename,
      });
    }

    // Find the selected format if formatId is provided
    let selectedFormat = undefined;
    if (formatId && metadata.formats?.allUniqueFormats) {
      selectedFormat = metadata.formats?.allUniqueFormats.find(
        (f) => f.format_id === formatId
      );
    }

    // Get resolution or audio quality information
    let qualityInfo = "";
    if (type === "video" || type === "combined" || type === "muteVideo") {
      qualityInfo = selectedFormat?.height ? `${selectedFormat.height}p` : "";
    } else if (type === "audio") {
      // For audio, use bitrate if available, otherwise use audio quality descriptor
      if (selectedFormat?.tbr) {
        qualityInfo = `${Math.round(selectedFormat.tbr)}k`;
      } else if (selectedFormat?.abr) {
        qualityInfo = `${Math.round(selectedFormat.abr)}k`;
      } else {
        switch (quality) {
          case "high":
            qualityInfo = "HQ";
            break;
          case "medium":
            qualityInfo = "SQ"; // Standard Quality
            break;
          case "low":
            qualityInfo = "LQ";
            break;
          default:
            qualityInfo = "";
        }
      }
    }

    // Create a variables map for replacement
    const variables: Record<string, string> = {
      title: metadata.title || "Untitled",
      id: metadata.id || "",
      uploader:
        metadata.__dataType === "video"
          ? metadata.uploader || metadata.channel
          : metadata.__dataType === "audio"
          ? metadata.artist ||
            metadata.composer ||
            metadata.album_artist ||
            metadata.album
          : "",
      channel:
        metadata.__dataType === "video"
          ? metadata.channel || metadata.uploader
          : metadata.__dataType === "audio"
          ? metadata.extractor || ""
          : "",
      upload_date: this.formatDate(metadata.upload_date) || "",
      timestamp: String(Date.now() || ""),
      duration: String(metadata.duration || ""),
      view_count: String(metadata.view_count || ""),
      like_count: String(metadata.like_count || ""),
      resolution: qualityInfo, // Using the combined quality info for both video and audio
      ext: this.getDefaultFormat(type),
      format_id: formatId || "",
      quality: quality || this.settings.ffmpeg.defaultQuality,
      type: type,
      // Add audio-specific variables
      artist: metadata.__dataType === "audio" ? metadata.artist || "" : "",
      album: metadata.__dataType === "audio" ? metadata.album || "" : "",
      track: metadata.__dataType === "audio" ? metadata.track || "" : "",
    };

    // Replace variables in template
    let filename = template.template;
    for (const [key, value] of Object.entries(variables)) {
      filename = filename.replace(
        new RegExp(`\\$\\{${key}\\}`, "g"),
        value || ""
      );
    }

    // Clean up any remaining template variables that weren't replaced
    filename = filename.replace(/\$\{[a-zA-Z0-9_]+\}/g, "");

    // Remove any duplicate spaces or dots that might have been created during replacements
    filename = filename.replace(/\s+/g, " ").replace(/\.+/g, ".").trim();

    // Sanitize filename if needed
    if (template.sanitizeFilename) {
      filename = this.sanitizeFilename({
        filename,
        sanitize: true,
      });
    }

    // If filename is empty after all processing, use a default
    if (!filename || filename.trim() === "") {
      filename = `download_${Date.now()}`;
    }

    console.log("generate filename", filename);
    return filename;
  }

  /**
   * Sanitize a filename to ensure it's valid for the file system
   */
  private sanitizeFilename({
    filename,
    sanitize,
  }: {
    filename: string;
    sanitize: boolean;
  }): string {
    console.log("Sanitizing filename:", { filename, sanitize });

    if (!sanitize) return filename || `download_${Date.now()}`;
    if (!filename) return `download_${Date.now()}`;

    // Define Windows reserved filenames
    const reservedNames = [
      "CON",
      "PRN",
      "AUX",
      "NUL",
      "COM1",
      "COM2",
      "COM3",
      "COM4",
      "COM5",
      "COM6",
      "COM7",
      "COM8",
      "COM9",
      "LPT1",
      "LPT2",
      "LPT3",
      "LPT4",
      "LPT5",
      "LPT6",
      "LPT7",
      "LPT8",
      "LPT9",
    ];

    // Step 1: Replace strictly invalid filesystem characters
    let sanitized = filename
      .replace(/[\/\\:*?"<>|]/g, "_") // Replace invalid Windows filename characters
      .replace(/\.\./g, "_") // Replace consecutive dots
      .replace(/\.$/, "_") // Replace trailing periods (Windows issue)
      .trim();

    // Step 2: Check for reserved Windows filenames
    const baseName = path
      .basename(sanitized, path.extname(sanitized))
      .toUpperCase();
    if (reservedNames.includes(baseName)) {
      sanitized = `_${sanitized}`;
    }

    // Step 3: Ensure the filename isn't empty after sanitization
    if (!sanitized || sanitized.trim() === "") {
      sanitized = `download_${Date.now()}`;
    }

    console.log("After sanitization:", sanitized);
    return sanitized;
  }

  /**
   * Create a sanitized output file path based on settings
   */
  public async createOutputFilePath({
    customOutput,
    filename,
    type,
    format,
    metadata,
    formatId,
    quality,
  }: {
    customOutput?: string;
    filename: string;
    type: MediaType;
    format?: string;
    metadata?: Partial<YtDlpAudioVideoMetadata>;
    formatId?: string;
    quality?: string;
  }): Promise<string> {
    // Get the appropriate download path from settings
    const basePath = customOutput || this.getDownloadPath(type);

    // Get default format from settings if not provided
    let fileFormat = format || this.getDefaultFormat(type);

    // Ensure fileFormat starts with a dot
    if (fileFormat && !fileFormat.startsWith(".")) {
      fileFormat = "." + fileFormat;
    }

    // Generate filename based on template if metadata is provided
    let fileName = "";
    if (metadata && this.getFilenameTemplate().enabled) {
      fileName = this.generateFilename({
        metadata,
        type,
        formatId,
        quality: quality as any,
      });
    } else if (filename && filename.trim() !== "") {
      // Use provided filename if available
      fileName = this.sanitizeFilename({
        filename,
        sanitize: true,
      });
    } else {
      // Generate a default filename if nothing is provided
      fileName = `download_${Date.now()}`;
    }

    // Add extension if it's not already there
    if (!fileName.toLowerCase().endsWith(fileFormat.toLowerCase())) {
      fileName = fileName + fileFormat;
    }

    // Apply filename template max length if enabled
    const template = this.getFilenameTemplate();
    if (template.enabled && template.maxLength > 0) {
      const ext = "." + path.extname(fileName);
      const base = path.basename(fileName, ext);

      // Only truncate if the base name exceeds max length
      if (base.length > template.maxLength) {
        fileName = base.substring(0, template.maxLength) + ext;
      }
    }

    // Create full path
    let fullPath = path.join(basePath, fileName);
    console.log("Full path (initial):", fullPath);

    // Check for path length restrictions (Windows MAX_PATH is 260 chars)
    if (fullPath.length >= 250) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      const availableLength = 240 - basePath.length - ext.length;
      const truncatedBase = base.substring(0, Math.max(availableLength, 1));
      fileName = truncatedBase + ext;
      fullPath = path.join(basePath, fileName);
      console.log("Path was too long, truncated to:", fullPath);
    }

    // Ensure directory exists
    const dirPath = path.dirname(fullPath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // // Check for file existence and create a unique name if needed
    // if (fs.existsSync(fullPath)) {
    //   const ext = path.extname(fileName);
    //   const base = path.basename(fileName, ext);
    //   let counter = 1;
    //   let newPath = fullPath;

    //   while (fs.existsSync(newPath)) {
    //     const newFileName = `${base} (${counter})${ext}`;
    //     newPath = path.join(basePath, newFileName);
    //     counter++;
    //   }

    //   console.log("Output path conflict detected. Updated from", fullPath, "to", newPath);
    //   fullPath = newPath;
    // }

    return fullPath;
  }
}

export default GlobalSettingsService.getInstance();
