import { exec } from "child_process";
import { promisify } from "util";
import {
  YtDlpFormat,
  YtDlpResponse,
  YtDlpServiceOptions,
  YtDlpCommandOptions,
  YtDlpMediaMetadata,
} from "@/types";
import { fileURLToPath } from "url";
import path from "path";
import settingsService from "./settings-service";

const execAsync = promisify(exec);
const DEFAULT_ARGS = ["--skip-download", "--dump-json", "--no-playlist"];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Utility to convert camelCase to kebab-case for CLI arguments
 */
export const camelToKebab = (str: string): string => {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
};

/**
 * Core service class for yt-dlp operations with standardized response format
 */
export class YtDlpService {
  private readonly options: YtDlpServiceOptions;
  private readonly formatHandler: YtDlpFormatHandler;
  private readonly DEFAULT_OPTIONS: YtDlpServiceOptions =
    settingsService.getYtDlpSettings();

  // Flag options that only accept positive values (no --no-option format)
  private readonly POSITIVE_FLAG_ONLY_OPTIONS = new Set([
    "version",
    "help",
    "quiet",
    "extractAudio",
    "listFormats",
    "dumpJson",
    "dumpSingleJson",
    "getUrl",
    "getTitle",
    "getId",
    "verbose",
    "simulate",
    "print",
  ]);

  // Special case argument mappings
  private readonly SPECIAL_ARG_MAPPINGS: Record<
    string,
    { flag: string; isShortFlag?: boolean }
  > = {
    subtitlesLanguages: { flag: "sub-langs" },
    username: { flag: "u", isShortFlag: true },
    password: { flag: "p", isShortFlag: true },
    twoFactor: { flag: "2", isShortFlag: true },
    listFormats: { flag: "F", isShortFlag: true },
    extractAudio: { flag: "x", isShortFlag: true },
    format: { flag: "f", isShortFlag: true },
    output: { flag: "o", isShortFlag: true },
    noOverwrites: { flag: "w", isShortFlag: true },
    continue: { flag: "c", isShortFlag: true },
    getUrl: { flag: "g", isShortFlag: true },
  };

