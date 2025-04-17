import * as path from "path"
import * as fs from "fs"
import { v4 as uuidv4 } from "uuid"
import type { MediaType } from "@/types/FfmpegCore"
import settingsService from "./settings-service"
import type { YtDlpAudioVideoMetadata } from "@/types"
import ffmpegService from "./ffmpeg-service"

export class FFmpegUtils {
  /**
   * Generate a unique job ID
   */
  static generateJobId(): string {
    return uuidv4()
  }


  /**
   * Calculate ETA based on progress percentage and elapsed time
   */
  static calculateETA({
    percent,
    startTime,
    speed,
  }: {
    percent: number
    startTime: number
    speed?: number
  }): string {
    if (percent <= 0) return "estimating..."

    const elapsedMs = Date.now() - startTime
    const totalEstimatedMs = (elapsedMs / percent) * 100
    const remainingMs = totalEstimatedMs - elapsedMs

    return this.formatTime(remainingMs)
  }

  /**
   * Format milliseconds as a human-readable time string
   */
  static formatTime(ms: number): string {
    if (ms < 0) ms = 0

    const seconds = Math.floor(ms / 1000) % 60
    const minutes = Math.floor(ms / (1000 * 60)) % 60
    const hours = Math.floor(ms / (1000 * 60 * 60))

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  /**
   * Parse FFmpeg progress line to extract progress information
   */
  static parseProgressLine({
    line,
    totalDuration,
  }: {
    line: string
    totalDuration?: number
  }): {
    frames?: number
    fps?: number
    time?: string
    timemark?: string
    percent?: number
    size?: number
    bitrate?: string
    speed?: number
  } {
    const result: any = {}

    // Extract frames
    const framesMatch = line.match(/frame=\s*(\d+)/)
    if (framesMatch) {
      result.frames = Number.parseInt(framesMatch[1], 10)
    }

    // Extract fps
    const fpsMatch = line.match(/fps=\s*(\d+)/)
    if (fpsMatch) {
      result.fps = Number.parseInt(fpsMatch[1], 10)
    }

    // Extract time
    const timeMatch = line.match(/time=\s*(\d+:\d+:\d+\.\d+)/)
    if (timeMatch) {
      result.time = timeMatch[1]
      result.timemark = timeMatch[1]

      // Calculate percent if we have total duration
      if (totalDuration) {
        const timeParts = timeMatch[1].split(":")
        const hours = Number.parseInt(timeParts[0], 10)
        const minutes = Number.parseInt(timeParts[1], 10)
        const seconds = Number.parseFloat(timeParts[2])

        const currentSeconds = hours * 3600 + minutes * 60 + seconds
        result.percent = Math.min(100, Math.round((currentSeconds / totalDuration) * 100))
      }
    }

    // Extract size
    const sizeMatch = line.match(/size=\s*(\d+)kB/)
    if (sizeMatch) {
      result.size = Number.parseInt(sizeMatch[1], 10) * 1024 // Convert to bytes
    }

    // Extract bitrate
    const bitrateMatch = line.match(/bitrate=\s*(\d+\.\d+)kbits\/s/)
    if (bitrateMatch) {
      result.bitrate = `${bitrateMatch[1]} kbps`
    }

    // Extract speed
    const speedMatch = line.match(/speed=\s*(\d+\.\d+)x/)
    if (speedMatch) {
      result.speed = Number.parseFloat(speedMatch[1])
    }

    return result
  }
}

