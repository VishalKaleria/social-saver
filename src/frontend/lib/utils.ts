import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

export function formatDuration(seconds: number) {
  if (!seconds) return "Unknown"

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
}

export function getFormatLabel(format: any, type = "combined") {
  if (!format) return "Unknown format"

  if (type === "audio") {
    const formatNote = format.format_note || ""
    const formatId = format.format_id || ""
    const ext = format.ext || ""
    const bitrate = format.abr || format.tbr || 0

    return `${formatNote || formatId} (${ext}) - ${bitrate}kbps`
  }

  const resolution = format.resolution || (format.width && format.height ? `${format.width}x${format.height}` : "N/A")
  const fps = format.fps ? `${format.fps}fps` : ""
  const codec = format.vcodec && format.vcodec !== "none" ? format.vcodec : ""
  const ext = format.ext || ""

  return `${resolution} ${fps} ${codec} (${ext})`.trim().replace(/\s+/g, " ")
}

 export function formatDate (timestamp?: number)  {
    if (!timestamp) return "Unknown"
    const date = new Date(timestamp)
    return new Intl.DateTimeFormat("default", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }).format(date)
  }



export function formatTime(seconds: number): string {
  if (!seconds) return '0s';
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  const parts = [];
  
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}