  constructor(
    options: YtDlpServiceOptions = settingsService.getYtDlpSettings()
  ) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
    this.formatHandler = new YtDlpFormatHandler();
  }

  /**
   * Execute a raw yt-dlp command with the given arguments
   * @param args Command line arguments to pass to yt-dlp
   * @returns Standardized response with execution result
   */
  async executeCommand(
    args: string[]
  ): Promise<YtDlpResponse<{ stdout: string; stderr: string }>> {
    try {
      const command = `${this.options.ytdlpPath} ${args
        .map((arg) => this.escapeArg(arg))
        .join(" ")}`;

      if (this.options.verbose) {
        console.log(`Executing: ${command}`);
      }

      const { stdout, stderr } = await execAsync(command, {
        timeout: this.options.timeout,
        maxBuffer: this.options.maxBuffer,
      });

      if (stderr && !stdout && this.options.verbose) {
        console.error(`stderr: ${stderr}`);
      }

      return {
        success: true,
        message: "Command executed successfully",
        data: { stdout, stderr },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `yt-dlp execution failed: ${error.message}`,
        error: {
          message: error.message || "Unknown error during command execution",
          stderr: error.stderr || "",
          code: error.code,
        },
      };
    }
  }

  /**
   * Get metadata for a video or playlist URL in JSON format.
   * Processes formats using the updated YtDlpFormatHandler and determines the correct __dataType.
   * @param url The video or playlist URL
   * @param cmdOptions Additional command options
   * @returns Standardized response with video metadata and content type detection
   */
  async getJson<T = YtDlpMediaMetadata>(url: string, cmdOptions: YtDlpCommandOptions = {}): Promise<YtDlpResponse<T>> {
    try {
      // 1. Build arguments for yt-dlp
      const args = this.buildBaseArgs(); // Get base args like proxy, cookies, etc.
      this.applyCommandOptions(args, cmdOptions); // Add specific command options
      args.push(url); // Add the target URL

      // 2. Execute the yt-dlp command
      const result = await this.executeCommand(args);

      // Handle execution failure
      if (!result.success) {
        // Type assertion is okay here as we expect T or an error structure
        return result as YtDlpResponse<T>;
      }

      // 3. Process the yt-dlp output (stdout)
      try {
        const stdout = result.data?.stdout || '';
        const jsonString = stdout.trim();

        // Handle potentially multiple JSON objects separated by newlines
        const jsonStrings = jsonString.split("\n").filter(line => line.trim());

        // Handle case where yt-dlp returned no JSON output
        if (jsonStrings.length === 0) {
          return {
            success: false,
            message: 'No JSON data returned from yt-dlp',
            error: {
              message: 'Empty JSON response from yt-dlp execution.',
              stderr: result.data?.stderr || ''
            }
          };
        }

        // 4. Parse the JSON string(s)
        const jsonObjects = jsonStrings.map(line => JSON.parse(line));
        // Use the first object if single, or the array if multiple (usually for playlists)
        let parsedData = jsonObjects.length === 1 ? jsonObjects[0] : jsonObjects;

        // 5. Determine if the result is a playlist or a single media item
        const isPlaylist = Array.isArray(parsedData) ||
                           (parsedData?.entries && Array.isArray(parsedData.entries)) ||
                           (parsedData?.playlist && parsedData?.playlist_count); // Common playlist indicators

        let finalData: any; // To hold the final structured data

        // 6. Handle Playlist Data
        if (isPlaylist) {
          // Extract entries correctly whether the top level is an array or object
          const entries = Array.isArray(parsedData) ? parsedData : (parsedData.entries || []);
          finalData = {
            // Spread existing playlist metadata if parsedData was an object
            ...(Array.isArray(parsedData) ? {} : parsedData),
            entries, // Ensure entries array is present
            __dataType: "playlist" // Set the data type
          };
        }
        // 7. Handle Single Media Item Data (Video or Audio)
        else {
          // Check if the raw parsed data has a 'formats' array
          if (parsedData.formats && Array.isArray(parsedData.formats)) {
            // *** Process formats using the updated YtDlpFormatHandler ***
            const formatsResult = this.formatHandler.processFormats(parsedData.formats);

            // Check if format processing was successful
            if (formatsResult.success) {
              // *** Replace the original raw formats array with the structured data object ***
              // This object contains bestFormats, formatsByQuality, details, etc.
              parsedData.formats = formatsResult.data;

              // *** Determine __dataType based on the PROCESSED format details ***
              const formatData = formatsResult.data; // The structured format data
              const details = formatData.formatDetails; // Summary details from the handler

              // Check if there's any video content detected
              // This includes *either* dedicated video streams OR combined streams
              const hasAnyVideoContent = (details.videoFormats && details.videoFormats.count > 0) ||
                                         (details.combinedFormats && details.combinedFormats.count > 0);

              if (hasAnyVideoContent) {
                // If any video or combined format exists, classify as video
                parsedData.__dataType = "video";
              } else if (details.audioFormats && details.audioFormats.count > 0) {
                // If only audio formats exist, classify as audio
                parsedData.__dataType = "audio";
              } else {
                // If no processable video, combined, or audio formats were found after filtering/processing
                parsedData.__dataType = "empty";
              }
            } else {
              // Format processing itself failed
              console.warn("yt-dlp format processing failed:", formatsResult.message, formatsResult.error);
              // Assign an empty structure to the formats field to prevent downstream errors
              parsedData.formats = this.formatHandler.getEmptyFormatsDataStructure(parsedData.formats.length);
              // Set a specific dataType to indicate the issue
              parsedData.__dataType = "unknown_formats_error";
            }
          } else {
            // The original yt-dlp JSON did *not* contain a 'formats' array
            console.warn("yt-dlp JSON response missing 'formats' array for URL:", url);
            // Assign an empty structure for consistency in the output object
            parsedData.formats = this.formatHandler.getEmptyFormatsDataStructure();
            // Set dataType to indicate this specific scenario
            parsedData.__dataType = "no_formats_in_response";
          }

          // Create the final data object for the single media item
          // This ensures we're using the potentially modified parsedData (with processed formats and __dataType)
          finalData = { ...parsedData };
        }

        // 8. Return the successful response with the structured data
        return {
          success: true,
          message: 'Data retrieved and processed successfully',
          data: finalData as T // Assert the type T for the final data
        };

      } catch (error: any) {
        // Handle errors during JSON parsing or format processing
        console.error(`Error parsing yt-dlp JSON output for URL ${url}:`, error);
        return {
          success: false,
          message: 'Failed to parse JSON response from yt-dlp',
          error: {
            message: error.message || 'JSON parsing error',
            stderr: result.data?.stderr || String(error) // Include stderr if available
          }
        };
      }
    } catch (error: any) {
      // Handle errors during the initial command execution
      console.error(`Failed to execute yt-dlp command for URL ${url}:`, error);
      return {
        success: false,
        message: 'Failed to get JSON data due to yt-dlp execution error',
        error: {
          message: error.message || 'Unknown error retrieving JSON data',
          stderr: error.stderr || String(error), // Include stderr from execution error
          code: error.code
        }
      };
    }
  } // End of getJson method



  /**
   * Get direct URLs for specific format IDs
   * @param url The video URL
   * @param formatIds Format IDs to get URLs for
   * @param cmdOptions Additional command options
   * @returns Standardized response with direct URLs
   */
  async getDirectUrls(
    url: string,
    formatIds: string[],
    cmdOptions: YtDlpCommandOptions = {}
  ): Promise<
    YtDlpResponse<{
      urls: Record<string, string>;
    }>
  > {
    try {
      const results: Record<string, string> = {};

      for (const formatId of formatIds) {
        const args = this.buildBaseArgs();
        args.push("--get-url");
        args.push("--format", formatId);

        this.applyCommandOptions(args, cmdOptions);
        args.push(url);

        const result = await this.executeCommand(args);

        if (!result.success) {
          return {
            success: false,
            message: `Failed to get URL for format ${formatId}`,
            error: result.error,
          };
        }

        results[formatId] = result.data?.stdout.trim() || "";
      }

      return {
        success: true,
        message: "Direct URLs retrieved successfully",
        data: { urls: results },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to get direct URLs",
        error: {
          message: error.message || "Unknown error retrieving direct URLs",
          stderr: String(error),
        },
      };
    }
  }

  /**
   * Check if yt-dlp is installed and get version
   * @returns Standardized response with yt-dlp version
   */
  async getVersion(): Promise<YtDlpResponse<string>> {
    try {
      const args = ["--version"];
      const result = await this.executeCommand(args);

      return {
        success: true,
        message: "yt-dlp version retrieved successfully",
        data: result.data?.stdout.trim() || "",
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to get yt-dlp version",
        error: {
          message: error.message || "Unknown error retrieving yt-dlp version",
          stderr: String(error),
        },
      };
    }
  }

  /**
   * Process formats separately using the format handler
   * @param formats Formats array from yt-dlp response
   * @returns Standardized response with processed formats
   */
  processFormats(formats: YtDlpFormat[]): YtDlpResponse<any> {
    return this.formatHandler.processFormats(formats);
  }

  /**
   * Build base arguments for yt-dlp commands
   * @returns Array of base arguments
   */
  private buildBaseArgs(): string[] {
    const args: string[] = [];
    args.push(...DEFAULT_ARGS);

    if (this.options.proxy) {
      args.push("--proxy", this.options.proxy);
    }

    if (this.options.cookies) {
      args.push("--cookies", this.options.cookies);
    }

    if (this.options.userAgent) {
      args.push("--user-agent", this.options.userAgent);
    }

    if (this.options.referer) {
      args.push("--referer", this.options.referer);
    }

    args.push("--retries", String(this.options.maxRetries));
    args.push(
      "--socket-timeout",
      String(Math.floor(this.options.timeout / 1000))
    );

    if (this.options.skipUnavailableFragments) {
      args.push("--skip-unavailable-fragments");
    }

    return args;
  }

  /**
   * Apply command options to args array with improved mapping
   * @param args The arguments array to modify
   * @param options Command options to apply
   */
  private applyCommandOptions(
    args: string[],
    options: YtDlpCommandOptions
  ): void {
    for (const [key, value] of Object.entries(options)) {
      // Skip undefined or null values
      if (value === undefined || value === null) {
        continue;
      }

      // Handle date range specially
      if (key === "dateRange" && typeof value === "string") {
        const [dateAfter, dateBefore] = value.split(":");
        if (dateAfter) args.push("--dateafter", dateAfter);
        if (dateBefore) args.push("--datebefore", dateBefore);
        continue;
      }

      // Handle special case mappings
      const specialMapping = this.SPECIAL_ARG_MAPPINGS[key];
      if (specialMapping) {
        const prefix = specialMapping.isShortFlag ? "-" : "--";

        if (typeof value === "boolean") {
          if (value) {
            args.push(`${prefix}${specialMapping.flag}`);
          }
        } else if (Array.isArray(value)) {
          args.push(`${prefix}${specialMapping.flag}`, value.join(","));
        } else {
          args.push(`${prefix}${specialMapping.flag}`, String(value));
        }
        continue;
      }

      // Convert camelCase to kebab-case for command line args
      const argName = camelToKebab(key);

      // Handle boolean flags
      if (typeof value === "boolean") {
        if (value) {
          args.push(`--${argName}`);
        } else {
          // Only add negative flags for options that support them
          if (!this.POSITIVE_FLAG_ONLY_OPTIONS.has(key)) {
            args.push(`--no-${argName}`);
          }
        }
      }
      // Handle arrays
      else if (Array.isArray(value)) {
        args.push(`--${argName}`, value.join(","));
      }
      // Handle non-boolean, non-array values
      else {
        args.push(`--${argName}`, String(value));
      }
    }
  }

  /**
   * Escape command line arguments with platform-specific handling
   * @param arg Argument to escape
   * @returns Escaped argument
   */
  private escapeArg(arg: string): string {
    if (/[^\w/:=-]/.test(arg)) {
      // Use different escaping depending on platform
      if (process.platform === "win32") {
        // Windows: double quotes, escape inner quotes with \
        return `"${arg.replace(/"/g, '\\"')}"`;
      } else {
        // Unix: single quotes, escape inner quotes with backslash
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
    }
    return arg;
  }
}


