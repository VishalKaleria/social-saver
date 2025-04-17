import ffmpeg from "@w3vish/fluent-ffmpeg"
import * as path from "path"
import * as fs from "fs"
import { EventEmitter } from "events"
import { v4 as uuidv4 } from "uuid"
import type {
  ProgressData,
  FFmpegDownloadOptions,
  JobStatus,
  ErrorResponse,
  JobInfo,
  ProgressResponse,
  JobResponse,
  CompletionResponse,
} from "@/types/FfmpegCore"
import { FFmpegUtils } from "./ffmpeg-utils"
import { GlobalSettings } from "@/types"
import settingsService from "./settings-service"


export class FFmpegService extends EventEmitter {
  private ffmpegPath = ""
  private jobs = new Map<
    string,
    {
      startTime: number
      command?: any
      lastProgress?: ProgressData
      options: FFmpegDownloadOptions
      totalDuration?: number
      status: JobStatus
      outputPath: string
      lastUpdateTime: number
      size: number
    }
  >()

  // Queue system variables
  private jobQueue: { jobId: string; options: FFmpegDownloadOptions }[] = []
  private isProcessingQueue = false
  private cooldownTime: number
  private maxConcurrentJobs: number
  private activeJobCount = 0

  // Keep a separate record of completed jobs for reference
  private completedJobs = new Map<string, JobInfo>()
  private maxCompletedJobs: number

  // Settings
  private settings: GlobalSettings

  constructor() {
    super()

    // Initialize settings from the settings service
    this.settings = settingsService.getSettings()
    this.cooldownTime = this.settings.ffmpeg.cooldownTimeBetweenJobs * 1000 // Convert to milliseconds
    this.maxConcurrentJobs = this.settings.ffmpeg.maxConcurrentJobs
    this.maxCompletedJobs = this.settings.ffmpeg.maxCompletedJobsToKeep

    this.setupFFmpegPath()

    // Set up auto-cleanup if enabled
    if (this.settings.ffmpeg.autoCleanupCompletedJobs) {
      const cleanupInterval = Math.max(1 * 60 * 60 * 1000, this.settings.ffmpeg.autoCleanupTimeMs / 10) // At least hourly
      setInterval(() => {
        this.cleanupCompletedJobs(this.settings.ffmpeg.autoCleanupTimeMs)
      }, cleanupInterval)
    }
  }

  private setupFFmpegPath(): void {
    try {
      this.ffmpegPath = settingsService.getSettings().ffmpeg.ffmpegPath
    } catch (error) {
      this.ffmpegPath = "ffmpeg" // Use system FFmpeg otherwise fuck yourself
      console.log("Using system FFmpeg")
    }

    ffmpeg.setFfmpegPath(this.ffmpegPath)
  }

  // Set cooldown time in seconds
  public setCooldownTime(seconds: number): void {
    this.cooldownTime = Math.max(0, seconds * 1000)
    console.log(`Cooldown time set to ${seconds} seconds`)
  }

  // Set max concurrent jobs
  public setMaxConcurrentJobs(count: number): void {
    this.maxConcurrentJobs = Math.max(1, count)
    console.log(`Max concurrent jobs set to ${count}`)

    // Try to process queue in case we increased the limit
    this.processQueue()
  }

