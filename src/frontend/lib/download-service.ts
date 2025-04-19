import type { YtDlpAudioVideoMetadata, VideoFormat, CombinedFormat, AudioFormat, FormatArray } from "@/types"
import type { DownloadType, DownloadFilter, FFmpegDownloadOptions } from "@/types/FfmpegCore"

// Helper function to find format by ID
export const findFormatById = (formats: FormatArray | undefined, id: string) => {
  return formats?.find((f) => f.format_id === id)
}

// Helper function to validate URLs
export const isValidUrl = (url: string): boolean => {
  if (!url || url.trim().length === 0) return false
  try {
    if (!/^[a-z][a-z0-9+.-]*:/.test(url.trim().toLowerCase())) {
      new URL(`https://${url.trim()}`)
    } else {
      new URL(url.trim())
    }
    return true
  } catch (err) {
    return false
  }
}

// Helper function to get closest quality match
const getClosestQuality = (formats: Array<{ height?: number | null }>, targetQuality: number, preferHigher = false) => {
  if (formats.length === 0) return null

  // Sort by quality (height)
  const sorted = [...formats].sort((a, b) => (b.height || 0) - (a.height || 0))

  // Exact match
  const exactMatch = sorted.find((f) => f.height === targetQuality)
  if (exactMatch) return exactMatch

  if (preferHigher) {
    // Find first format with higher quality
    const higher = sorted.find((f) => (f.height || 0) > targetQuality)
    return higher || sorted[sorted.length - 1] // fallback to lowest if none higher
  } else {
    // Find first format with lower quality
    const lower = sorted.find((f) => (f.height || 0) < targetQuality)
    return lower || sorted[0] // fallback to highest if all are higher
  }
}

// Helper function to select audio quality
const selectAudioQuality = (
  formatsList: (AudioFormat | CombinedFormat)[],
  quality: "high" | "medium" | "low" = "high",
): AudioFormat | CombinedFormat | undefined => {
  if (!formatsList || formatsList.length === 0) return undefined

  // Sort by effective audio bitrate (best first) - prioritize ABR, fallback TBR
  formatsList.sort((a:AudioFormat, b: AudioFormat) => (b.abr || b.tbr || 0) - (a.abr || a.tbr || 0))

  const thresholds = { high: 128, medium: 64, low: 0 }

  switch (quality) {
    case "high":
      // Find first >= high threshold, or fallback to the absolute best if none meet threshold
      return formatsList.find((f: AudioFormat) => (f.abr || f.tbr || 0) >= thresholds.high) || formatsList[0]
    case "medium":
      // Find first in medium range, or fallback to the absolute best if none meet threshold
      return (
        formatsList.find(
          (f: AudioFormat) => (f.abr || f.tbr || 0) >= thresholds.medium && (f.abr || f.tbr || 0) < thresholds.high,
        ) || formatsList[0]
      )
    case "low":
      // Find first in low range, or fallback to the absolute worst if none meet threshold
      return (
        formatsList.find((f:AudioFormat) => (f.abr || f.tbr || 0) > thresholds.low && (f.abr || f.tbr || 0) < thresholds.medium) ||
        formatsList[formatsList.length - 1]
      )
    default:
      return formatsList[0] // Default to best
  }
}