export class YtDlpFormatHandler {
    // Quality levels (unchanged)
    private readonly QUALITY_LEVELS_DESC: ReadonlyArray<[string, number]> = Object.entries({
        '4320p': 4320, '2160p': 2160, '1440p': 1440, '1080p': 1080,
        '720p': 720, '480p': 480, '360p': 360, '240p': 240, '144p': 144
    }).sort(([, heightA], [, heightB]) => heightB - heightA);
    private readonly QUALITY_LEVELS_MAP: Readonly<{ [key: string]: number }> = Object.fromEntries(this.QUALITY_LEVELS_DESC);

    /**
     * Processes the raw formats array from a yt-dlp response.
     * Filters, deduplicates, sorts, and groups formats, handling both adaptive and pre-combined streams robustly.
     * @param formats Raw formats array from yt-dlp JSON output.
     * @returns A standardized YtDlpResponse containing structured format data.
     */
    processFormats(formats: YtDlpFormat[]): YtDlpResponse<any> {
        try {
            if (!formats || !Array.isArray(formats) || formats.length === 0) {
                return {
                    success: true,
                    message: 'No formats data available or provided.',
                    data: this.getEmptyFormatsDataStructure()
                };
            }

            // 1. Filter out unwanted formats (More lenient filter)
            const initialFilteredFormats = formats.filter(f => {
                if (!f || !f.url || typeof f.url !== 'string') return false; // Basic validity
                if (f.url.includes('.m3u8') || f.url.includes('.mpd')) return false; // Skip manifests
                const noteLower = f.format_note?.toLowerCase();
                if (noteLower === 'storyboard' || noteLower === 'default') return false; // Skip non-media

                // Check for presence of *any* indicator of video or audio content
                const hasVideoIndicator = (f.vcodec && f.vcodec !== 'none') || (f.video_ext && f.video_ext !== 'none') || f.height;
                const hasAudioIndicator = (f.acodec && f.acodec !== 'none') || (f.audio_ext && f.audio_ext !== 'none') || f.asr;

                // Keep if *either* video or audio is indicated
                return hasVideoIndicator || hasAudioIndicator;
            });

            if (initialFilteredFormats.length === 0) {
                return {
                    success: true,
                    message: 'No processable media formats found after initial filtering.',
                    data: this.getEmptyFormatsDataStructure(formats.length)
                };
            }

             // 2. Deduplicate formats
             const formatMap = new Map<string, YtDlpFormat>();
             initialFilteredFormats.forEach(format => {
                 const fingerprint = this.getFormatFingerprint(format); // Use a reliable fingerprint
                 const existingFormat = formatMap.get(fingerprint);
                 if (!existingFormat || this.isBetterFormat(format, existingFormat)) {
                     formatMap.set(fingerprint, format);
                 }
             });
             const uniqueFormats = Array.from(formatMap.values());

             if (uniqueFormats.length === 0) {
                 // This should ideally not happen if initial filtering passed, but as a safeguard:
                  return {
                      success: true,
                      message: 'No unique processable media formats found after deduplication.',
                      data: this.getEmptyFormatsDataStructure(formats.length, initialFilteredFormats.length)
                  };
             }


            // 3. Classify Formats Based on Indicators
            let classifiedVideo: YtDlpFormat[] = [];
            let classifiedAudio: YtDlpFormat[] = [];
            let classifiedCombined: YtDlpFormat[] = [];

            uniqueFormats.forEach(f => {
                // Prioritize codec info, fallback to ext, consider height/asr as weak indicators
                const hasVideoCodec = f.vcodec && f.vcodec !== 'none';
                const hasAudioCodec = f.acodec && f.acodec !== 'none';
                const hasVideoExt = f.video_ext && f.video_ext !== 'none';
                const hasAudioExt = f.audio_ext && f.audio_ext !== 'none';

                const isVideo = hasVideoCodec || hasVideoExt || f.height > 0;
                const isAudio = hasAudioCodec || hasAudioExt || f.asr > 0;

                if (isVideo && isAudio) {
                    classifiedCombined.push(f);
                } else if (isVideo) {
                    // Initially classify as video-only, might be reclassified later
                    classifiedVideo.push(f);
                } else if (isAudio) {
                    classifiedAudio.push(f);
                }
                 // else: This format somehow passed filtering but lacks clear video/audio indicators - ignore
            });

            // Sort classified lists
            const sortByQuality = (a: YtDlpFormat, b: YtDlpFormat) => this.compareFormats(a, b);
            classifiedVideo.sort(sortByQuality);
            classifiedAudio.sort(sortByQuality);
            classifiedCombined.sort(sortByQuality);


            // 4. Finalize Classification (Handle Pre-Combined Streams like Twitch)
            let finalVideoFormats: YtDlpFormat[] = [];
            let finalCombinedFormats: YtDlpFormat[] = classifiedCombined; // Start with explicitly combined
            let finalAudioFormats: YtDlpFormat[] = classifiedAudio;

            const hasActualAudioStreams = finalAudioFormats.length > 0;

            if (!hasActualAudioStreams && classifiedVideo.length > 0) {
                // If no separate audio streams exist, assume the 'video-only' streams
                // are actually pre-combined (common case for Twitch, direct MP4s).
                finalCombinedFormats.push(...classifiedVideo); // Merge into combined
                finalCombinedFormats.sort(sortByQuality); // Re-sort
                // Keep finalVideoFormats empty because there are no *separate* video streams.
            } else {
                // If separate audio streams DO exist, then the classifiedVideo streams
                // are likely truly video-only (adaptive formats like YouTube).
                finalVideoFormats = classifiedVideo;
            }

            // 5. Select Best Formats from Final Lists
            const bestVideoFormat: YtDlpFormat | null = finalVideoFormats[0] || null;
            const bestAudioFormat: YtDlpFormat | null = finalAudioFormats[0] || null;
            const bestCombinedFormat: YtDlpFormat | null = finalCombinedFormats[0] || null;


            // 6. Group Audio by Quality (Using finalAudioFormats)
            const audioQualityGroups = this.groupAudioByQuality(finalAudioFormats);

            // 7. Group by Video Quality Level (Using finalVideoFormats and finalCombinedFormats)
            const formatsByQuality: {
                [quality: string]: { video: YtDlpFormat[]; combined: YtDlpFormat[]; };
            } = {};
            const directUrlsByQuality: {
                [quality: string]: { video: string[]; combined: string[]; };
            } = {};

            const populateQualityGroup = (format: YtDlpFormat, type: 'video' | 'combined') => {
                const qualityKey = this.getQualityLevelKey(format); // Uses height or format_note
                if (qualityKey && format.url) {
                    if (!formatsByQuality[qualityKey]) {
                        formatsByQuality[qualityKey] = { video: [], combined: [] };
                        directUrlsByQuality[qualityKey] = { video: [], combined: [] };
                    }
                    formatsByQuality[qualityKey][type].push(format);
                    // URLs will be derived after sorting within buckets
                }
            };

            finalVideoFormats.forEach(format => populateQualityGroup(format, 'video'));
            finalCombinedFormats.forEach(format => populateQualityGroup(format, 'combined'));

             // Sort within quality buckets and derive URLs
            for (const qualityKey in formatsByQuality) {
                formatsByQuality[qualityKey].video.sort(sortByQuality);
                formatsByQuality[qualityKey].combined.sort(sortByQuality);

                directUrlsByQuality[qualityKey].video = formatsByQuality[qualityKey].video.map(f => f.url).filter(Boolean) as string[];
                directUrlsByQuality[qualityKey].combined = formatsByQuality[qualityKey].combined.map(f => f.url).filter(Boolean) as string[];

                // Clean up empty keys
                if (formatsByQuality[qualityKey].video.length === 0 && formatsByQuality[qualityKey].combined.length === 0) {
                    delete formatsByQuality[qualityKey];
                    delete directUrlsByQuality[qualityKey];
                }
            }

            // 8. Prepare Direct URLs structure
            const directUrls = {
                best: {
                    video: bestVideoFormat?.url || null,
                    audio: bestAudioFormat?.url || null,
                    combined: bestCombinedFormat?.url || null
                },
                audio: {
                    high: audioQualityGroups.high?.map(f => f.url).filter(Boolean) as string[] ?? [],
                    medium: audioQualityGroups.medium?.map(f => f.url).filter(Boolean) as string[] ?? [],
                    low: audioQualityGroups.low?.map(f => f.url).filter(Boolean) as string[] ?? []
                },
                byQuality: directUrlsByQuality
            };


            // 9. Generate Summary Details (Using final lists)
            const formatDetails = {
                totalInput: formats.length,
                totalFiltered: initialFilteredFormats.length, // How many passed initial filter
                totalUnique: uniqueFormats.length,          // How many remained after dedupe
                videoFormats: this.summarizeFormats(finalVideoFormats),
                audioFormats: this.summarizeFormats(finalAudioFormats),
                combinedFormats: this.summarizeFormats(finalCombinedFormats)
            };

            // 10. Construct Final Data Payload
            const formatsData = {
                originalCount: formats.length,
                filteredCount: initialFilteredFormats.length,
                uniqueCount: uniqueFormats.length,
                // Provide all unique formats for reference
                allUniqueFormats: uniqueFormats,
                // Final classified lists
                videoOnlyFormats: finalVideoFormats,
                audioOnlyFormats: finalAudioFormats,
                combinedFormats: finalCombinedFormats,
                // Best formats based on final logic
                bestFormats: {
                    video: bestVideoFormat,
                    audio: bestAudioFormat,
                    combined: bestCombinedFormat
                },
                audioFormats: audioQualityGroups, // Grouped audio
                formatsByQuality, // Grouped video/combined
                directUrls,
                formatDetails // Counts based on final classification
            };

            // console.log("Processed Formats Data (v3):", JSON.stringify(formatsData, null, 2)); // Debugging

            return {
                success: true,
                message: 'Formats processed successfully.',
                data: formatsData
            };

        } catch (error: any) {
            console.error("Error processing yt-dlp formats:", error);
            return {
                success: false,
                message: 'An internal error occurred while processing formats.',
                error: { message: error.message || 'Unknown error during format processing.' }
            };
        }
    }