  // Get queue status info
  public getQueueStatus(): {
    queueLength: number
    activeJobs: number
    maxConcurrentJobs: number
    cooldownTime: number
  } {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobCount,
      maxConcurrentJobs: this.maxConcurrentJobs,
      cooldownTime: this.cooldownTime / 1000, // Convert back to seconds
    }
  }

  // Add a job to the queue
  private addToQueue(jobId: string, options: FFmpegDownloadOptions): void {
    this.jobQueue.push({ jobId, options })

    // Emit queue update event
    this.emit("queue:update", {
      jobId,
      position: this.jobQueue.length,
      queueLength: this.jobQueue.length,
      status: "queued",
    })

    // Try to process the queue
    this.processQueue()
  }

  // Process the next job in the queue
  private async processQueue(): Promise<void> {
    // If already processing or no jobs to process, do nothing
    if (this.isProcessingQueue || this.jobQueue.length === 0) {
      return;
    }

    // Check if we're at max concurrent jobs
    if (this.activeJobCount >= this.maxConcurrentJobs) {
      console.log(`Already at max concurrent jobs (${this.activeJobCount}/${this.maxConcurrentJobs}). Waiting...`);
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.jobQueue.length > 0 && this.activeJobCount < this.maxConcurrentJobs) {
        // Get the next job from the queue
        const { jobId, options } = this.jobQueue.shift()!;

        // Update queue positions for remaining jobs
        this.jobQueue.forEach((job, index) => {
          this.emit("queue:update", {
            jobId: job.jobId,
            position: index + 1,
            queueLength: this.jobQueue.length,
            status: "queued",
          });
        });

        // Get the current job info
        const jobInfo = this.jobs.get(jobId);
        if (!jobInfo) {
          console.error(`Job ${jobId} not found in jobs map, skipping`);
          continue;
        }

        // Get all active job paths to check for conflicts
        const activeJobPaths = Array.from(this.jobs.entries())
          .filter(([id, _]) => id !== jobId) // Filter out the current job
          .map(([_, job]) => job.outputPath);

        // Check if the output path already exists or is being processed
        let outputPath = jobInfo.outputPath;
        if (fs.existsSync(outputPath) || activeJobPaths.includes(outputPath)) {
          // Need to handle duplicate filename
          const dir = path.dirname(outputPath);
          const ext = path.extname(outputPath);
          const baseName = path.basename(outputPath, ext);

          // Try incremental counter first
          let counter = 1;
          let newPath = outputPath;

          while (fs.existsSync(newPath) || activeJobPaths.includes(newPath)) {
            newPath = path.join(dir, `${baseName} (${counter})${ext}`);
            counter++;

            // If too many duplicates, switch to timestamp-based naming for guaranteed uniqueness
            if (counter > 100) {
              const timestamp = Date.now();
              const uniqueId = uuidv4().substring(0, 8);
              newPath = path.join(dir, `${baseName}_${timestamp}_${uniqueId}${ext}`);
              break;
            }
          }

          console.log(`Output path conflict detected. Updated from ${outputPath} to ${newPath}`);

          // Update the job info with the new path
          outputPath = newPath;
          jobInfo.outputPath = newPath;
          this.jobs.set(jobId, jobInfo);
        }

        // Increment active job count
        this.activeJobCount++;
        console.log(`Starting job ${jobId}. Active jobs: ${this.activeJobCount}/${this.maxConcurrentJobs}`);

        // Emit job starting event
        this.emit("queue:processing", {
          jobId,
          status: "processing",
          outputPath, // Include the potentially updated output path
        });

        // Process the download in the background
        this.processDownload(jobId, {
          ...options,
          outputPath: outputPath, // Ensure the updated path is used
        })
          .then(() => {
            console.log(`Job ${jobId} completed successfully`);
          })
          .catch((error) => {
            console.error(`Error processing job ${jobId}:`, error);
          })
          .finally(() => {
            // Decrement active job count
            this.activeJobCount--;
            console.log(`Job ${jobId} finished. Active jobs: ${this.activeJobCount}/${this.maxConcurrentJobs}`);

            // Continue processing queue if there are more jobs
            if (this.jobQueue.length > 0) {
              // Apply cooldown before next job if needed
              if (this.cooldownTime > 0) {
                // Emit cooldown event
                this.emit("queue:cooldown", {
                  cooldownTime: this.cooldownTime / 1000,
                });
                setTimeout(() => {
                  this.processQueue();
                }, this.cooldownTime);
              } else {
                this.processQueue();
              }
            }
          });
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  // Force process specific job from queue
  public forceProcessJob(jobId: string): boolean {
    const jobIndex = this.jobQueue.findIndex((job) => job.jobId === jobId)

    if (jobIndex === -1) {
      return false // Job not found in queue
    }

    // If we're already at max capacity, we can't force another job
    if (this.activeJobCount >= this.maxConcurrentJobs) {
      return false
    }

    // Remove job from queue
    const [job] = this.jobQueue.splice(jobIndex, 1)

    // Process the job
    this.activeJobCount++

    this.emit("queue:processing", {
      jobId: job.jobId,
      status: "processing",
      isPriority: true,
    })

    // Process in background
    this.processDownload(job.jobId, job.options)
      .catch((error) => console.error(`Error processing forced job ${job.jobId}:`, error))
      .finally(() => {
        this.activeJobCount--
        // Try to process queue again
        this.processQueue()
      })

    return true
  }

  private handleProgressUpdate(jobId: string, progress: ProgressData): void {
    const jobInfo = this.jobs.get(jobId)
    if (!jobInfo) return

    // Calculate elapsed time
    const timeElapsed = Math.floor((Date.now() - jobInfo.startTime) / 1000)

    // IMPORTANT: Merge with previous progress data instead of replacing it
    const previousProgress = jobInfo.lastProgress || {}

    // Enhance progress data - merge with previous data to preserve values
    const enhancedProgress: ProgressData = {
      ...previousProgress, // Keep previous values
      ...progress, // Override with new values where available
      timeElapsed,
      outputPath: jobInfo.outputPath,
      size: jobInfo.size || progress.size || previousProgress.size || 0,
    }

    // Calculate ETA using appropriate progress value
    if (enhancedProgress.percent) {
      enhancedProgress.eta = FFmpegUtils.calculateETA({
        percent: enhancedProgress.percent,
        startTime: jobInfo.startTime,
        speed: enhancedProgress.speed,
      })
    }

    // Store last progress
    jobInfo.lastProgress = enhancedProgress
    jobInfo.lastUpdateTime = Date.now()

    // Create structured progress response for frontend
    const progressResponse: ProgressResponse = {
      jobId,
      title: jobInfo.options.title || "Download",
      percent: enhancedProgress.percent || 0,
      eta: enhancedProgress.eta || "estimating...",
      timeElapsed,
      speed: enhancedProgress.speed,
      bitrate: enhancedProgress.bitrate,
      size: enhancedProgress.size,
      outputPath: jobInfo.outputPath,
      frames: enhancedProgress.frames,
      fps: enhancedProgress.fps,
      time: enhancedProgress.time,
    }

    // Emit progress event with JSON data
    this.emit("progress", progressResponse)
  }

  // Get media duration for better progress calculation
  public async getMediaDuration(url: string): Promise<number> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(url, (err: any, metadata: any) => {
        if (err || !metadata?.format?.duration) {
          resolve(0)
          return
        }
        resolve(metadata.format.duration)
      })
    })
  }

  // Fix the download method to properly handle custom paths and settings
  public async download(options: FFmpegDownloadOptions): Promise<JobResponse> {
    try {
      let { type, url, outputPath, filename, format, title, quality, platformUrl, size } = options

      if (!url) {
        throw new Error("URL is required")
      }

      // Use settings for default values if not provided
      if (!quality) {
        quality = settingsService.getDefaultQuality()
      }

      if (!format) {
        format = settingsService.getDefaultFormat(type)
      }

      if (!outputPath) {
        outputPath = settingsService.getDownloadPath(type)
      }


      // Generate a proper filename and path
      const fullOutputPath = await settingsService.createOutputFilePath({
        customOutput: outputPath,
        filename: filename || title || "",
        type,
        format,
        metadata: options.metadata,
        formatId: options.formatId,
        quality,
      })

      console.log(`Output path: ${fullOutputPath}`)

      // Generate a unique job ID
      const jobId = FFmpegUtils.generateJobId()

      // Get final format from the extension in the output path
      const finalFormat = path.extname(fullOutputPath).substring(1)

      // Initialize job - with 'queued' status
      this.jobs.set(jobId, {
        startTime: Date.now(),
        options: {
          ...options,
          format: finalFormat, // Store the updated format
          outputPath: outputPath, // Make sure to store the original output path
        },
        totalDuration: 0, // Will be set when job actually starts
        status: "queued", // Start as queued
        size: size || 0,
        outputPath: fullOutputPath,
        lastUpdateTime: Date.now(),
      })

      // Create job response
      const jobResponse: JobResponse = {
        success: true,
        jobId,
        outputPath: fullOutputPath,
        filename: path.basename(fullOutputPath),
        title: title || "Download",
        platformUrl: url,
        message: `Queued ${type} download job`,
        type,
        started: Date.now(),
        options: {
          ...options,
          format: finalFormat, // Return the updated format
          outputPath: outputPath, // Make sure to return the original output path
        },
      }

      // Emit job queued event
      this.emit("job:queued", jobResponse)

      // Add job to queue
      this.addToQueue(jobId, options)

      return jobResponse
    } catch (error) {
      // Handle any unexpected errors in the main download method
      console.error("Fatal error in download method:", error)

      // Create a generic error response
      const errorResponse: ErrorResponse = {
        jobId: "error-" + Date.now(),
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timeElapsed: 0,
      }

      this.emit("error", errorResponse)
      throw error
    }
  }

  // The actual processing of the download - separated from the queue system
  private async processDownload(jobId: string, options: FFmpegDownloadOptions): Promise<string> {
    const jobInfo = this.jobs.get(jobId)
    if (!jobInfo) {
      throw new Error(`Job ${jobId} not found`)
    }

    // Update job status
    jobInfo.status = "downloading"
    jobInfo.startTime = Date.now() // Reset start time when actually processing

    try {
      // Try to get duration for better progress calculation
      if (options.type === "combined" || options.type === "audio") {
        jobInfo.totalDuration = await this.getMediaDuration(options.url as string)
      } else if (options.type === "video") {
        const { video } = options.url as { audio: string; video: string }
        if (video) {
          jobInfo.totalDuration = await this.getMediaDuration(video)
        }
      }
    } catch (error) {
      console.warn("Could not determine media duration:", error)
    }

    // Emit job start event
    this.emit("job:start", {
      jobId,
      outputPath: jobInfo.outputPath,
      message: `Started ${options.type} download job`,
      type: options.type,
      started: jobInfo.startTime,
      options,
    })

    try {
      let result: string

      switch (options.type) {
        case "combined":
        case "muteVideo":
        case "audio":
          result = await this.processSingleStream(jobId, options)
          break
        case "video":
          const { audio, video } = options.url as { audio: string; video: string }
          if (!audio || !video) {
            throw new Error("Both audio and video URLs are required for video type")
          }
          result = await this.mergeVideoAndAudio(jobId, options)
          break
        case "image":
          result = await this.downloadImage(jobId, options)
          break
        default:
          throw new Error(`Unsupported media type: ${options.type}`)
      }

      // Update job status on completion and get job info
      jobInfo.status = "completed"

      // Get file size
      try {
        const stats = fs.statSync(jobInfo.outputPath)
        jobInfo.size = stats.size
      } catch (e) {
        console.warn(`Could not get file size for ${jobInfo.outputPath}:`, e)
      }

      // Move to completed jobs
      this.addToCompletedJobs(jobId)

      return result
    } catch (error) {
      // Update job status on error
      jobInfo.status = "error"

      // Move to completed jobs (even though it errored)
      this.addToCompletedJobs(jobId)

      // Emit error
      const errorResponse: ErrorResponse = {
        jobId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timeElapsed: Math.floor((Date.now() - jobInfo.startTime) / 1000),
      }

      this.emit("error", errorResponse)
      throw error
    }
  }

  // Move a job from active to completed jobs
  private addToCompletedJobs(jobId: string): void {
    const jobInfo = this.jobs.get(jobId)
    if (!jobInfo) return

    const completedJobInfo: JobInfo = {
      jobId: jobId,
      type: jobInfo.options.type,
      percent: Math.round(jobInfo.lastProgress?.percent) || 100, // Set to 100% if completed
      startTime: jobInfo.startTime,
      endTime: Date.now(),
      timeElapsed: Math.floor((Date.now() - jobInfo.startTime) / 1000),
      outputPath: jobInfo.outputPath,
      eta: "0s",
      status: jobInfo.status,
      size: jobInfo.size,
      bitrate: jobInfo.lastProgress?.bitrate,
      speed: jobInfo.lastProgress?.speed,
      platformUrl: jobInfo.options.platformUrl,
      title: jobInfo.options.title,
      thumbnail: jobInfo.options.metadata.thumbnail || jobInfo.options.metadata.thumbnails?.[0].url,
      fileSize: jobInfo.size,
      duration: jobInfo.totalDuration,
    }

    // Add to completed jobs
    this.completedJobs.set(jobId, completedJobInfo)

    // Remove from active jobs
    this.jobs.delete(jobId)

    // Limit the number of completed jobs we keep
    if (this.completedJobs.size > this.maxCompletedJobs) {
      const oldestKey = this.completedJobs.keys().next().value
      this.completedJobs.delete(oldestKey as string)
    }
  }

  // Apply quality options to command
  private applyQualityOptions(command: any, options: FFmpegDownloadOptions): any {
    if (options.quality) {
      switch (options.quality) {
        case "high":
          command.outputOptions(["-c:v libx264", "-crf 18", "-preset slow"])
          break
        case "medium":
          command.outputOptions(["-c:v libx264", "-crf 23", "-preset medium"])
          break
        case "low":
          command.outputOptions(["-c:v libx264", "-crf 28", "-preset fast"])
          break
      }
    }

    if (options.scale) {
      command.outputOptions([`-vf scale=iw*${options.scale}:ih*${options.scale}`])
    }

    if (options.customOptions && Array.isArray(options.customOptions)) {
      command.outputOptions(options.customOptions)
    }

    return command
  }

   // --- Process Single Stream (Video/Audio/Mute) ---
  // Prioritizes copying streams for speed and low CPU unless encoding is necessary
  // due to format constraints or explicit quality settings.
  private processSingleStream(jobId: string, options: FFmpegDownloadOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const jobInfo = this.jobs.get(jobId)!;
      if (!jobInfo) {
        return reject(new Error(`Job ${jobId} info not found during processing.`));
      }

      const url = options.url as string;
      const outputPath = jobInfo.outputPath;
      const outputDir = path.dirname(outputPath);
      const targetFormat = path.extname(outputPath).substring(1).toLowerCase();

      console.log(`Job ${jobId}: Starting processSingleStream for type '${options.type}' to format '${targetFormat}'`);

      // --- Determine Encoding Requirements ---
      // We encode if quality is NOT 'original' OR if the target format likely requires it.
      const qualityRequiresEncoding = options.quality && options.quality !== 'original';

      // Basic check: MP4/MOV often need AAC. MKV/WebM are more flexible.
      // Standalone audio formats often require specific codecs.
      // This is a simplification; real codec compatibility is complex.
      const likelyRequiresAudioEncodingForContainer =
        (options.type === 'combined' || options.type === 'video') && ['mp4', 'mov'].includes(targetFormat);
      const likelyRequiresAudioEncodingForFormat =
        options.type === 'audio' && !['aac', 'm4a', 'opus', 'ogg', 'flac', 'wav'].includes(targetFormat); // MP3 usually needs encoding

      const needsVideoEncoding = (options.type === 'combined' || options.type === 'muteVideo') && qualityRequiresEncoding;
      const needsAudioEncoding = (options.type === 'combined' || options.type === 'audio') &&
                                (qualityRequiresEncoding || likelyRequiresAudioEncodingForContainer || likelyRequiresAudioEncodingForFormat);

      // --- Build FFmpeg Command ---
      let command = ffmpeg(url)
        .inputOption("-reconnect 1")       // Auto-reconnect on network errors (short)
        .inputOption("-reconnect_streamed 1") // Auto-reconnect for streamed sources
        .inputOption("-reconnect_delay_max 5") // Max delay before reconnect attempt
        .on("progress", (progress) => {
          // Use built-in progress event which is generally reliable
           const progressData: ProgressData = {
            frames: progress.frames,
            fps: progress.currentFps,
            percent: progress.percent, // This might be inaccurate if duration isn't known by ffmpeg
            size: progress.targetSize,
            time: progress.timemark,
            bitrate: progress.currentKbps ? `${progress.currentKbps} kbps` : undefined,
            speed: progress.speed, // Capture speed
          }
          this.handleProgressUpdate(jobId, progressData)
        })
        .on("start", (commandLine: string) => {
          console.log(`Job ${jobId}: FFmpeg process started.`);
          // Optional: Log commandLine only in verbose mode
          // if (this.settings.ytdlp.verbose) { console.log(`FFmpeg command: ${commandLine}`); }
          this.emit("start", { commandLine, jobId });
        })
        .on("stderr", (stderrLine: string) => {
           // Optional: Log stderr only in verbose mode
          // if (this.settings.ytdlp.verbose) { console.log(`FFmpeg stderr: ${stderrLine}`); }
          // Backup progress parsing if the 'progress' event is flaky (less common now)
          // if (stderrLine.includes("frame=") && stderrLine.includes("time=")) {
          //   const parsedProgress = FFmpegUtils.parseProgressLine({ line: stderrLine, totalDuration: jobInfo.totalDuration });
          //   this.handleProgressUpdate(jobId, parsedProgress);
          // }
        })
        .on("error", (err: Error, stdout: string, stderr: string) => { // Include stdout/stderr in error log
          const errMsg = `FFmpeg error: ${err.message}. Stderr: ${stderr}`;
          console.error(`Job ${jobId}: ${errMsg}`);
          const errorResponse: ErrorResponse = {
            jobId,
            success: false,
            error: err.message, // Keep error concise for UI
            timeElapsed: Math.floor((Date.now() - jobInfo.startTime) / 1000),
          };
          this.emit("error", errorResponse);
          reject(new Error(err.message)); // Reject the promise
        })
        .on("end", (stdout: string, stderr: string) => { // Include stdout/stderr in end log
          console.log(`Job ${jobId}: FFmpeg process finished successfully.`);
          // Optional: Log stdout/stderr only in verbose mode
          // if (this.settings.ytdlp.verbose) { console.log(`FFmpeg stdout: ${stdout}\nFFmpeg stderr: ${stderr}`); }

          const timeElapsed = Math.floor((Date.now() - jobInfo.startTime) / 1000);
          let fileSize = 0;
          try {
            // Verify file exists and has size > 0
            if (fs.existsSync(outputPath)) {
                const stats = fs.statSync(outputPath);
                fileSize = stats.size;
                if (fileSize === 0) {
                    console.warn(`Job ${jobId}: Output file created but has zero size. Possible issue.`);
                    // Optionally reject here if zero size is always an error
                    // return reject(new Error("Output file created with zero size."));
                }
            } else {
                 console.warn(`Job ${jobId}: Output file not found at ${outputPath} after FFmpeg 'end' event.`);
                 // Optionally reject here
                 // return reject(new Error("Output file missing after successful FFmpeg execution."));
            }
          } catch (e: any) {
            console.warn(`Job ${jobId}: Could not get file stats for ${outputPath}:`, e.message);
          }

          // Update job info with final size
          jobInfo.size = fileSize;

          const completionResponse: CompletionResponse = {
            jobId,
            success: true,
            outputPath: outputPath,
            timeElapsed,
            size: fileSize, // Use the verified size
            bitrate: jobInfo.lastProgress?.bitrate, // Get last known bitrate
            averageSpeed: jobInfo.lastProgress?.speed, // Get last known speed
          };
          this.emit("end", completionResponse);
          resolve(outputPath); // Resolve the promise
        });

      // --- Apply Codec and Quality Options ---
      const outputOpts: string[] = [];

      if (options.type === 'combined' || options.type === 'muteVideo') {
        // Video Stream
        if (needsVideoEncoding) {
          console.log(`Job ${jobId}: Encoding video (Quality: ${options.quality})`);
          outputOpts.push('-c:v', 'libx264'); // Most compatible default
          // Apply quality settings for libx264
          switch (options.quality) {
            case "high": outputOpts.push("-crf", "19", "-preset", "medium"); break; // Slightly faster than slow
            case "medium": outputOpts.push("-crf", "23", "-preset", "medium"); break;
            case "low": outputOpts.push("-crf", "27", "-preset", "fast"); break;
            // 'original' case handled by !needsVideoEncoding
          }
        } else {
          console.log(`Job ${jobId}: Copying video stream.`);
          outputOpts.push('-c:v', 'copy');
        }
      }

      if (options.type === 'combined' || options.type === 'audio') {
         // Audio Stream
        if (needsAudioEncoding) {
            console.log(`Job ${jobId}: Encoding audio (Target: ${targetFormat}, Quality: ${options.quality})`);
            // Choose compatible audio codec based on target format
            let audioCodec = 'aac'; // Default for MP4/MOV
            let audioQualityOpts: string[] = ['-b:a', '192k']; // Default highish bitrate for AAC

            if (targetFormat === 'mp3') {
                audioCodec = 'libmp3lame';
                // Use VBR for MP3 (-q:a)
                 switch (options.quality) {
                    case "high": audioQualityOpts = ["-q:a", "2"]; break; // VBR ~190kbps
                    case "medium": audioQualityOpts = ["-q:a", "4"]; break; // VBR ~165kbps
                    case "low": audioQualityOpts = ["-q:a", "6"]; break; // VBR ~130kbps
                    default: audioQualityOpts = ["-q:a", "3"]; // Default good VBR
                 }
            } else if (targetFormat === 'm4a') {
                audioCodec = 'aac'; // Already default, set quality
                 switch (options.quality) {
                    case "high": audioQualityOpts = ["-b:a", "192k"]; break;
                    case "medium": audioQualityOpts = ["-b:a", "128k"]; break;
                    case "low": audioQualityOpts = ["-b:a", "96k"]; break;
                 }
            } else if (targetFormat === 'opus' || targetFormat === 'ogg') {
                audioCodec = 'libopus'; // Opus is generally preferred for ogg too
                 switch (options.quality) {
                    case "high": audioQualityOpts = ["-b:a", "160k"]; break;
                    case "medium": audioQualityOpts = ["-b:a", "112k"]; break;
                    case "low": audioQualityOpts = ["-b:a", "80k"]; break;
                 }
            } // Add FLAC, WAV etc. if needed (they are lossless, quality setting less relevant)
            else if (targetFormat === 'flac'){
                 audioCodec = 'flac';
                 audioQualityOpts = []; // No quality setting needed
            } else if (targetFormat === 'wav'){
                 audioCodec = 'pcm_s16le'; // Common WAV format
                 audioQualityOpts = []; // No quality setting needed
            }
            // Add more format/codec mappings as needed

            outputOpts.push('-c:a', audioCodec, ...audioQualityOpts);
        } else {
          console.log(`Job ${jobId}: Copying audio stream.`);
          outputOpts.push('-c:a', 'copy');
        }
      }

      // Add flags based on type
      if (options.type === 'audio') {
        outputOpts.push('-vn'); // No video for audio-only
      } else if (options.type === 'muteVideo') {
        outputOpts.push('-an'); // No audio for mute video
      }

      // Add general purpose flags (like faststart for MP4)
      if (targetFormat === 'mp4' || targetFormat === 'mov') {
         outputOpts.push("-movflags", "+faststart");
      }

      // Apply the gathered options
      command.outputOptions(outputOpts);

      // Apply scaling AFTER codec settings if needed (usually for video encoding)
      if (options.scale && (options.type === 'combined' || options.type === 'muteVideo') && needsVideoEncoding) {
        console.log(`Job ${jobId}: Applying scaling: ${options.scale}`);
        command.outputOptions([`-vf scale=iw*${options.scale}:ih*${options.scale}`]);
      }

      // Apply any user-defined custom options LAST to allow overrides
      if (options.customOptions && Array.isArray(options.customOptions)) {
        console.log(`Job ${jobId}: Applying custom options:`, options.customOptions);
        command.outputOptions(options.customOptions);
      }

      // --- Store command & Execute ---
      jobInfo.command = command;

      // Ensure output directory exists
      try {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
          console.log(`Job ${jobId}: Created output directory: ${outputDir}`);
        }
      } catch (dirError: any) {
         console.error(`Job ${jobId}: Failed to create output directory ${outputDir}:`, dirError.message);
         return reject(new Error(`Failed to create output directory: ${dirError.message}`));
      }

      // Start the FFmpeg process
      try {
        console.log(`Job ${jobId}: Saving to ${outputPath}`);
        command.save(outputPath);
      } catch (execError: any) {
        console.error(`Job ${jobId}: Error executing FFmpeg command:`, execError.message);
        reject(execError); // Reject the promise on execution error
      }
    });
  }

  // Merge separate video and audio streams
  private mergeVideoAndAudio(jobId: string, options: FFmpegDownloadOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const jobInfo = this.jobs.get(jobId)!
      const { audio, video } = options.url as { audio: string; video: string }
      const outputPath = jobInfo.outputPath

      // Check if both URLs are valid
      if (!video || !audio) {
        reject(new Error("Both video and audio URLs must be provided"))
        return
      }

      let command = ffmpeg()
        .input(video)
        .inputOption("-reconnect 1")
        .inputOption("-reconnect_streamed 1")
        .inputOption("-reconnect_delay_max 5")
        .input(audio)
        .inputOption("-reconnect 1")
        .inputOption("-reconnect_streamed 1")
        .inputOption("-reconnect_delay_max 5")
        .on("progress", (progress) => {
          // Handle progress updates directly from ffmpeg progress events
          const progressData: ProgressData = {
            frames: progress.frames,
            fps: progress.currentFps,
            percent: progress.percent,
            size: progress.targetSize,
            time: progress.timemark,
            bitrate: progress.currentKbps ? `${progress.currentKbps} kbps` : undefined,
            // speed: progress.speed,
          }

          this.handleProgressUpdate(jobId, progressData)
        })

      // Apply quality options or use default
      if (!options.quality) {
        command.outputOptions([
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-movflags",
          "+faststart", // Web optimization
        ])
      } else {
        command = this.applyQualityOptions(command, options)
        command.outputOptions([
          "-map",
          "0:v:0",
          "-map",
          "1:a:0",
          "-c:a",
          "aac",
          "-movflags",
          "+faststart", // Web optimization
        ])
      }
      command
        .on("start", (commandLine: string) => {
          this.emit("start", { commandLine, jobId })
        })
        .on("stderr", (stderrLine: string) => {
          // Only process lines that contain FFmpeg progress information
          if (stderrLine.includes("frame=") && stderrLine.includes("time=")) {
            const parsedProgress = FFmpegUtils.parseProgressLine({
              line: stderrLine,
              totalDuration: jobInfo.totalDuration,
            })
            this.handleProgressUpdate(jobId, parsedProgress)
          }
        })
        .on("error", (err: Error) => {
          // Emit error with structured data
          const errorResponse: ErrorResponse = {
            jobId,
            success: false,
            error: err.message,
            timeElapsed: Math.floor((Date.now() - jobInfo.startTime) / 1000),
          }

          this.emit("error", errorResponse)
          reject(err)
        })
        .on("end", () => {
          // Get final stats
          const timeElapsed = Math.floor((Date.now() - jobInfo.startTime) / 1000)

          // Get file size
          let size = 0
          try {
            size = fs.statSync(outputPath).size
          } catch (e) {
            // Silent catch
          }

          // Create completion response
          const completionResponse: CompletionResponse = {
            jobId,
            success: true,
            outputPath: outputPath,
            timeElapsed,
            size,
            bitrate: jobInfo.lastProgress?.bitrate,
            averageSpeed: jobInfo.lastProgress?.speed,
          }

          this.emit("end", completionResponse)
          resolve(outputPath)
        })

      // Store command for potential cancellation
      jobInfo.command = command

      // Start processing
      command.save(outputPath)
    })
  }

  // Download image
  private downloadImage(jobId: string, options: FFmpegDownloadOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const jobInfo = this.jobs.get(jobId)!
      const url = options.url as string
      const outputPath = jobInfo.outputPath

      const command = ffmpeg(url)
        .inputOption("-reconnect 1")
        .inputOption("-reconnect_streamed 1")
        .inputOption("-reconnect_delay_max 5")
        .outputOptions(["-frames:v 1"])

      // Apply scaling if specified
      if (options.scale) {
        command.outputOptions([`-vf scale=iw*${options.scale}:ih*${options.scale}`])
      }

      // Apply custom options
      if (options.customOptions && Array.isArray(options.customOptions)) {
        command.outputOptions(options.customOptions)
      }

      command
        .on("start", (commandLine: string) => {
          this.emit("start", { commandLine, jobId })
        })
        .on("progress", () => {
          // For images, use simplified progress reporting
          const timeElapsed = Math.floor((Date.now() - jobInfo.startTime) / 1000)

          // Create simplified progress response
          const progressData: ProgressData = {
            percent: 50, // Mid-processing
            eta: "almost done",
            timeElapsed,
          }

          this.handleProgressUpdate(jobId, progressData)
        })
        .on("error", (err: Error) => {
          // Emit error with structured data
          const errorResponse: ErrorResponse = {
            jobId,
            success: false,
            error: err.message,
            timeElapsed: Math.floor((Date.now() - jobInfo.startTime) / 1000),
          }

          this.emit("error", errorResponse)
          reject(err)
        })
        .on("end", () => {
          // Get final stats
          const timeElapsed = Math.floor((Date.now() - jobInfo.startTime) / 1000)

          // Get file size
          let size = 0
          try {
            size = fs.statSync(outputPath).size
          } catch (e) {
            // Silent catch
          }



          // Create completion response
          const completionResponse: CompletionResponse = {
            jobId,
            success: true,
            outputPath,
            timeElapsed,
            size,
          }

          this.emit("end", completionResponse)
          resolve(outputPath)
        })

      // Store command for potential cancellation
      jobInfo.command = command

      // Start processing
      command.save(outputPath)
    })
  }

  // Job management methods

  // Get information about a specific job
  public getJobInfo(jobId: string): JobInfo | null {
    // First check active jobs
    const activeJob = this.jobs.get(jobId)
    if (activeJob) {
      return {
        jobId: jobId,
        type: activeJob.options.type,
        percent: activeJob.lastProgress?.percent || 0,
        startTime: activeJob.startTime,
        timeElapsed: Math.floor((Date.now() - activeJob.startTime) / 1000),
        outputPath: activeJob.outputPath,
        eta: activeJob.lastProgress?.eta,
        status: activeJob.status,
        size: activeJob.size,
        bitrate: activeJob.lastProgress?.bitrate,
        speed: activeJob.lastProgress?.speed,
      }
    }

    // Then check completed jobs
    const completedJob = this.completedJobs.get(jobId)
    if (completedJob) {
      return completedJob
    }

    // Finally check queue
    const queuedJobIndex = this.jobQueue.findIndex((job) => job.jobId === jobId)
    if (queuedJobIndex !== -1) {
      const queuedJob = this.jobQueue[queuedJobIndex]
      return {
        jobId: queuedJob.jobId,
        type: queuedJob.options.type,
        percent: 0,
        startTime: 0, // Not started yet
        timeElapsed: 0,
        outputPath: "",
        eta: "queued",
        status: "queued",
        title: queuedJob.options.title,
        platformUrl: queuedJob.options.platformUrl,
        queuePosition: queuedJobIndex + 1,
      }
    }

    // Job not found
    return null
  }

  // Get all active jobs
  public getActiveJobs(): JobInfo[] {
    const activeJobs: JobInfo[] = []

    this.jobs.forEach((job, jobId) => {
      activeJobs.push({
        jobId,
        type: job.options.type,
        percent: job.lastProgress?.percent || 0,
        startTime: job.startTime,
        timeElapsed: Math.floor((Date.now() - job.startTime) / 1000),
        outputPath: job.outputPath,
        eta: job.lastProgress?.eta,
        status: job.status,
        size: job.size,
        bitrate: job.lastProgress?.bitrate,
        speed: job.lastProgress?.speed,
        title: job.options.title,
        platformUrl: job.options.platformUrl,
        options: job.options,
      })
    })

    return activeJobs
  }

  // Get queued jobs
  public getQueuedJobs(): JobInfo[] {
    return this.jobQueue.map((job, index) => {
      return {
        jobId: job.jobId,
        type: job.options.type,
        percent: 0,
        startTime: 0, // Not started yet
        timeElapsed: 0,
        outputPath: job.options.outputPath || "",
        title: job.options.title,
        platformUrl: job.options.platformUrl,
        eta: "queued",
        status: "queued" as JobStatus,
        queuePosition: index + 1,
      }
    })
  }

  // Get completed jobs
  public getCompletedJobs(): JobInfo[] {
    return Array.from(this.completedJobs.values())
  }

  // Get all jobs (active, queued, and completed)
  public getAllJobs(): JobInfo[] {
    return [...this.getActiveJobs(), ...this.getQueuedJobs(), ...this.getCompletedJobs()]
  }

  // Cancel a job if it's still downloading or queued
  public cancelJob(jobId: string): boolean {
    // Check active jobs first
    const job = this.jobs.get(jobId);

    // Handle active jobs (downloading or potentially in the 'starting' phase)
    // Added "processing" in case you use that status briefly before "downloading"
    if (job && (job.status === "downloading" || job.status === "processing")) {
      let killed = false;
      let killAttempted = false;

      // Attempt to kill the FFmpeg process if the command object exists
      if (job.command && typeof job.command.kill === "function") {
        killAttempted = true;
        try {
          job.command.kill("SIGKILL"); // Use SIGKILL for forceful termination
          killed = true;
          console.log(`Successfully sent SIGKILL to FFmpeg process for job ${jobId}`);
        } catch (killError) {
          console.error(`Error trying to kill FFmpeg process for job ${jobId}:`, killError);
          // Proceed with cancellation logic even if kill fails
        }
      } else {
         console.log(`Job ${jobId} status is '${job.status}', but FFmpeg command object not yet available or kill method missing. Proceeding to mark as cancelled.`);
         // Cannot kill the process directly yet, but we will prevent it from completing normally.
      }

      // --- Crucial Part ---
      // Mark the job as cancelled regardless of whether the kill signal was sent or succeeded.
      // This prevents further progress updates and ensures it's treated as cancelled internally.
      job.status = "cancelled";

      // Move to completed jobs (this also removes it from the active 'jobs' map)
      this.addToCompletedJobs(jobId);

      // Delete the potentially incomplete file
      try {
        if (job.outputPath && fs.existsSync(job.outputPath)) { // Check if outputPath exists
          fs.unlinkSync(job.outputPath);
          console.log(`Deleted potentially incomplete file: ${job.outputPath}`);
        }
      } catch (error) {
        console.error(`Failed to delete incomplete file: ${job.outputPath}`, error);
      }

      // Emit cancellation event
      this.emit("job:cancelled", {
        jobId,
        timeElapsed: Math.floor((Date.now() - job.startTime) / 1000),
        wasQueued: false,
        killAttempted: killAttempted,
        killedProcess: killed,
      });
      console.log(`Job ${jobId} marked as cancelled.`);

      // The 'finally' block in processDownload/processQueue should handle decrementing activeJobCount.
      // Trigger queue processing to potentially start the next job now that this one is considered finished.
      this.processQueue();

      return true; // Indicate cancellation was processed successfully internally
    }

    // Check if job is in queue (this part seems okay)
    const queueIndex = this.jobQueue.findIndex((item) => item.jobId === jobId);
    if (queueIndex !== -1) {
      // Remove from queue
      const [removedJob] = this.jobQueue.splice(queueIndex, 1);

      // Also update the status in the main 'jobs' map where it was initially added with 'queued' status
      const jobInfo = this.jobs.get(jobId); // It should exist here
      if (jobInfo) {
        jobInfo.status = "cancelled";
        this.addToCompletedJobs(jobId); // Move from active map (where it has status 'queued' or 'cancelled') to completed map
      } else {
        // This case might happen if cancellation is extremely fast, but log it.
        console.warn(`Job ${jobId} was in queue but not found in the main jobs map during queue cancellation.`);
      }

      // Emit cancellation event
      this.emit("job:cancelled", {
        jobId,
        timeElapsed: 0, // No time elapsed as it was queued
        wasQueued: true,
        killAttempted: false,
        killedProcess: false,
      });
      console.log(`Job ${jobId} removed from queue and marked as cancelled.`);

      // Update queue positions for remaining jobs
      this.jobQueue.forEach((job, index) => {
        this.emit("queue:update", {
          jobId: job.jobId,
          position: index + 1,
          queueLength: this.jobQueue.length,
          status: "queued",
        });
      });

      // No need to call processQueue here, removing from queue doesn't free an active slot.
      return true;
    }

    // Job not found in active or queued state
    console.log(`Job ${jobId} not found in active jobs or queue for cancellation. It might be already completed or errored.`);
    return false;
  }



  // Clean up old completed jobs
  public cleanupCompletedJobs(maxAgeMs = 1 * 60 * 60 * 1000): void {
    // Default 1 hour
    const now = Date.now()

    this.completedJobs.forEach((job, id) => {
      const jobAge = job.startTime ? now - job.startTime : 0
      if (jobAge > maxAgeMs) {
        this.completedJobs.delete(id)
      }
    })
  }

  // Retry a failed job
  public async retryJob(jobId: string): Promise<JobResponse | null> {
    // Check if job exists in completed jobs
    const completedJob = this.completedJobs.get(jobId)
    if (!completedJob || (completedJob.status !== "error" && completedJob.status !== "cancelled")) {
      return null
    }

    // Remove the job from completed jobs
    this.completedJobs.delete(jobId)

    // Start a new job with the same options
    try {
      // Get options from original job and retry
      const options = completedJob.options
      if (!options) return null

      // Download with original options
      return await this.download(options)
    } catch (error) {
      console.error("Failed to retry job:", error)
      return null
    }
  }

  // Clear the queue
  public clearQueue(): number {
    const queueLength = this.jobQueue.length

    // Cancel all queued jobs
    for (const queuedJob of this.jobQueue) {
      const jobInfo = this.jobs.get(queuedJob.jobId)
      if (jobInfo) {
        jobInfo.status = "cancelled"
        this.addToCompletedJobs(queuedJob.jobId)

        this.emit("job:cancelled", {
          jobId: queuedJob.jobId,
          timeElapsed: 0,
          wasQueued: true,
        })
      }
    }

    // Clear the queue
    this.jobQueue = []

    // Emit queue cleared event
    this.emit("queue:cleared", {
      clearedJobs: queueLength,
    })

    return queueLength
  }

  // Fix the updateSettings method to properly apply all settings
  public updateSettings(): void {
    // Get the latest settings
    this.settings = settingsService.getSettings()

    // Update queue-related settings
    this.cooldownTime = this.settings.ffmpeg.cooldownTimeBetweenJobs * 1000 // Convert to milliseconds
    this.maxConcurrentJobs = this.settings.ffmpeg.maxConcurrentJobs
    this.maxCompletedJobs = this.settings.ffmpeg.maxCompletedJobsToKeep


    // Try to process queue in case we increased the limit
    this.processQueue()
  }
}

// Export a singleton instance
export default new FFmpegService()