// Main format selection function
// Main format selection function - REVISED
export const selectFormat = (
  data: YtDlpAudioVideoMetadata,
  type: DownloadType,
  filter?: DownloadFilter,
  byId?: { formatId?: string; videoFormatId?: string; audioFormatId?: string },
): {
  ffmpegOptions?: Partial<FFmpegDownloadOptions>
  error?: string
  skip?: boolean
} => {
  // Use the processed format lists from the metadata object
  const formats = data.formats // This now contains the structured data
  if (
    !formats ||
    (!formats.videoOnlyFormats?.length && !formats.audioOnlyFormats?.length && !formats.combinedFormats?.length)
  ) {
    return {
      error: "No downloadable formats found in processed metadata.",
      skip: true,
    }
  }

  let selectedVideoFormat: VideoFormat | undefined // Only truly video-only
  let selectedAudioFormat: AudioFormat | undefined // Only truly audio-only
  let selectedCombinedFormat: CombinedFormat | undefined // Pre-combined or explicitly combined

  // --- By ID Method ---
  if (byId) {
    if (type === "video" && byId.videoFormatId && byId.audioFormatId) {
      // Find video in videoOnlyFormats and audio in audioOnlyFormats
      selectedVideoFormat = formats.videoOnlyFormats?.find((f) => f.format_id === byId.videoFormatId)
      selectedAudioFormat = formats.audioOnlyFormats?.find((f) => f.format_id === byId.audioFormatId)
      if (!selectedVideoFormat || !selectedAudioFormat) {
        return {
          error: "Specified video or audio format ID not found in their respective lists.",
          skip: true,
        }
      }
      // No need to check vcodec/acodec here as they are already classified
    } else if (type === "muteVideo" && byId.videoFormatId) {
      // Find in videoOnly OR combined, as both have video
      selectedVideoFormat = formats.videoOnlyFormats?.find((f) => f.format_id === byId.videoFormatId) ||
      formats.combinedFormats?.find((f) => f.format_id === byId.videoFormatId) as VideoFormat
      if (!selectedVideoFormat) {
        return {
          error: "Specified video format ID not found in video-only or combined lists.",
          skip: true,
        }
      }
    } else if (type === "audio" && byId.formatId) {
      // Find in audioOnly OR combined, as both *can* have audio
      selectedAudioFormat = (formats.audioOnlyFormats?.find((f) => f.format_id === byId.formatId) ||
        formats.combinedFormats?.find((f) => f.format_id === byId.formatId)) as AudioFormat
      if (!selectedAudioFormat) {
        return {
          error: "Specified audio format ID not found in audio-only or combined lists.",
          skip: true,
        }
      }
    } else if (type === "combined" && byId.formatId) {
      // *** CRITICAL CHANGE HERE ***
      // Find the format specifically within the `combinedFormats` list generated by the handler
      selectedCombinedFormat = formats.combinedFormats?.find((f) => f.format_id === byId.formatId)
      if (!selectedCombinedFormat) {
        // If not found in combined, maybe it was misclassified? Or it's a legacy YT combined?
        // Let's check uniqueFormats as a fallback, but prioritize the processed list.
        const uniqueCheck = findFormatById(formats.allUniqueFormats, byId.formatId)
        if (uniqueCheck && uniqueCheck.vcodec !== "none" && uniqueCheck.acodec !== "none") {
          console.warn(`Format ${byId.formatId} requested as combined, found in unique but not combined list. Using it.`)
          selectedCombinedFormat = uniqueCheck as CombinedFormat // Use with caution
        } else {
          return {
            error: `Specified format ID (${byId.formatId}) not found in the processed combined formats list.`,
            skip: true,
          }
        }
      }
      // No need for vcodec/acodec check here if found in combinedFormats list
    } else {
      return {
        error: "Missing or invalid format IDs for 'byId' method and specified type.",
        skip: true,
      }
    }
  }
  // --- By Filter Method ---
  else if (filter) {
    // --- Video Type --- (Requires merging video-only and audio-only)
    if (type === "video") {
      if (!formats.videoOnlyFormats?.length || !formats.audioOnlyFormats?.length) {
        return {
          error: "Separate video and audio streams required for merge, but not available.",
          skip: true,
        }
      }
      const videoCandidates = formats.videoOnlyFormats
      const audioCandidates = formats.audioOnlyFormats

      // Select Video based on quality
      const qualitySetting = filter.videoMaxQuality
      if (typeof qualitySetting === "number") {
        selectedVideoFormat = getClosestQuality(videoCandidates, qualitySetting, true) as VideoFormat | undefined
        if (!selectedVideoFormat)
          return {
            error: `No video stream found matching quality ${qualitySetting}p or higher.`,
            skip: true,
          }
      } else {
        // Default to highest quality video-only
        selectedVideoFormat = videoCandidates.sort((a, b) => (b.height || 0) - (a.height || 0))[0]
      }

      // Select Audio based on quality
      selectedAudioFormat = selectAudioQuality(audioCandidates, filter.audioQuality || "high") as AudioFormat | undefined
      if (!selectedAudioFormat) {
        // This shouldn't happen if audioCandidates was not empty, but safeguard
        return { error: "Failed to select an audio stream for merging.", skip: true }
      }
    }
    // --- Mute Video Type --- (Can use video-only or combined)
    else if (type === "muteVideo") {
      const videoCandidates = [
        ...(formats.videoOnlyFormats || []),
        ...(formats.combinedFormats || []), // Include combined as they have video
      ]
      if (!videoCandidates.length) {
        return { error: "No streams with video found.", skip: true }
      }

      const qualitySetting = filter.videoMaxQuality
      if (typeof qualitySetting === "number") {
        selectedVideoFormat = getClosestQuality(videoCandidates, qualitySetting, true) as VideoFormat
        if (!selectedVideoFormat)
          return {
            error: `No video stream found matching quality ${qualitySetting}p or higher.`,
            skip: true,
          }
      } else {
        selectedVideoFormat = videoCandidates.sort((a, b) => (b.height || 0) - (a.height || 0))[0] as VideoFormat
      }
    }
    // --- Audio Type --- (Prioritize audio-only, fallback to combined)
    else if (type === "audio") {
      let audioCandidate: AudioFormat | CombinedFormat | undefined
      if (formats.audioOnlyFormats?.length) {
        audioCandidate = selectAudioQuality(formats.audioOnlyFormats, filter.audioQuality || "high")
      } else if (formats.combinedFormats?.length) {
        // If no audio-only, try selecting best audio from combined
        console.warn("No audio-only streams found, selecting best audio from combined formats.")
        audioCandidate = selectAudioQuality(formats.combinedFormats, filter.audioQuality || "high")
      }

      if (!audioCandidate) {
        return { error: "No streams with audio found.", skip: true }
      }

      // Assign to correct variable based on whether it was audio-only or combined
      if (audioCandidate.vcodec === "none") {
        selectedAudioFormat = audioCandidate as AudioFormat
      } else {
        selectedCombinedFormat = audioCandidate as CombinedFormat // Will download combined and potentially extract audio later if needed
      }
    }
    // --- Combined Type --- (Prioritize combined, fallback to merge)
    else if (type === "combined") {
      if (formats.combinedFormats?.length) {
        // Select from available combined formats
        const combinedCandidates = formats.combinedFormats
        const qualitySetting = filter.videoMaxQuality
        if (typeof qualitySetting === "number") {
          selectedCombinedFormat = getClosestQuality(combinedCandidates, qualitySetting, true) as CombinedFormat | undefined // Prefer higher for combined
          if (!selectedCombinedFormat) {
             // Fallback to absolute best combined if quality match failed
              console.warn(`No combined format found for quality ${qualitySetting}p or higher, falling back to best available combined.`);
              selectedCombinedFormat = combinedCandidates.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
          }
        } else {
          selectedCombinedFormat = combinedCandidates.sort((a, b) => (b.height || 0) - (a.height || 0))[0]
        }
      } else {
        // Fallback: No combined formats, try merging video+audio like 'video' type
        console.warn("No combined formats available, attempting to merge best video and audio.")
        const mergeResult = selectFormat(data, "video", filter) // Recursive call for merge logic
        if (!mergeResult.ffmpegOptions || mergeResult.error || mergeResult.skip) {
          return {
            error: "No combined formats available and merging separate streams failed.",
            skip: true,
          }
        }
        // If merge succeeded, return its options directly
        return mergeResult
      }
    }
  } else {
    return {
      error: "Invalid download configuration: specify 'byId' or 'filter'.",
      skip: true,
    }
  }

  // --- Construct FFmpeg Options ---
  const ffmpegOptions: Partial<FFmpegDownloadOptions> = {
    title: data.title || data.id, // Use ID as fallback title
    platformUrl: data.webpage_url || data.original_url, // Prefer webpage_url
    metadata: data, // Pass the full metadata object
  }

  // Determine final options based on selected formats
  if (selectedCombinedFormat && (type === "combined" || type === "audio")) {
    // If audio type selected a combined format, treat it as combined for download
    // FFmpeg Core can handle extraction if needed based on type='audio' later
    ffmpegOptions.type = "combined" // Always download the full combined stream initially
    ffmpegOptions.url = selectedCombinedFormat.url
    ffmpegOptions.size = selectedCombinedFormat.filesize || selectedCombinedFormat.filesize_approx || 0
    ffmpegOptions.formatId = selectedCombinedFormat.format_id
  } else if (selectedVideoFormat && selectedAudioFormat && type === "video") {
    // Standard video+audio merge
    ffmpegOptions.type = "video" // Indicates merge needed
    ffmpegOptions.url = {
      video: selectedVideoFormat.url,
      audio: selectedAudioFormat.url,
    }
    const videoSize = selectedVideoFormat.filesize || selectedVideoFormat.filesize_approx || 0
    const audioSize = selectedAudioFormat.filesize || selectedAudioFormat.filesize_approx || 0
    ffmpegOptions.size = videoSize + audioSize
    ffmpegOptions.formatId = `${selectedVideoFormat.format_id}+${selectedAudioFormat.format_id}` // Standard format for merged
  } else if (selectedVideoFormat && type === "muteVideo") {
    // Muted video download
    ffmpegOptions.type = "muteVideo"
    ffmpegOptions.url = selectedVideoFormat.url
    ffmpegOptions.size = selectedVideoFormat.filesize || selectedVideoFormat.filesize_approx || 0
    ffmpegOptions.formatId = selectedVideoFormat.format_id
  } else if (selectedAudioFormat && type === "audio") {
    // Audio-only stream download
    ffmpegOptions.type = "audio"
    ffmpegOptions.url = selectedAudioFormat.url
    ffmpegOptions.size = selectedAudioFormat.filesize || selectedAudioFormat.filesize_approx || 0
    ffmpegOptions.formatId = selectedAudioFormat.format_id
  } else {
    // If we reach here, something went wrong in the selection logic
    console.error("Selection logic failed. Selected formats:", {
      selectedVideoFormat,
      selectedAudioFormat,
      selectedCombinedFormat,
      requestedType: type,
    })
    return {
      error: "Internal error: Failed to determine final download options after format selection.",
      skip: true,
    }
  }

  // Validate the final URL(s)
  const urlToValidate = typeof ffmpegOptions.url === "string" ? ffmpegOptions.url : ffmpegOptions.url?.video // Check at least one URL
  if (!urlToValidate || !isValidUrl(urlToValidate)) {
    return { error: "Selected format has an invalid or missing URL.", skip: true }
  }

  return { ffmpegOptions }
}