    // (getEmptyFormatsDataStructure - Updated)
     getEmptyFormatsDataStructure(originalCount = 0, filteredCount = 0, uniqueCount = 0) {
        return {
            originalCount: originalCount,
            filteredCount: filteredCount,
            uniqueCount: uniqueCount,
            allUniqueFormats: [],
            videoOnlyFormats: [],
            audioOnlyFormats: [],
            combinedFormats: [],
            bestFormats: { video: null, audio: null, combined: null },
            audioFormats: { high: [], medium: [], low: [] },
            formatsByQuality: {},
            directUrls: {
                best: { video: null, audio: null, combined: null },
                audio: { high: [], medium: [], low: [] },
                byQuality: {}
            },
            formatDetails: {
                totalInput: originalCount,
                totalFiltered: filteredCount,
                totalUnique: uniqueCount,
                videoFormats: { count: 0 },
                audioFormats: { count: 0 },
                combinedFormats: { count: 0 }
            }
        };
    }


    // (getQualityLevelKey - unchanged, relies on height or format_note)
    private getQualityLevelKey(format: YtDlpFormat): string | null {
        // Prioritize format_note if it matches a known quality level
        if (format.format_note) {
            const note = format.format_note.toLowerCase().trim();
            if (this.QUALITY_LEVELS_MAP.hasOwnProperty(note)) return note;
            const baseQualityMatch = note.match(/^(\d+p)/); // e.g., "1080p60" -> "1080p"
            if (baseQualityMatch && this.QUALITY_LEVELS_MAP.hasOwnProperty(baseQualityMatch[1])) return baseQualityMatch[1];
        }
        // Fallback to height for video/combined formats
        if (format.height && format.height > 0) {
             // Check against defined levels (descending)
            for (const [level, minHeight] of this.QUALITY_LEVELS_DESC) {
                if (format.height >= minHeight) return level;
            }
            // If height is very low but present, maybe assign a base level?
            // Or return null if below lowest defined threshold (144p)
            if(format.height < 144) return null; // Or potentially a 'low' key if needed
        }
        // Fallback for audio-only or formats without clear height/note
         if (format.abr > 0 || format.tbr > 0 ) {
             // Could potentially classify audio here too, but currently handled separately
         }

        return null; // Cannot determine quality level key
    }


    // (getFormatFingerprint - unchanged, seems robust enough)
     private getFormatFingerprint(format: YtDlpFormat): string {
         const vcodec = format.vcodec && format.vcodec !== 'none' ? format.vcodec.split('.')[0] : 'none';
         const acodec = format.acodec && format.acodec !== 'none' ? format.acodec.split('.')[0] : 'none';
         const height = format.height || 0;
         const width = format.width || 0;
         const bitrate = Math.round((format.tbr || format.vbr || format.abr || 0) / 10) * 10; // TBR preferred

         const hasVideo = vcodec !== 'none' || (format.video_ext && format.video_ext !== 'none') || height > 0;
         const hasAudio = acodec !== 'none' || (format.audio_ext && format.audio_ext !== 'none') || (format.asr || 0) > 0;

         if (hasVideo && hasAudio) { // Combined
             return `C:${height}x${width}-${vcodec}-${acodec}-${bitrate}`;
         } else if (hasVideo) { // Video only (or pre-combined treated as video initially)
             return `V:${height}x${width}-${vcodec}-${bitrate}`;
         } else if (hasAudio) { // Audio only
             const audioBitrate = Math.round((format.abr || format.tbr || 0) / 5) * 5;
             return `A:${acodec}-${audioBitrate}`;
         }
         // Fallback if no clear indicators (should be rare after filtering)
         return `ID:${format.format_id || format.format || 'unknown'}-${height}-${width}-${bitrate}`;
     }


    // (compareFormats - unchanged, already reasonably robust)
    private compareFormats(a: YtDlpFormat, b: YtDlpFormat): number {
        // 1. Resolution (Height) - Primary for video content
        const heightDiff = (b.height || 0) - (a.height || 0);
        if (heightDiff !== 0 && ((a.vcodec && a.vcodec !== 'none') || (b.vcodec && b.vcodec !== 'none') || a.height || b.height)) {
             // Consider height if *any* video indicator exists
            return heightDiff;
        }

        // 2. Bitrate (Prefer higher, use TBR > VBR/ABR) - Secondary
        const aRate = a.tbr ?? a.vbr ?? a.abr ?? 0;
        const bRate = b.tbr ?? b.vbr ?? b.abr ?? 0;
        const rateDiff = bRate - aRate;
        const canCompareRate = (aRate > 0 && bRate > 0) || (!(a.vcodec && a.vcodec !== 'none') && !(b.vcodec && b.vcodec !== 'none')); // Compare if rates valid OR pure audio
        if (rateDiff !== 0 && canCompareRate && heightDiff === 0) {
             return rateDiff;
        }

        // 3. Video Codec Priority - Tie-breaker
        const codecPriority = (codec: string | null | undefined): number => { /* ... unchanged ... */
            if (!codec || codec === 'none') return 0;
            if (codec.startsWith('av01')) return 5; if (codec.startsWith('vp9')) return 4;
            if (codec.startsWith('hvc1') || codec.startsWith('hev1')) return 3;
            if (codec.startsWith('avc')) return 2; if (codec.startsWith('vp8')) return 1;
            return 0;
        };
        const codecDiff = codecPriority(b.vcodec) - codecPriority(a.vcodec);
        if (codecDiff !== 0 && heightDiff === 0 && (!canCompareRate || rateDiff === 0)) {
             return codecDiff;
        }

        // 4. Audio Codec Priority - Tie-breaker
        const audioCodecPriority = (codec: string | null | undefined): number => { /* ... unchanged ... */
            if (!codec || codec === 'none') return 0;
            if (codec.startsWith('opus')) return 3;
            if (codec.startsWith('mp4a') || codec === 'aac') return 2;
            if (codec.startsWith('mp3')) return 1;
            return 0;
        };
        const audioCodecDiff = audioCodecPriority(b.acodec) - audioCodecPriority(a.acodec);
        if (audioCodecDiff !== 0 && ( (!(a.vcodec && a.vcodec !== 'none') && !(a.video_ext && a.video_ext !=='none')) || (heightDiff === 0 && (!canCompareRate || rateDiff === 0) && codecDiff === 0))) {
             // Apply if audio-only OR video aspects identical
            return audioCodecDiff;
        }

        // 5. Frame Rate (FPS) - Prefer higher FPS
        const fpsDiff = (b.fps || 0) - (a.fps || 0);
        if (fpsDiff > 0.1 && heightDiff === 0 && (!canCompareRate || rateDiff === 0) && codecDiff === 0 && audioCodecDiff === 0) { // Use small tolerance for FPS diff
            return fpsDiff;
        }

        // 6. Filesize (Approx) - Final fallback
        const filesizeDiff = (b.filesize || b.filesize_approx || 0) - (a.filesize || a.filesize_approx || 0);
        if (filesizeDiff !== 0 && !canCompareRate && heightDiff === 0 && codecDiff === 0 && audioCodecDiff === 0 && Math.abs(fpsDiff) < 0.1 ) {
             return filesizeDiff;
        }

        return 0; // Considered equal
    }

    // (isBetterFormat - unchanged)
    private isBetterFormat(newFormat: YtDlpFormat, existingFormat: YtDlpFormat): boolean {
        // Returns true if newFormat is better (compareFormats returns negative)
        return this.compareFormats(newFormat, existingFormat) < 0;
    }

    // (groupAudioByQuality - unchanged)
     private groupAudioByQuality(audioFormats: YtDlpFormat[]): {
        high?: YtDlpFormat[]; medium?: YtDlpFormat[]; low?: YtDlpFormat[];
     } {
        const HIGH_BITRATE_THRESHOLD = 192;
        const MEDIUM_BITRATE_THRESHOLD = 128;
        const groups: { high: YtDlpFormat[], medium: YtDlpFormat[], low: YtDlpFormat[] } = { high: [], medium: [], low: [] };
        // Ensure sorting before grouping
        const sortedAudio = [...audioFormats].sort(this.compareFormats);

        sortedAudio.forEach(f => {
            const bitrate = f.abr || f.tbr || 0; // Prefer audio bitrate
            if (bitrate >= HIGH_BITRATE_THRESHOLD) groups.high.push(f);
            else if (bitrate >= MEDIUM_BITRATE_THRESHOLD) groups.medium.push(f);
            else if (bitrate > 0) groups.low.push(f);
            // Exclude formats with zero/unknown bitrate from these specific groups
        });
        return {
            high: groups.high.length > 0 ? groups.high : undefined,
            medium: groups.medium.length > 0 ? groups.medium : undefined,
            low: groups.low.length > 0 ? groups.low : undefined,
        };
     }

    // (summarizeFormats - unchanged)
     private summarizeFormats(formats: YtDlpFormat[]): any {
        if (!formats || formats.length === 0) return { count: 0 };
        const summary: any = { /* ... structure ... */
             count: formats.length, resolutions: {}, codecs: { video: {}, audio: {} },
             containers: {}, notes: {}, dynamicRange: {}
        };
        // (Logic from your original code to populate summary)
         formats.forEach(format => {
             /* ... populate counts ... */
            if (format.height && format.width) { const res = `${format.width}x${format.height}`; summary.resolutions[res] = (summary.resolutions[res] || 0) + 1; }
            else if (format.height) { const resApprox = `${format.height}p`; summary.resolutions[resApprox] = (summary.resolutions[resApprox] || 0) + 1; }
            if (format.vcodec && format.vcodec !== 'none') { const vcodec = format.vcodec.split('.')[0]; summary.codecs.video[vcodec] = (summary.codecs.video[vcodec] || 0) + 1; }
            if (format.acodec && format.acodec !== 'none') { const acodec = format.acodec.split('.')[0]; summary.codecs.audio[acodec] = (summary.codecs.audio[acodec] || 0) + 1; }
            const container = format.container || format.ext || 'unknown'; summary.containers[container] = (summary.containers[container] || 0) + 1;
            const note = format.format_note || 'N/A'; summary.notes[note] = (summary.notes[note] || 0) + 1;
            const dr = format.dynamic_range || 'SDR'; summary.dynamicRange[dr] = (summary.dynamicRange[dr] || 0) + 1;
         });
         if (Object.keys(summary.codecs.video).length === 0) delete summary.codecs.video;
         if (Object.keys(summary.codecs.audio).length === 0) delete summary.codecs.audio;
         if (Object.keys(summary.codecs).length === 0) delete summary.codecs;
         if (Object.keys(summary.resolutions).length === 0) delete summary.resolutions;
        return summary;
     }
}

export default YtDlpService;
