// TODO: intigrate virtulization in playlist rows so we can process high amount of media at once without cuasing performance issue

import { cn, formatBytes, formatDuration, formatTime } from "@/lib/utils";
import React, {
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
  useReducer,
  ReactNode,
} from "react";
import { useDownload } from "@/context/download-context";
import type {
  YtDlpPlaylistMetadata,
  PlaylistItemMetadata,
  YtDlpAudioVideoMetadata,
  DownloadConfig as CoreDownloadConfig,
  JobInfo,
  DownloadType as CoreDownloadType,
  JobStatus,
  VideoQualityFilter,
  AudioQualityFilter,
  AudioMetadata,
} from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DownloadCloud,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  FolderOpen,
  FileText,
  XCircle,
  X,
  ListVideo,
  RefreshCw,
  Check,
  Clock,
  Music,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { debounce } from "lodash-es";
import { useGlobalContext } from "@/context/global-context";

// --- Constants & Utils ---
const DOWNLOAD_TYPES = [
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
];
const VIDEO_QUALITY_OPTIONS = [
  { value: "highest", label: "Best Available" },
  { value: "4320", label: "8K (4320p)" },
  { value: "2160", label: "4K (2160p)" },
  { value: "1440", label: "2K (1440p)" },
  { value: "1080", label: "1080p (Full HD)" },
  { value: "720", label: "720p (HD)" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
  { value: "240", label: "240p" },
  { value: "144", label: "144p" },
];
const AUDIO_QUALITY_OPTIONS = [
  { value: "high", label: "High (~160k)" },
  { value: "medium", label: "Medium (~128k)" },
  { value: "low", label: "Low (~70k)" },
];

// --- State & Types ---

interface DownloadConfig extends CoreDownloadConfig {
  platformUrl?: string;
  title?: string;
}

type DownloadItemUIMetadata = {
  _original_index?: number;
  thumbnailUrl?: string;
  duration_string?: string;
  uploader?: string;
  webpage_url?: string;
};

interface PlaylistItemState extends DownloadItemUIMetadata {
  id: string;
  title: string;
  original_url: string;
  selected: boolean;
  downloadType: CoreDownloadType;
  quality: string;
  downloadStatus: JobStatus;
  progress: number;
  jobId?: string;
  error?: string;
  outputPath?: string;
  eta?: string;
  fileSize?: number;
  speed?: number | string;
  bitrate?: string;
  timeElapsed?: number;
}

// Type for the state that will be persisted to sessionStorage
type PersistedPlaylistState = {
  playlistId: string; // To verify it's the correct playlist
  items: Array<{
    id: string; // Use ID for matching
    original_url: string; // Fallback for matching if ID changes/missing
    selected: boolean;
    downloadType: CoreDownloadType;
    quality: string;
    // Persist terminal states so they are shown correctly on reload
    downloadStatus: JobStatus; // Only 'completed', 'error', 'cancelled' might be useful here
    error?: string;
    outputPath?: string;
  }>;
  defaultDownloadType: CoreDownloadType;
  defaultVideoQuality: string;
  defaultAudioQuality: string;
  searchQuery: string;
  outputPath: string | undefined;
};

interface PlaylistDownloaderState {
  playlistId: string | null;
  playlistTitle: string;
  items: PlaylistItemState[];
  selectAllState: "all" | "none" | "indeterminate";
  defaultDownloadType: CoreDownloadType;
  defaultVideoQuality: string;
  defaultAudioQuality: string;
  searchQuery: string;
  outputPath: string | undefined;
  jobsMap: Record<string, JobInfo>;
  queueStatus: { current: number; max: number };
  isBatchDownloading: boolean;
  isProcessingCancellation: boolean;
  isInitialized: boolean; // Important: Track if initial load (including rehydration) is done
  isHydrated: boolean; // Track if state has been rehydrated from storage
}

// --- Reducer Actions ---
// (Keep existing actions, potentially add one for rehydration completion if needed)
type PlaylistAction =
  | { type: "INIT_START" }
  | {
      type: "INIT_COMPLETE";
      payload: {
        playlistId: string;
        title: string;
        items: PlaylistItemState[];
        settings: { maxJobs: number; defaultPath?: string };
        // Optional: Include rehydrated settings here
        rehydratedState?: Partial<
          Pick<
            PlaylistDownloaderState,
            | "defaultDownloadType"
            | "defaultVideoQuality"
            | "defaultAudioQuality"
            | "searchQuery"
            | "outputPath"
          >
        >;
      };
    }
  | { type: "SET_HYDRATED"; payload: boolean }
  | { type: "SET_JOBS_MAP"; payload: Record<string, JobInfo> }
  | {
      type: "SYNC_ITEM_WITH_JOB";
      payload: { itemIndex: number; jobData: JobInfo | null };
    }
  | {
      type: "APPLY_EVENT_UPDATE";
      payload: { jobId: string; update: Partial<JobInfo> };
    }
  | {
      type: "TOGGLE_SELECT_ITEM";
      payload: { itemIndex: number; checked: boolean };
    }
  | { type: "TOGGLE_SELECT_ALL"; payload: { checked: boolean } }
  | {
      type: "SET_ITEM_TYPE";
      payload: { itemIndex: number; type: CoreDownloadType };
    }
  | {
      type: "SET_ITEM_QUALITY";
      payload: { itemIndex: number; quality: string };
    }
  | { type: "SET_BULK_TYPE"; payload: CoreDownloadType }
  | { type: "SET_BULK_QUALITY"; payload: string }
  | { type: "SET_SEARCH_QUERY"; payload: string }
  | { type: "SET_OUTPUT_PATH"; payload: string | undefined }
  | { type: "SET_QUEUE_STATUS"; payload: { current: number; max?: number } }
  | { type: "BATCH_DOWNLOAD_START" }
  | { type: "BATCH_DOWNLOAD_END" }
  | { type: "CANCELLATION_PROCESS_START" }
  | { type: "CANCELLATION_PROCESS_END" }
  | { type: "MARK_ITEM_WAITING"; payload: { itemIndex: number } } // <-- New
  | {
      type: "MARK_ITEM_BACKEND_QUEUED";
      payload: { itemIndex: number; jobId: string };
    }
  | { type: "MARK_ITEM_EXTRACTING"; payload: { itemIndex: number } } // <-- New
  | { type: "MARK_ITEM_QUEUED"; payload: { itemIndex: number } }
  | { type: "ASSIGN_JOB_ID"; payload: { itemIndex: number; jobId: string } }
  | {
      type: "MARK_ITEM_DOWNLOADING";
      payload: { itemIndex: number; jobId: string };
    }
  | { type: "MARK_ITEM_ERROR"; payload: { itemIndex: number; error: string } }
  | { type: "RESET_ITEM_FOR_RETRY"; payload: { itemIndex: number } }
  | { type: "MARK_ITEM_CANCELLED_UI"; payload: { itemIndex: number } }
  | { type: "RESET_ITEM_FOR_RETRY"; payload: { itemIndex: number } };

// --- Helper Functions ---

const prepareItemState = (
  entry: PlaylistItemMetadata,
  index: number,
  defaults: { type: CoreDownloadType; videoQ: string; audioQ: string },
  savedItemState?: PersistedPlaylistState["items"][number]
): PlaylistItemState => {
  // Generate a reliable ID
  const id =
    entry.id ||
    entry.webpage_url ||
    entry.original_url ||
    `entry-${index}-${Date.now()}`;

  // Handle URL fallbacks
  const original_url =
    entry.original_url || entry.webpage_url || entry.url || "";

  // Better title handling with more fallbacks
  let displayTitle = "";

  // Try different sources for title with fallbacks
  if (entry.title) {
    displayTitle = entry.title;
  } else if ((entry as AudioMetadata).album) {
    // For audio metadata like SoundCloud
    const playlistIndex = (entry as PlaylistItemMetadata).playlist_index;
    const albumName = (entry as AudioMetadata).album;
    displayTitle = playlistIndex
      ? `(${playlistIndex}) ${albumName}`
      : albumName;
  } else if ((entry as PlaylistItemMetadata).playlist_title) {
    // If we have playlist title but no item title
    const playlistIndex = (entry as PlaylistItemMetadata).playlist_index;
    const playlistTitle = (entry as PlaylistItemMetadata).playlist_title;
    displayTitle = playlistIndex
      ? `(${playlistIndex}) ${playlistTitle}`
      : playlistTitle;
  } else {
    // Last resort fallbacks
    displayTitle = entry.id || `Item ${index + 1}`;
  }

  // Find the best thumbnail
  let bestThumbnail = entry.thumbnail || "";
  if (entry.thumbnails && entry.thumbnails.length > 0) {
    // Look for a medium-sized thumbnail first (around 90px height)
    bestThumbnail =
      entry.thumbnails.find((thumb) => thumb.height && thumb.height >= 90)
        ?.url ||
      entry.thumbnails[entry.thumbnails.length - 1].url ||
      entry.thumbnail ||
      "";
  }

  // Better duration handling
  const durationString =
    entry.duration_string ||
    (entry.duration ? formatDuration(entry.duration) : "");

  // Uploader handling with fallbacks
  const uploaderInfo =
    entry.uploader ||
    (entry as PlaylistItemMetadata).playlist_uploader ||
    (entry as AudioMetadata).album_artist ||
    (entry as AudioMetadata).artist ||
    "";

  // Create the base state with all our fallbacks
  const baseState: PlaylistItemState = {
    id: id,
    title: displayTitle,
    original_url: original_url,
    thumbnailUrl: bestThumbnail,
    duration_string: durationString,
    uploader: uploaderInfo,
    webpage_url: entry.webpage_url || entry.url || "",
    _original_index: index,
    // Default state values
    selected: false,
    downloadStatus: "idle",
    downloadType: defaults.type,
    quality: defaults.type === "video" ? defaults.videoQ : defaults.audioQ,
    progress: 0,
  };

  // Apply saved state if available
  if (savedItemState) {
    baseState.selected = savedItemState.selected;
    baseState.downloadType = savedItemState.downloadType;
    baseState.quality = savedItemState.quality;

    // Only restore terminal states - not active ones
    if (
      ["completed", "error", "cancelled"].includes(
        savedItemState.downloadStatus
      )
    ) {
      baseState.downloadStatus = savedItemState.downloadStatus;
      baseState.error = savedItemState.error;
      baseState.outputPath = savedItemState.outputPath;

      // Ensure proper progress display for completed items
      if (savedItemState.downloadStatus === "completed") {
        baseState.progress = 100;
      }
    }
  }

  return baseState;
};

const calculateSelectAll = (
  items: PlaylistItemState[]
): {
  selectAllState: "all" | "none" | "indeterminate";
  selectableCount: number;
  selectedCount: number;
} => {
  const selectableItems = items.filter((item) =>
    ["idle", "completed", "error", "cancelled"].includes(item.downloadStatus)
  );
  const selectedItems = selectableItems.filter((item) => item.selected);
  const selectableCount = selectableItems.length;
  const selectedCount = selectedItems.length;

  let selectAllState: "all" | "none" | "indeterminate" = "none";
  if (selectableCount > 0) {
    if (selectedCount === selectableCount) selectAllState = "all";
    else if (selectedCount > 0) selectAllState = "indeterminate";
  }
  return { selectAllState, selectableCount, selectedCount };
};

// --- Storage Utility Functions ---
const SESSION_STORAGE_KEY_PREFIX = "playlistDownloaderState_";

const saveStateToSession = (state: PlaylistDownloaderState) => {
  if (!state.playlistId || !state.isHydrated) {
    // Don't save if playlist ID is missing or before initial hydration is complete
    return;
  }
  try {
    const key = `${SESSION_STORAGE_KEY_PREFIX}${state.playlistId}`;
    const stateToPersist: PersistedPlaylistState = {
      playlistId: state.playlistId,
      items: state.items.map((item) => ({
        id: item.id,
        original_url: item.original_url, // Include for matching robustness
        selected: item.selected,
        downloadType: item.downloadType,
        quality: item.quality,
        // Only persist terminal states or idle
        downloadStatus: item.downloadStatus,
        error: ["error", "cancelled"].includes(item.downloadStatus)
          ? item.error
          : undefined,
        outputPath:
          item.downloadStatus === "completed" ? item.outputPath : undefined,
      })),
      defaultDownloadType: state.defaultDownloadType,
      defaultVideoQuality: state.defaultVideoQuality,
      defaultAudioQuality: state.defaultAudioQuality,
      searchQuery: state.searchQuery,
      outputPath: state.outputPath,
    };
    // console.log("Saving state to session:", key, stateToPersist); // Debugging
    sessionStorage.setItem(key, JSON.stringify(stateToPersist));
  } catch (error) {
    console.error("Failed to save state to sessionStorage:", error);
    // TODO: Optionally notify user or clear storage if quota exceeded
  }
};

// Debounce the save function to avoid excessive writes
const debouncedSaveStateToSession = debounce(saveStateToSession, 1000); // Save max once per second

const loadStateFromSession = (
  playlistId: string
): PersistedPlaylistState | null => {
  if (!playlistId) return null;
  try {
    const key = `${SESSION_STORAGE_KEY_PREFIX}${playlistId}`;
    const savedStateJSON = sessionStorage.getItem(key);
    if (savedStateJSON) {
      const savedState: PersistedPlaylistState = JSON.parse(savedStateJSON);
      // Basic validation: Check if the loaded state is for the *correct* playlist
      if (savedState && savedState.playlistId === playlistId) {
        // console.log("Loaded state from session:", key, savedState);
        return savedState;
      } else {
        console.warn(
          "Loaded state from session storage is for a different playlistId. Ignoring."
        );
        // Optionally remove the stale data
        sessionStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.error("Failed to load or parse state from sessionStorage:", error);
    // Clear potentially corrupted data
    sessionStorage.removeItem(`${SESSION_STORAGE_KEY_PREFIX}${playlistId}`);
  }
  return null;
};

// --- Reducer ---
// --- Reducer ---
const playlistReducer = (
  state: PlaylistDownloaderState,
  action: PlaylistAction
): PlaylistDownloaderState => {
  // console.log("Reducer Action:", action.type, action.payload ?? ''); // Debugging

  switch (action.type) {
    // --- Initialization and Sync Actions ---
    case "INIT_START":
      return {
        ...state,
        isInitialized: false,
        isHydrated: false,
        playlistId: null,
        playlistTitle: "Loading...",
        items: [],
        jobsMap: {},
        isBatchDownloading: false,
        isProcessingCancellation: false,
      };

    case "INIT_COMPLETE": {
      const { playlistId, title, items, settings, rehydratedState } =
        action.payload;
      const { selectAllState } = calculateSelectAll(items);
      return {
        ...state,
        isInitialized: true,
        playlistId: playlistId,
        playlistTitle: title,
        items: items,
        selectAllState: selectAllState,
        queueStatus: { ...state.queueStatus, max: settings.maxJobs },
        outputPath:
          rehydratedState?.outputPath !== undefined
            ? rehydratedState.outputPath
            : state.outputPath === undefined && settings.defaultPath
            ? settings.defaultPath
            : state.outputPath,
        defaultDownloadType:
          rehydratedState?.defaultDownloadType ?? state.defaultDownloadType,
        defaultVideoQuality:
          rehydratedState?.defaultVideoQuality ?? state.defaultVideoQuality,
        defaultAudioQuality:
          rehydratedState?.defaultAudioQuality ?? state.defaultAudioQuality,
        searchQuery: rehydratedState?.searchQuery ?? state.searchQuery,
        jobsMap: {},
      };
    }

    case "SET_HYDRATED":
      return { ...state, isHydrated: action.payload };

    case "SET_JOBS_MAP": {
      if (
        state.jobsMap === action.payload ||
        JSON.stringify(state.jobsMap) === JSON.stringify(action.payload)
      ) {
        return state;
      }
      return { ...state, jobsMap: action.payload };
    }

    case "SYNC_ITEM_WITH_JOB": {
      const { itemIndex, jobData } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;

      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      let hasChanged = false;
      let updatedItemState: PlaylistItemState;

      if (jobData) {
        const jobStatus: JobStatus = [
          "queued", // Added queued here explicitly
          "processing",
          "downloading",
          "completed",
          "error",
          "cancelled",
        ].includes(jobData.status)
          ? jobData.status
          : "error"; // Default to error if status is unknown

        // --- Prevent Reverting 'Queued/Waiting/Extracting' by Old Terminal Jobs ---
        // Check if the UI state is one that *should* be overridden by backend state
        const isCurrentStatusPreBackend = [
          "waiting",
          "extracting",
          "queued",
        ].includes(currentItem.downloadStatus);
        const isJobStatusTerminal = [
          "completed",
          "error",
          "cancelled",
        ].includes(jobStatus);
        // Check if the found job ID is different from any existing job ID on the item
        const isDifferentJobId =
          currentItem.jobId && currentItem.jobId !== jobData.jobId;
        // Check if the item has *no* jobId yet but is in a pre-backend state, and we found a terminal job (likely old)
        const isPreBackendWithoutJobIdAndFoundTerminal =
          !currentItem.jobId &&
          isCurrentStatusPreBackend &&
          isJobStatusTerminal;

        // If the UI shows a pre-backend state, and sync finds an OLD terminal job (different ID or no previous ID), ignore the status update from sync.
        if (
          (isCurrentStatusPreBackend &&
            isJobStatusTerminal &&
            isDifferentJobId) ||
          isPreBackendWithoutJobIdAndFoundTerminal
        ) {
          console.warn(
            `Sync effect: Item ${itemIndex} ('${currentItem.title}') is '${currentItem.downloadStatus}' in UI, but an old/mismatched terminal job (${jobStatus}, ID: ${jobData.jobId}) was found via sync. IGNORING status update from sync for this item.`
          );
          updatedItemState = { ...currentItem }; // Keep current state
          hasChanged = false; // No change applied
        } else {
          // --- ELSE: Proceed with Normal Sync Update Logic ---
          const itemUpdate: Partial<PlaylistItemState> = {
            downloadStatus: jobStatus, // Update status normally from jobData
            progress:
              jobData.percent ??
              (jobStatus === "completed" ? 100 : currentItem.progress),
            error:
              jobStatus === "error" ||
              (jobStatus === "cancelled" && jobData.error) // Only show error on cancelled if backend provided one
                ? jobData.error ||
                  (jobStatus === "error" ? "Unknown error" : undefined)
                : undefined,
            outputPath: jobData.outputPath,
            eta: jobData.eta,
            fileSize: jobData.size,
            speed: jobData.speed,
            bitrate: jobData.bitrate,
            timeElapsed: jobData.timeElapsed,
            jobId: jobData.jobId, // Ensure jobId is synced
            // Auto-deselect item if it's actively processing (queued, processing, downloading)
            selected: ["idle", "cancelled", "error", "completed"].includes(
              jobStatus
            )
              ? currentItem.selected
              : false,
          };

          updatedItemState = { ...currentItem, ...itemUpdate };
          hasChanged = Object.keys(itemUpdate).some(
            (key) =>
              itemUpdate[key as keyof PlaylistItemState] !==
              currentItem[key as keyof PlaylistItemState]
          );
        }
        // --- END: Prevent Reverting Logic ---
      } else {
        // --- No job found for this item in the jobsMap ---
        // Revert active backend states to 'idle' if their job disappears.
        // Keep 'waiting' and 'extracting' as they are (the batch loop should handle them)
        if (
          ["downloading", "processing", "queued"].includes(
            currentItem.downloadStatus
          )
        ) {
          console.warn(
            `Sync effect: Backend job ${
              currentItem.jobId ?? "(unknown)"
            } for item ${itemIndex} ('${
              currentItem.title
            }') disappeared. Reverting status to 'idle'.`
          );
          updatedItemState = {
            ...currentItem,
            downloadStatus: "idle", // Revert to allow retry
            progress: 0,
            error: undefined,
            jobId: undefined,
            eta: undefined,
            speed: undefined,
            timeElapsed: undefined,
            outputPath: undefined, // Clear path too
            selected: currentItem.selected, // Keep selection state
          };
          hasChanged = true;
        } else {
          // Item was already idle, terminal, waiting, or extracting.
          // Ensure jobId is cleared if it exists but no jobData found.
          if (currentItem.jobId) {
            updatedItemState = { ...currentItem, jobId: undefined };
            hasChanged = true;
          } else {
            updatedItemState = currentItem; // No change needed
          }
        }
      }

      if (hasChanged) {
        updatedItems[itemIndex] = updatedItemState;
        const { selectAllState } = calculateSelectAll(updatedItems);
        return { ...state, items: updatedItems, selectAllState };
      }
      return state;
    }

    case "APPLY_EVENT_UPDATE": {
      const { jobId, update: jobUpdate } = action.payload;
      const itemIndex = state.items.findIndex((item) => item.jobId === jobId);
      if (itemIndex === -1) return state; // No item found associated with this jobId

      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Don't apply event updates if item is in 'waiting' or 'extracting' (shouldn't happen if jobId isn't set yet)
      if (["waiting", "extracting"].includes(currentItem.downloadStatus)) {
        console.warn(
          `Ignoring event update for job ${jobId} because item ${itemIndex} is in status ${currentItem.downloadStatus}`
        );
        return state;
      }

      const itemUpdate: Partial<PlaylistItemState> = {};
      let hasChanged = false;

      const eventStatus = jobUpdate.status;
      const safeEventStatus: JobStatus | undefined =
        eventStatus &&
        [
          "queued",
          "processing",
          "downloading",
          "completed",
          "error",
          "cancelled",
        ].includes(eventStatus)
          ? eventStatus
          : undefined;

      // Apply status from event if it's different and valid
      if (safeEventStatus && safeEventStatus !== currentItem.downloadStatus) {
        itemUpdate.downloadStatus = safeEventStatus;
        hasChanged = true;
        // Clear error if status is no longer error/cancelled
        if (!["error", "cancelled"].includes(safeEventStatus)) {
          itemUpdate.error = undefined;
        }
        // Deselect if becoming active
        if (["queued", "processing", "downloading"].includes(safeEventStatus)) {
          itemUpdate.selected = false;
        }
      }

      // Apply progress
      const newProgress =
        jobUpdate.percent ??
        (safeEventStatus === "completed" ? 100 : undefined);
      if (newProgress !== undefined && newProgress !== currentItem.progress) {
        itemUpdate.progress = newProgress;
        hasChanged = true;
      }

      // Apply other fields
      const fieldsToMap: (keyof JobInfo & keyof PlaylistItemState)[] = [
        "outputPath",
        "eta",
        "fileSize",
        "speed",
        "bitrate",
        "timeElapsed",
        "error",
      ];
      fieldsToMap.forEach((field) => {
        if (
          jobUpdate[field] !== undefined &&
          jobUpdate[field] !== currentItem[field]
        ) {
          itemUpdate[field] = jobUpdate[field] as never;
          hasChanged = true;
        }
      });

      // Ensure error message is applied specifically on error/cancelled status from event
      if (
        (safeEventStatus === "error" || safeEventStatus === "cancelled") &&
        jobUpdate.error &&
        jobUpdate.error !== currentItem.error
      ) {
        itemUpdate.error = jobUpdate.error;
        hasChanged = true;
      }

      if (hasChanged) {
        updatedItems[itemIndex] = { ...currentItem, ...itemUpdate };
        const { selectAllState } = calculateSelectAll(updatedItems);
        return { ...state, items: updatedItems, selectAllState };
      }
      return state;
    }

    // --- Selection and Settings Actions (No changes) ---
    case "TOGGLE_SELECT_ITEM": {
      const { itemIndex, checked } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const itemToToggle = updatedItems[itemIndex];
      // Allow selecting/deselecting only if not actively processing by backend or frontend loop
      if (
        ["idle", "completed", "error", "cancelled"].includes(
          itemToToggle.downloadStatus
        )
      ) {
        if (itemToToggle.selected !== checked) {
          updatedItems[itemIndex] = { ...itemToToggle, selected: checked };
          const { selectAllState } = calculateSelectAll(updatedItems);
          return { ...state, items: updatedItems, selectAllState };
        }
      } else {
        console.warn(
          `Cannot toggle selection for item ${itemIndex}, status is ${itemToToggle.downloadStatus}`
        );
      }
      return state;
    }

    case "TOGGLE_SELECT_ALL": {
      const { checked } = action.payload;
      let changed = false;
      const updatedItems = state.items.map((item) => {
        // Determine if the item *should* be selected based on its status and the 'checked' command
        const canBeSelected = [
          "idle",
          "completed",
          "error",
          "cancelled",
        ].includes(item.downloadStatus);
        const targetSelectedState = canBeSelected ? checked : false; // Cannot select active items

        if (item.selected !== targetSelectedState) {
          changed = true;
          return { ...item, selected: targetSelectedState };
        }
        return item;
      });
      if (changed) {
        const { selectAllState } = calculateSelectAll(updatedItems);
        return { ...state, items: updatedItems, selectAllState };
      }
      return state;
    }

    case "SET_ITEM_TYPE": {
      const { itemIndex, type } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Allow type change only if not actively being processed
      if (
        ["idle", "completed", "error", "cancelled"].includes(
          currentItem.downloadStatus
        )
      ) {
        if (currentItem.downloadType !== type) {
          updatedItems[itemIndex] = {
            ...currentItem,
            downloadType: type,
            quality:
              type === "video"
                ? state.defaultVideoQuality
                : state.defaultAudioQuality,
          };
          return { ...state, items: updatedItems };
        }
      } else {
        console.warn(
          `Cannot change type for item ${itemIndex}, status is ${currentItem.downloadStatus}`
        );
      }
      return state;
    }

    case "SET_ITEM_QUALITY": {
      const { itemIndex, quality } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Allow quality change only if not actively being processed
      if (
        ["idle", "completed", "error", "cancelled"].includes(
          currentItem.downloadStatus
        )
      ) {
        if (currentItem.quality !== quality) {
          updatedItems[itemIndex] = { ...currentItem, quality: quality };
          return { ...state, items: updatedItems };
        }
      } else {
        console.warn(
          `Cannot change quality for item ${itemIndex}, status is ${currentItem.downloadStatus}`
        );
      }
      return state;
    }

    case "SET_BULK_TYPE": {
      const newDefaultType = action.payload;
      let changed = false;
      const updatedItems = state.items.map((item) => {
        // Apply bulk change only if item is not active
        if (
          ["idle", "completed", "error", "cancelled"].includes(
            item.downloadStatus
          )
        ) {
          const newQualityForType =
            newDefaultType === "video"
              ? state.defaultVideoQuality
              : state.defaultAudioQuality;
          if (
            item.downloadType !== newDefaultType ||
            item.quality !== newQualityForType
          ) {
            changed = true;
            return {
              ...item,
              downloadType: newDefaultType,
              quality: newQualityForType,
            };
          }
        }
        return item;
      });
      if (changed || state.defaultDownloadType !== newDefaultType) {
        return {
          ...state,
          items: updatedItems,
          defaultDownloadType: newDefaultType,
        };
      }
      return state;
    }

    case "SET_BULK_QUALITY": {
      const newDefaultQuality = action.payload;
      let changed = false;
      const updatedItems = state.items.map((item) => {
        // Apply bulk change only if item is not active and matches the current default type
        if (
          item.downloadType === state.defaultDownloadType &&
          ["idle", "completed", "error", "cancelled"].includes(
            item.downloadStatus
          ) &&
          item.quality !== newDefaultQuality
        ) {
          changed = true;
          return { ...item, quality: newDefaultQuality };
        }
        return item;
      });
      const defaultQualityUpdate =
        state.defaultDownloadType === "video"
          ? { defaultVideoQuality: newDefaultQuality }
          : { defaultAudioQuality: newDefaultQuality };
      const didDefaultQualityChange =
        (state.defaultDownloadType === "video" &&
          state.defaultVideoQuality !== newDefaultQuality) ||
        (state.defaultDownloadType === "audio" &&
          state.defaultAudioQuality !== newDefaultQuality);
      if (changed || didDefaultQualityChange) {
        return { ...state, items: updatedItems, ...defaultQualityUpdate };
      }
      return state;
    }

    case "SET_SEARCH_QUERY":
      return state.searchQuery !== action.payload
        ? { ...state, searchQuery: action.payload }
        : state;

    case "SET_OUTPUT_PATH":
      return state.outputPath !== action.payload
        ? { ...state, outputPath: action.payload }
        : state;

    case "SET_QUEUE_STATUS": {
      let changed = false;
      const newQueueStatus = { ...state.queueStatus };
      if (action.payload.current !== newQueueStatus.current) {
        newQueueStatus.current = action.payload.current;
        changed = true;
      }
      if (
        action.payload.max !== undefined &&
        action.payload.max !== newQueueStatus.max
      ) {
        newQueueStatus.max = action.payload.max;
        changed = true;
      }
      return changed ? { ...state, queueStatus: newQueueStatus } : state;
    }

    // --- Batch/Cancel/Item State Flow Actions ---
    case "BATCH_DOWNLOAD_START":
      return {
        ...state,
        isBatchDownloading: true,
        isProcessingCancellation: false,
      };

    case "BATCH_DOWNLOAD_END":
      return {
        ...state,
        isBatchDownloading: false,
        isProcessingCancellation: false,
      };

    case "CANCELLATION_PROCESS_START":
      return { ...state, isProcessingCancellation: true };

    case "CANCELLATION_PROCESS_END":
      return { ...state, isProcessingCancellation: false };

    case "MARK_ITEM_WAITING": {
      // <-- NEW ACTION HANDLER
      const { itemIndex } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Can transition to 'waiting' from 'idle' or terminal states (if retrying)
      if (
        ["idle", "error", "cancelled", "completed"].includes(
          currentItem.downloadStatus
        )
      ) {
        updatedItems[itemIndex] = {
          ...currentItem,
          downloadStatus: "waiting", // Set status to waiting
          selected: false, // Deselect when processing starts
          // Clear fields related to previous/active downloads
          progress: 0,
          error: undefined,
          jobId: undefined,
          outputPath: undefined,
          eta: undefined,
          fileSize: undefined,
          speed: undefined,
          bitrate: undefined,
          timeElapsed: undefined,
        };
        const { selectAllState } = calculateSelectAll(updatedItems);
        return { ...state, items: updatedItems, selectAllState };
      }
      console.warn(
        `Attempted to mark item ${itemIndex} ('${currentItem.title}') as waiting, but its status was ${currentItem.downloadStatus}.`
      );
      return state;
    }

    case "MARK_ITEM_EXTRACTING": {
      // <-- NEW ACTION HANDLER
      const { itemIndex } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Should only transition from 'waiting'
      if (currentItem.downloadStatus === "waiting") {
        updatedItems[itemIndex] = {
          ...currentItem,
          downloadStatus: "extracting", // Set status to extracting
          // Keep other fields as they were (cleared by 'waiting')
        };
        // No need to recalculate selectAllState as selection already false
        return { ...state, items: updatedItems };
      }
      console.warn(
        `Attempted to mark item ${itemIndex} ('${currentItem.title}') as extracting, but its status was ${currentItem.downloadStatus}.`
      );
      return state;
    }

    case "MARK_ITEM_BACKEND_QUEUED": {
      // <-- RENAMED/CHANGED ACTION HANDLER
      const { itemIndex, jobId } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];
      // Should transition from 'extracting' (after successful metadata fetch and startDownload call)
      if (["extracting"].includes(currentItem.downloadStatus)) {
        updatedItems[itemIndex] = {
          ...currentItem,
          downloadStatus: "queued", // Set status to queued (backend confirmed)
          jobId: jobId, // Store the backend job ID
          selected: false, // Ensure deselected
          // Reset progress/ETA etc. as backend will provide updates
          progress: 0,
          eta: undefined,
          speed: undefined,
          fileSize: undefined,
          timeElapsed: undefined,
        };
        const { selectAllState } = calculateSelectAll(updatedItems); // Recalculate just in case
        return { ...state, items: updatedItems, selectAllState };
      }
      console.warn(
        `Attempted to mark item ${itemIndex} ('${currentItem.title}') as backend-queued, but its status was ${currentItem.downloadStatus}.`
      );
      return state;
    }

    case "MARK_ITEM_ERROR": {
      const { itemIndex, error } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex]; // Get current item before updating

      // Set to error state, clear progress/job info etc.
      updatedItems[itemIndex] = {
        ...currentItem, // Preserve selection, type, quality etc.
        downloadStatus: "error",
        error: error,
        selected: false, // Deselect on error
        progress: 0,
        jobId: undefined, // Clear job ID on error
        eta: undefined,
        speed: undefined,
        outputPath: undefined, // Clear potentially stale path
        fileSize: undefined,
        timeElapsed: undefined,
      };
      const { selectAllState } = calculateSelectAll(updatedItems);
      return { ...state, items: updatedItems, selectAllState };
    }

    case "RESET_ITEM_FOR_RETRY": {
      const { itemIndex } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];

      // Reset to 'idle', clear all download-related state, keep config (type/quality)
      updatedItems[itemIndex] = {
        ...currentItem,
        downloadStatus: "idle", // Back to idle
        jobId: undefined,
        progress: 0,
        error: undefined,
        outputPath: undefined,
        eta: undefined,
        fileSize: undefined,
        speed: undefined,
        bitrate: undefined,
        timeElapsed: undefined,
        selected: true, // Pre-select for retry action
      };
      const { selectAllState } = calculateSelectAll(updatedItems);
      return { ...state, items: updatedItems, selectAllState };
      // console.warn(`Attempted to reset item ${itemIndex} ('${currentItem.title}') for retry, but its status was ${currentItem.downloadStatus}.`); // Keep warning if needed, but reset should be possible from most states now
      // return state;
    }

    case "MARK_ITEM_CANCELLED_UI": {
      const { itemIndex } = action.payload;
      if (itemIndex < 0 || itemIndex >= state.items.length) return state;
      const updatedItems = [...state.items];
      const currentItem = updatedItems[itemIndex];

      // Mark as cancelled only if it was in a state that *can* be cancelled
      // (waiting, extracting, queued, processing, downloading)
      if (
        [
          "waiting",
          "extracting",
          "queued",
          "processing",
          "downloading",
        ].includes(currentItem.downloadStatus)
      ) {
        updatedItems[itemIndex] = {
          ...currentItem,
          downloadStatus: "cancelled",
          jobId: undefined, // Clear job ID
          progress: 0,
          error: "Cancelled by user", // Set reason
          eta: undefined,
          fileSize: undefined,
          speed: undefined,
          bitrate: undefined,
          timeElapsed: undefined,
          selected: false, // Ensure not selected
        };
        const { selectAllState } = calculateSelectAll(updatedItems);
        return { ...state, items: updatedItems, selectAllState };
      }
      // If already idle, completed, error, or cancelled, don't change it
      return state;
    }

    default:
      // Ensure exhaustive check if possible, otherwise return state
      // const exhaustiveCheck: never = action;
      return state;
  }
};

// --- UI Components ---

const StatusBadge = memo(({ status }: { status: JobStatus }) => {
  let variant: "default" | "secondary" | "destructive" | "outline" =
    "secondary";
  let icon: ReactNode = null;
  let text = status.charAt(0).toUpperCase() + status.slice(1);
  let textColorClass = "text-foreground";
  let bgColorClass = "";

  switch (status) {
    case "waiting": // <-- ADDED CASE
      variant = "outline";
      icon = <Clock className="h-3 w-3 mr-1" />;
      textColorClass = "text-gray-600 dark:text-gray-400";
      bgColorClass =
        "bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700";
      text = "Waiting"; // Explicit text
      break;
    case "extracting": // <-- ADDED CASE
      variant = "outline";
      icon = <Loader2 className="h-3 w-3 animate-spin mr-1" />;
      textColorClass = "text-blue-600 dark:text-blue-400";
      bgColorClass =
        "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700";
      text = "Extracting"; // Explicit text
      break;
    case "queued":
      variant = "outline";
      icon = <Loader2 className="h-3 w-3 animate-spin mr-1" />;
      textColorClass = "text-blue-600 dark:text-blue-400";
      bgColorClass =
        "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700";
      break;
    case "processing":
      variant = "outline";
      icon = <Loader2 className="h-3 w-3 animate-spin mr-1" />;
      textColorClass = "text-orange-700 dark:text-orange-400";
      bgColorClass =
        "bg-orange-50 dark:bg-orange-900/30 border-orange-200 dark:border-orange-700";
      break;
    case "downloading":
      variant = "outline";
      icon = <DownloadCloud className="h-3 w-3 mr-1" />;
      textColorClass = "text-yellow-700 dark:text-yellow-400";
      bgColorClass =
        "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-700";
      break;
    case "completed":
      variant = "outline";
      icon = <CheckCircle2 className="h-3 w-3 mr-1" />;
      textColorClass = "text-green-700 dark:text-green-400";
      bgColorClass =
        "bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700";
      break;
    case "error":
      variant = "destructive";
      icon = <AlertCircle className="h-3 w-3 mr-1" />;
      break;
    case "cancelled":
      variant = "outline";
      icon = <XCircle className="h-3 w-3 mr-1" />;
      textColorClass = "text-gray-600 dark:text-gray-400";
      bgColorClass =
        "bg-gray-100 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700";
      break;
    case "idle":
      text = "Idle";
      variant = "outline";
      textColorClass = "text-muted-foreground";
      bgColorClass = "bg-background border-border";
      break;
    default:
      text = "Unknown";
      variant = "secondary";
      break;
  }

  return (
    <Badge
      variant={variant}
      className={cn(
        `whitespace-nowrap text-xs px-1.5 py-0.5 h-5 inline-flex items-center ${textColorClass} ${bgColorClass}`
      )}
    >
      {icon}
      <span className={icon ? "ml-0.5" : ""}>{text}</span>
    </Badge>
  );
});
StatusBadge.displayName = "StatusBadge";

const PlaylistItemRow = memo(
  ({
    item,
    itemIndex,
    isBatchDownloadingGlobal,
    isProcessingCancellationGlobal,
    onSelectItem,
    onTypeChange,
    onQualityChange,
    onOpenFile,
    onOpenFolder,
    onCancelJob,
    onRetryJob,
  }: {
    item: PlaylistItemState;
    itemIndex: number;
    isBatchDownloadingGlobal: boolean;
    isProcessingCancellationGlobal: boolean;
    onSelectItem: (itemIndex: number, checked: boolean) => void;
    onTypeChange: (itemIndex: number, type: CoreDownloadType) => void;
    onQualityChange: (itemIndex: number, quality: string) => void;
    onOpenFile: (path: string) => void;
    onOpenFolder: (path: string) => void;
    onCancelJob: (jobId: string) => void;
    onRetryJob: (itemIndex: number) => void;
  }) => {
    const handleCheckboxChange = useCallback(
      (checked: boolean | "indeterminate") => {
        onSelectItem(itemIndex, checked === true);
      },
      [itemIndex, onSelectItem]
    );
    const handleTypeSelect = useCallback(
      (value: string) => {
        if (value === "video" || value === "audio") {
          onTypeChange(itemIndex, value);
        }
      },
      [itemIndex, onTypeChange]
    );
    const handleQualitySelect = useCallback(
      (value: string) => onQualityChange(itemIndex, value),
      [itemIndex, onQualityChange]
    );
    const handleRetry = useCallback(
      () => onRetryJob(itemIndex),
      [itemIndex, onRetryJob]
    );
    const handleCancel = useCallback(() => {
      if (item.jobId) {
        onCancelJob(item.jobId);
      } else {
        console.warn(
          `Cancel clicked for item ${itemIndex} ('${item.title}') but no jobId found.`
        );
      }
    }, [item.jobId, itemIndex, item.title, onCancelJob]);
    const handleOpenItemFile = useCallback(() => {
      if (item.outputPath) {
        onOpenFile(item.outputPath);
      }
    }, [item.outputPath, onOpenFile]);
    const handleOpenItemFolder = useCallback(() => {
      if (item.outputPath) {
        onOpenFolder(item.outputPath);
      }
    }, [item.outputPath, onOpenFolder]);

    const isItemActivelyProcessing = [
      "queued",
      "downloading",
      "processing",
    ].includes(item.downloadStatus);
    const areFieldsDisabled =
      isItemActivelyProcessing ||
      (isBatchDownloadingGlobal && item.downloadStatus === "idle") ||
      isProcessingCancellationGlobal;
    const isCheckboxDisabled =
      isItemActivelyProcessing || isProcessingCancellationGlobal;
    const isCancelEnabled =
      isItemActivelyProcessing &&
      !!item.jobId &&
      !isProcessingCancellationGlobal;
    const isRetryEnabled =
      (["cancelled", "completed", "error"] as JobStatus[]).includes(
        item.downloadStatus
      ) &&
      !isBatchDownloadingGlobal &&
      !isProcessingCancellationGlobal;
    const isOpenEnabled =
      item.downloadStatus === "completed" && !!item.outputPath;

    return (
      <TableRow
        key={item.id}
        data-status={item.downloadStatus}
        aria-selected={item.selected}
        className={cn(
          // Use cn utility for conditional classes
          "transition-colors duration-150", // Add smooth transition
          isItemActivelyProcessing
            ? "opacity-90 bg-muted/30"
            : "hover:bg-muted/50" // Style active/hover
        )}
      >
        {/* Checkbox */}
        <TableCell className="w-12 sticky left-0 bg-background z-10 px-2 align-middle">
          <Checkbox
            id={`select-item-${itemIndex}`}
            checked={item.selected}
            onCheckedChange={handleCheckboxChange}
            disabled={isCheckboxDisabled}
            aria-labelledby={`item-title-${itemIndex}`}
          />
        </TableCell>
        {/* Index */}
        <TableCell className="w-12 text-right pr-3 text-xs text-muted-foreground font-mono align-middle">
          {item._original_index !== undefined ? item._original_index + 1 : "-"}
        </TableCell>
        {/* Item Details */}
        <TableCell className="min-w-[280px] max-w-[350px] px-2 py-1.5 align-middle">
          <div className="flex items-center gap-2.5">
            {/* Thumbnail with better fallback */}
            {item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={`Thumbnail for ${item.title || "media item"}`}
                className="h-9 w-16 object-cover rounded flex-shrink-0 border border-border"
                loading="lazy"
                width="64"
                height="36"
              />
            ) : (
              <div className="h-9 w-16 bg-secondary rounded flex items-center justify-center flex-shrink-0 border border-border">
                {item.downloadType === "audio" ? (
                  <Music className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ListVideo className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}

            <div className="flex-1 min-w-0 max-w-[450px]">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p
                      id={`item-title-${itemIndex}`}
                      className="font-medium truncate text-sm leading-tight"
                    >
                      {item.title ||
                        `Item ${
                          item._original_index !== undefined
                            ? item._original_index + 1
                            : itemIndex + 1
                        }`}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" align="start">
                    <p className="max-w-md">
                      {item.title ||
                        `Item ${
                          item._original_index !== undefined
                            ? item._original_index + 1
                            : itemIndex + 1
                        }`}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                {item.duration_string && <span>{item.duration_string}</span>}
                {item.uploader && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate max-w-[150px]">
                          by {item.uploader}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" align="start">
                        <p>by {item.uploader}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!item.duration_string && !item.uploader && (
                  <span className="text-muted-foreground/70">
                    {item.downloadType === "audio" ? "Audio" : "Video"} content
                  </span>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        {/* Status */}
        <TableCell className="w-28 px-2 align-middle">
          <div className="flex items-center">
            <StatusBadge status={item.downloadStatus} />
            {item.downloadStatus === "error" && item.error && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertCircle className="h-3.5 w-3.5 text-red-600 ml-1.5 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs break-words z-50">
                    <p className="text-xs">{item.error}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
        {/* Type Select */}
        <TableCell className="w-28 px-2 align-middle">
          <Select
            value={item.downloadType}
            onValueChange={handleTypeSelect}
            disabled={areFieldsDisabled}
          >
            <SelectTrigger
              className="h-8 text-xs w-full"
              aria-label={`Download type for ${item.title}`}
            >
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {DOWNLOAD_TYPES.map((typeOption) => (
                <SelectItem
                  key={typeOption.value}
                  value={typeOption.value}
                  className="text-xs"
                >
                  {typeOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        {/* Quality Select */}
        <TableCell className="w-36 px-2 align-middle">
          <Select
            value={item.quality}
            onValueChange={handleQualitySelect}
            disabled={areFieldsDisabled}
          >
            <SelectTrigger
              className="h-8 text-xs w-full"
              aria-label={`Download quality for ${item.title}`}
            >
              <SelectValue placeholder="Quality" />
            </SelectTrigger>
            <SelectContent>
              {(item.downloadType === "video"
                ? VIDEO_QUALITY_OPTIONS
                : AUDIO_QUALITY_OPTIONS
              ).map((qualityOption) => (
                <SelectItem
                  key={qualityOption.value}
                  value={qualityOption.value}
                  className="text-xs"
                >
                  {qualityOption.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>

        {/* Progress Cell*/}
        <TableCell className="max-w-[350px] min-w-[250px] px-2 align-middle">
          {item.downloadStatus === "downloading" && (
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex justify-between text-muted-foreground mb-0.5">
                <span
                  className="truncate mr-2"
                  title={
                    item.timeElapsed !== undefined
                      ? `Elapsed: ${item.timeElapsed.toFixed(0)}s`
                      : ""
                  }
                >
                  {item.timeElapsed !== undefined
                    ? `Elapsed: ${formatTime(item.timeElapsed)}`
                    : ""}
                </span>
                <span
                  className="truncate ml-2"
                  title={item.eta ? `ETA: ${item.eta}` : ""}
                >
                  {item.eta ? `ETA: ${item.eta}` : ""}
                </span>
              </div>
              <Progress
                value={item.progress ?? 0}
                className="h-1 w-full"
                aria-label={`Download progress ${
                  item.progress?.toFixed(0) ?? 0
                }%`}
              />
              <div className="flex justify-between text-muted-foreground mt-0.5">
                <span className="font-medium">
                  {item.progress?.toFixed(0) ?? 0}%
                </span>
                <div className="flex gap-2 items-center">
                  <span title={formatBytes(item.fileSize)}>
                    {formatBytes(item.fileSize)}
                  </span>
                </div>
              </div>
            </div>
          )}
          {item.downloadStatus === "processing" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
          {item.downloadStatus === "queued" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Queued...</span>
            </div>
          )}
          {item.downloadStatus === "completed" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span>Completed</span>
            </div>
          )}
          {item.downloadStatus === "cancelled" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span>Cancelled</span>
            </div>
          )}
          {item.downloadStatus === "error" && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
              <span>Error</span>
            </div>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell className="w-24 px-2 align-middle">
          <div className="flex items-center justify-end gap-0">
            {isOpenEnabled && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleOpenItemFile}
                        aria-label={`Open file for ${item.title}`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open File</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={handleOpenItemFolder}
                        aria-label={`Show ${item.title} in folder`}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Show in Folder</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
            {isRetryEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-blue-600 hover:text-blue-700"
                      onClick={handleRetry}
                      aria-label={`Retry download for ${item.title}`}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Retry Download</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {isCancelEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive/80" // Removed pointer-events override
                      onClick={handleCancel}
                      aria-label={`Cancel download for ${item.title}`}
                      disabled={isProcessingCancellationGlobal} // Disable during global cancellation
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cancel Download</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  },
  (prevProps, nextProps) =>
    prevProps.item === nextProps.item &&
    prevProps.itemIndex === nextProps.itemIndex &&
    prevProps.isBatchDownloadingGlobal === nextProps.isBatchDownloadingGlobal &&
    prevProps.isProcessingCancellationGlobal ===
      nextProps.isProcessingCancellationGlobal
);
PlaylistItemRow.displayName = "PlaylistItemRow";

// --- Main Component ---
interface PlaylistDownloaderProps {
  playlistData: YtDlpPlaylistMetadata;
}

const PlaylistDownloader: React.FC<PlaylistDownloaderProps> = ({
  playlistData,
}) => {
  const { startDownload, refreshJobs, cancelDownload } = useDownload();
  const { setPlaylistProcessing } = useGlobalContext();

  const initialReducerState: PlaylistDownloaderState = useMemo(
    () => ({
      isInitialized: false,
      isHydrated: false, // Start as not hydrated
      playlistId: null,
      playlistTitle: "Loading Playlist...",
      items: [],
      selectAllState: "none",
      defaultDownloadType: "video",
      defaultVideoQuality: "highest",
      defaultAudioQuality: "high",
      searchQuery: "",
      outputPath: undefined,
      jobsMap: {},
      queueStatus: { current: 0, max: 3 },
      isBatchDownloading: false,
      isProcessingCancellation: false,
    }),
    []
  );

  const [state, dispatch] = useReducer(playlistReducer, initialReducerState);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const cancellationRequestedRef = useRef(false);

  // --- Effect 1: Initialization & Rehydration ---
  useEffect(() => {
    let isMounted = true;
    console.log("Effect: Initializing PlaylistDownloader...");
    dispatch({ type: "INIT_START" });

    const initializePlaylist = async () => {
      try {
        // Determine playlist ID early to load state
        const resolvedPlaylistId =
          playlistData.entries[0].playlist_id ||
          playlistData.id ||
          playlistData.webpage_url ||
          `playlist-${Date.now()}`;
        const resolvedPlaylistTitle =
          playlistData.title ||
          playlistData.entries[0]?.playlist_title ||
          "Untitled Playlist";

        // --- Attempt to Load Saved State ---
        const savedState = loadStateFromSession(resolvedPlaylistId);

        // Prepare initial defaults, potentially overridden by saved state
        const itemDefaults = {
          type:
            savedState?.defaultDownloadType ??
            initialReducerState.defaultDownloadType,
          videoQ:
            savedState?.defaultVideoQuality ??
            initialReducerState.defaultVideoQuality,
          audioQ:
            savedState?.defaultAudioQuality ??
            initialReducerState.defaultAudioQuality,
        };

        // Create a map of saved items for quick lookup
        const savedItemsMap = new Map<
          string,
          PersistedPlaylistState["items"][number]
        >();
        if (savedState) {
          savedState.items.forEach((item) => {
            // Prefer ID for key, but fallback to URL if ID might be unstable
            const key = item.id || item.original_url;
            if (key) savedItemsMap.set(key, item);
          });
        }

        // Transform raw entries, merging with saved state where possible
        const initialItems = playlistData.entries.map((entry, index) => {
          const id = entry.id || entry.webpage_url || entry.original_url;
          const url = entry.original_url || entry.webpage_url || entry.url;
          // Try to find saved state first by ID, then by URL
          const savedItem =
            savedItemsMap.get(id) ?? (url ? savedItemsMap.get(url) : undefined);
          return prepareItemState(entry, index, itemDefaults, savedItem);
        });

        // --- Fetch Backend Settings ---
        let maxConcurrentJobs = stateRef.current.queueStatus.max; // Keep existing max if already set (e.g., from previous hydration)
        let defaultOutputPath: string | undefined = undefined;
        try {
          if (window.electronAPI?.settings?.getSettings) {
            const settingsResponse =
              await window.electronAPI.settings.getSettings();
            if (settingsResponse.success && settingsResponse.data) {
              maxConcurrentJobs =
                settingsResponse.data.ffmpeg?.maxConcurrentJobs ||
                maxConcurrentJobs;
              // Default output path from settings is only used if neither saved state nor user interaction has set one
              if (
                savedState?.outputPath === undefined &&
                stateRef.current.outputPath === undefined
              ) {
                // Assuming settings provide a path string, adjust if needed
                defaultOutputPath = ""; // Replace with actual path from settingsResponse.data if available
                console.log(
                  "Applying default output path from settings:",
                  defaultOutputPath
                );
              }
              console.log("Effect: Settings fetched", { maxConcurrentJobs });
            } else {
              console.warn(
                "Effect: Failed to fetch settings.",
                settingsResponse.message
              );
            }
          } else {
            console.warn("Effect: Settings API not available.");
          }
        } catch (settingsError) {
          console.error("Effect: Error fetching settings:", settingsError);
          toast.error("Failed to load application settings");
        }

        // --- Dispatch completion state ---
        if (isMounted) {
          dispatch({
            type: "INIT_COMPLETE",
            payload: {
              playlistId: resolvedPlaylistId,
              title: resolvedPlaylistTitle,
              items: initialItems,
              settings: {
                maxJobs: maxConcurrentJobs,
                defaultPath: defaultOutputPath, // Pass settings default path
              },
              // Pass the relevant parts of the loaded state to override defaults in the reducer
              rehydratedState: savedState
                ? {
                    defaultDownloadType: savedState.defaultDownloadType,
                    defaultVideoQuality: savedState.defaultVideoQuality,
                    defaultAudioQuality: savedState.defaultAudioQuality,
                    searchQuery: savedState.searchQuery,
                    outputPath: savedState.outputPath,
                  }
                : undefined,
            },
          });
          // Mark hydration as complete AFTER init_complete has updated the state
          dispatch({ type: "SET_HYDRATED", payload: true });
          console.log(
            "Effect: Initialization complete.",
            savedState ? "(Rehydrated)" : "(No saved state)"
          );
          await refreshAllJobsAndQueueStatus(); // Initial job sync
        }
      } catch (error) {
        console.error("Effect: Playlist initialization failed:", error);
        if (isMounted) {
          toast.error("Failed to initialize playlist downloader");
          // Potentially dispatch an error state here
        }
      }
    };

    initializePlaylist();

    return () => {
      isMounted = false;
      console.log("Effect: Init cleanup (unmounting or playlistData changed)");
      // Debounced save might still run after unmount, usually okay for sessionStorage
    };
    // Re-run ONLY if playlistData prop changes. initialReducerState is stable.
  }, [playlistData, initialReducerState]);

  // --- Effect 2: Persist State Changes to Session Storage ---
  useEffect(() => {
    // Only save state if it has been initialized and hydrated, and has a playlistId
    if (state.isInitialized && state.isHydrated && state.playlistId) {
      // Use the debounced save function
      debouncedSaveStateToSession(state);
    }
    // No cleanup needed for debounce itself usually, but ensure no memory leaks if component unmounts rapidly.
    // Lodash debounce handles timers internally.
  }, [state]); // Run whenever the main state object changes

  // --- Effect 3: Job Refresh Polling ---
  const refreshAllJobsAndQueueStatus = useCallback(async () => {
    // Use stateRef to get latest initialized status inside callback
    if (!stateRef.current.isInitialized || !window.electronAPI?.ffmpeg) {
      return;
    }
    try {
      await refreshJobs(); // Context refresh

      const [activeJobsResponse, queuedJobsResponse] = await Promise.all([
        window.electronAPI.ffmpeg.getActiveJobs(),
        window.electronAPI.ffmpeg.getQueuedJobs(),
        // window.electronAPI.ffmpeg.getCompletedJobs(),
      ]);

      const newJobsMap: Record<string, JobInfo> = {};
      let currentActiveOrQueuedCount = 0;

      activeJobsResponse.data?.activeJobs?.forEach((job) => {
        newJobsMap[job.jobId] = job;
        currentActiveOrQueuedCount++;
      });
      queuedJobsResponse.data?.queuedJobs?.forEach((job) => {
        newJobsMap[job.jobId] = job;
        currentActiveOrQueuedCount++;
      });
      // completedJobsResponse.data?.completedJobs?.forEach((job) => {
      //   if (!newJobsMap[job.jobId]) {
      //     newJobsMap[job.jobId] = job;
      //   }
      // });

      // Dispatch updates only if changed (reducer handles deep check for jobsMap)
      dispatch({ type: "SET_JOBS_MAP", payload: newJobsMap });
      dispatch({
        type: "SET_QUEUE_STATUS",
        payload: { current: currentActiveOrQueuedCount },
      });
    } catch (error) {
      console.error("Effect: Failed to refresh jobs and queue status:", error);
    }
    // refreshJobs from context is a dependency
  }, [refreshJobs]);

  useEffect(() => {
    // Use state directly here as effect dependency list handles re-running
    if (!state.isInitialized) return;

    console.log("Effect: Setting up job refresh polling interval (3.5s)");
    // Run once immediately on setup
    refreshAllJobsAndQueueStatus();
    const intervalId = setInterval(refreshAllJobsAndQueueStatus, 3500);

    return () => {
      console.log("Effect: Clearing job refresh polling interval");
      clearInterval(intervalId);
    };
    // Re-run if isInitialized changes or the refresh function changes
  }, [state.isInitialized]);

  // --- Effect 4: Sync Items with Jobs Map ---
  useEffect(() => {
    // Only run if initialized and jobsMap actually has data to sync
    if (!state.isInitialized || Object.keys(state.jobsMap).length === 0) {
      // console.log("Sync skipped: Not initialized or empty jobsMap.");
      return;
    }

    console.log("Effect: Syncing items with jobsMap...");
    const currentItems = state.items;
    const currentJobsMap = state.jobsMap;

    currentItems.forEach((item, index) => {
      let associatedJob: JobInfo | null = null;

      // Find job: prioritize jobId, fallback to URL match if needed
      if (item.jobId && currentJobsMap[item.jobId]) {
        associatedJob = currentJobsMap[item.jobId];
      } else if (item.original_url) {
        const jobFoundByUrl = Object.values(currentJobsMap).find(
          (job) => job.platformUrl === item.original_url
        );
        if (jobFoundByUrl) {
          // Ensure this job isn't already linked to another item *by jobId*
          const isJobIdAlreadyLinked = currentItems.some(
            (otherItem, otherIndex) =>
              otherIndex !== index && otherItem.jobId === jobFoundByUrl.jobId
          );
          if (!isJobIdAlreadyLinked) {
            associatedJob = jobFoundByUrl;
            if (!item.jobId) {
              // Log if we linked via URL without prior jobId
              console.warn(
                `Effect Sync: Linked item ${index} ('${item.title}') to job ${associatedJob.jobId} via URL match.`
              );
            }
          } else {
            console.warn(
              `Effect Sync: Job ${jobFoundByUrl.jobId} found by URL match for item ${index} ('${item.title}') but is already linked to another item. Ignoring potential link.`
            );
          }
        }
      }

      // Dispatch sync action (reducer handles actual state update logic)
      dispatch({
        type: "SYNC_ITEM_WITH_JOB",
        payload: { itemIndex: index, jobData: associatedJob },
      });
    });

    console.log("Effect: Item sync dispatch complete.");
    // Depend on items array reference change and jobsMap content change
  }, [state.isInitialized, state.jobsMap]);

  // --- Effect 5: FFMPEG Backend Event Listeners ---
  useEffect(() => {
    if (!state.isInitialized || !window.electronAPI?.ffmpeg?.events) {
      return () => {}; // No setup, no cleanup needed
    }

    console.log("Effect: Setting up FFMPEG backend event listeners...");

    // Debounced progress updates (from original code - seems reasonable)
    const debouncedProgressUpdates = new Map<string, Partial<JobInfo>>();
    let progressTimeoutId: NodeJS.Timeout | null = null;
    const flushProgressUpdates = () => {
      if (debouncedProgressUpdates.size > 0) {
        debouncedProgressUpdates.forEach((update, jobId) => {
          dispatch({ type: "APPLY_EVENT_UPDATE", payload: { jobId, update } });
        });
        debouncedProgressUpdates.clear();
      }
      progressTimeoutId = null;
    };
    const handleProgressEvent = (jobData: JobInfo) => {
      if (!jobData?.jobId) return;
      debouncedProgressUpdates.set(jobData.jobId, {
        status: "downloading",
        percent: jobData.percent,
        eta: jobData.eta,
        speed: jobData.speed,
        size: jobData.size,
        timeElapsed: jobData.timeElapsed,
      });
      if (!progressTimeoutId) {
        progressTimeoutId = setTimeout(flushProgressUpdates, 500);
      }
    };

    // Terminal event handlers (End, Error, Cancelled)
    const handleEndEvent = (
      jobData:
        | JobInfo
        | {
            jobId: string;
            outputPath?: string;
            size?: number;
            timeElapsed?: number;
            bitrate?: string;
          }
    ) => {
      console.log("Event: Job End received", jobData?.jobId);
      if (!jobData?.jobId) return;
      if (debouncedProgressUpdates.has(jobData.jobId)) flushProgressUpdates();
      dispatch({
        type: "APPLY_EVENT_UPDATE",
        payload: {
          jobId: jobData.jobId,
          update: {
            status: "completed",
            percent: 100,
            outputPath: jobData.outputPath,
            size: jobData.size,
            timeElapsed: jobData.timeElapsed,
            bitrate: jobData.bitrate,
            error: undefined,
          },
        },
      });
      setTimeout(refreshAllJobsAndQueueStatus, 250);
    };
    const handleErrorEvent = (
      jobData: JobInfo | { jobId: string; error?: string; timeElapsed?: number }
    ) => {
      console.error(
        "Event: Job Error received",
        jobData?.jobId,
        jobData?.error
      );
      if (!jobData?.jobId) return;
      if (debouncedProgressUpdates.has(jobData.jobId)) flushProgressUpdates();
      dispatch({
        type: "APPLY_EVENT_UPDATE",
        payload: {
          jobId: jobData.jobId,
          update: {
            status: "error",
            error: jobData.error || "Unknown error from event",
            timeElapsed: jobData.timeElapsed,
            percent: 0,
          },
        },
      });
      setTimeout(refreshAllJobsAndQueueStatus, 250);
    };
    const handleCancelledEvent = (jobData: { jobId: string }) => {
      console.log("Event: Job Cancelled received", jobData.jobId);
      if (!jobData?.jobId) return;
      if (debouncedProgressUpdates.has(jobData.jobId)) flushProgressUpdates();
      dispatch({
        type: "APPLY_EVENT_UPDATE",
        payload: {
          jobId: jobData.jobId,
          update: {
            status: "cancelled",
            percent: 0,
            error: undefined,
          },
        },
      });
      setTimeout(refreshAllJobsAndQueueStatus, 250);
    };

    // Subscribe
    const unsubProgress =
      window.electronAPI.ffmpeg.events.progress.subscribe(handleProgressEvent);
    const unsubEnd =
      window.electronAPI.ffmpeg.events.end.subscribe(handleEndEvent);
    const unsubError =
      window.electronAPI.ffmpeg.events.error.subscribe(handleErrorEvent);
    const unsubCancelled =
      window.electronAPI.ffmpeg.events.jobCancelled.subscribe(
        handleCancelledEvent
      );
    const unsubQueueUpdate =
      window.electronAPI.ffmpeg.events.queueUpdate?.subscribe(
        refreshAllJobsAndQueueStatus
      );
    const unsubQueueCleared =
      window.electronAPI.ffmpeg.events.queueCleared?.subscribe(
        refreshAllJobsAndQueueStatus
      );

    // Cleanup
    return () => {
      console.log("Effect: Cleaning up FFMPEG backend event listeners...");
      unsubProgress();
      unsubEnd();
      unsubError();
      unsubCancelled();
      unsubQueueUpdate?.();
      unsubQueueCleared?.();
      if (progressTimeoutId) clearTimeout(progressTimeoutId);
      flushProgressUpdates(); // Flush any remaining updates on cleanup
    };
    // Re-run setup if initialization state changes or refresh function changes
  }, [state.isInitialized]);

  // --- UI Action Callbacks (Memoized) ---
  const handleSelectItem = useCallback(
    (itemIndex: number, isChecked: boolean) =>
      dispatch({
        type: "TOGGLE_SELECT_ITEM",
        payload: { itemIndex, checked: isChecked },
      }),
    []
  );
  const handleSelectAll = useCallback(
    (isChecked: boolean | "indeterminate") => {
      if (typeof isChecked === "boolean")
        dispatch({
          type: "TOGGLE_SELECT_ALL",
          payload: { checked: isChecked },
        });
    },
    []
  );
  const handleItemTypeChange = useCallback(
    (itemIndex: number, type: CoreDownloadType) =>
      dispatch({ type: "SET_ITEM_TYPE", payload: { itemIndex, type } }),
    []
  );
  const handleItemQualityChange = useCallback(
    (itemIndex: number, quality: string) =>
      dispatch({ type: "SET_ITEM_QUALITY", payload: { itemIndex, quality } }),
    []
  );
  const handleBulkTypeChange = useCallback((typeValue: string) => {
    if (typeValue === "video" || typeValue === "audio")
      dispatch({ type: "SET_BULK_TYPE", payload: typeValue });
  }, []);
  const handleBulkQualityChange = useCallback((qualityValue: string) => {
    if (qualityValue)
      dispatch({ type: "SET_BULK_QUALITY", payload: qualityValue });
  }, []);
  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      dispatch({ type: "SET_SEARCH_QUERY", payload: event.target.value }),
    []
  );
  const handleClearSearch = useCallback(
    () => dispatch({ type: "SET_SEARCH_QUERY", payload: "" }),
    []
  );
  const handleClearOutputPath = useCallback(
    () => dispatch({ type: "SET_OUTPUT_PATH", payload: undefined }),
    []
  );

  // --- File System Interaction Callbacks (Memoized - No changes needed) ---
  const handleOpenFile = useCallback(async (filePath: string) => {
    if (!filePath) return toast.warning("No file path provided.");
    if (!window.electronAPI?.shell?.openFile)
      return toast.error("Cannot open file: Feature not available.");
    try {
      console.log(`Attempting to open file: ${filePath}`);
      const result = await window.electronAPI.shell.openFile(filePath);
      if (!result.success)
        toast.warning("Could not open file.", {
          description: result.message || "System could not open the file.",
        });
    } catch (error: any) {
      console.error(`Failed to request opening file "${filePath}":`, error);
      toast.error("Failed to open file", {
        description: error.message || "An unknown error occurred.",
      });
    }
  }, []);

  const handleOpenFolder = useCallback(async (filePath: string) => {
    if (!filePath) return toast.warning("No file path provided.");
    const api = window.electronAPI?.shell;
    if (!api?.showItemInFolder && !api?.openFile)
      return toast.error("Cannot open folder: Feature not available.");

    try {
      console.log(`Attempting to show item in folder: ${filePath}`);
      let opened = false;
      if (api.showItemInFolder) {
        const result = await api.showItemInFolder(filePath);
        opened = result.success;
        if (!opened)
          console.warn(
            `showItemInFolder failed for "${filePath}": ${result.message}`
          );
      }

      if (!opened && api.openFile) {
        // Fallback to opening parent directory
        console.warn(
          `Falling back to opening parent directory for "${filePath}".`
        );
        const directoryPath = filePath.substring(
          0,
          Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"))
        );
        if (directoryPath && directoryPath !== filePath) {
          console.log(`Attempting to open directory: ${directoryPath}`);
          const result = await api.openFile(directoryPath);
          opened = result.success;
          if (!opened)
            console.warn(
              `Fallback openFile failed for directory "${directoryPath}": ${result.message}`
            );
        } else {
          console.warn(
            `Could not extract directory. Attempting to open path directly: ${filePath}`
          );
          const result = await api.openFile(filePath); // Try opening the original path itself
          opened = result.success;
          if (!opened)
            console.warn(
              `Fallback openFile failed for path "${filePath}": ${result.message}`
            );
        }
      }

      if (!opened)
        throw new Error("System could not open the specified location.");
    } catch (error: any) {
      console.error(`Failed to open folder containing "${filePath}":`, error);
      toast.error("Failed to open folder", {
        description: error.message || "An unknown error occurred.",
      });
    }
  }, []);

  const handleSelectOutputDirectory = useCallback(async () => {
    if (!window.electronAPI?.dialog?.selectDirectory)
      return toast.error("Cannot select directory: Feature not available.");
    try {
      console.log("Requesting directory selection dialog...");
      const response = await window.electronAPI.dialog.selectDirectory();
      if (response.success && response.data?.path) {
        console.log("Directory selected:", response.data.path);
        dispatch({ type: "SET_OUTPUT_PATH", payload: response.data.path });
        // } else if (response.cancelled) {
        //   console.log("Directory selection cancelled.");
      } else {
        throw new Error(response.message || "Failed to get directory path.");
      }
    } catch (error: any) {
      console.error("Failed to select directory:", error);
      toast.error("Error Selecting Directory", {
        description: error.message || "An unknown error occurred.",
      });
    }
  }, []);

  // --- Download Action Callbacks ---

  // handleCancelIndividualJob (relies on context/API)
  const handleCancelIndividualJob = useCallback(
    async (jobId: string) => {
      if (!jobId) return console.warn("Cancel job called without Job ID.");
      console.log(`Action: Requesting cancel for job ${jobId}`);
      if (!window.electronAPI?.ffmpeg || !cancelDownload)
        return toast.error("Cannot cancel: API not available.");

      toast.info(`Attempting to cancel download: ${jobId}...`);
      try {
        const cancelResult = await cancelDownload(jobId);
        if (cancelResult.success) {
          toast.success("Cancellation request sent.", {
            description: `Job ID: ${jobId}`,
          });
          await refreshAllJobsAndQueueStatus(); // Refresh state quickly
        } else {
          throw new Error(
            cancelResult.message || "Backend reported cancellation failure."
          );
        }
      } catch (error: any) {
        console.error(`Failed to cancel job ${jobId}:`, error);
        toast.error("Failed to cancel download", {
          description: error.message || `Job ID: ${jobId}`,
        });
        await refreshAllJobsAndQueueStatus(); // Refresh even on error
      }
    },
    [cancelDownload, refreshAllJobsAndQueueStatus]
  );

  const handleCancelAllDownloads = useCallback(async () => {
    console.log("Action: Requesting Cancel All Downloads");

    setPlaylistProcessing(false);

    if (!window.electronAPI?.ffmpeg || !cancelDownload)
      return toast.error("Cannot cancel: API not available.");

    cancellationRequestedRef.current = true; // Signal batch loop to stop
    dispatch({ type: "CANCELLATION_PROCESS_START" }); // UI feedback start
    const cancellationToastId = toast.loading("Cancelling all downloads...");

    // --- START: Immediate UI Update ---
    // Get the current items at the moment of cancellation
    const itemsToCancelUI = stateRef.current.items;
    let uiCancelledCount = 0;
    itemsToCancelUI.forEach((item, index) => {
      if (
        ["queued", "processing", "downloading"].includes(item.downloadStatus)
      ) {
        dispatch({
          type: "MARK_ITEM_CANCELLED_UI",
          payload: { itemIndex: index },
        });
        uiCancelledCount++;
      }
    });
    if (uiCancelledCount > 0) {
      console.log(
        `Immediately marked ${uiCancelledCount} items as 'cancelled' in the UI.`
      );
      // Optional: Update toast immediately if needed, but main toast handles it
      // toast.info(`Updating UI for ${uiCancelledCount} items...`, { id: cancellationToastId, duration: 1500 });
    }
    // --- END: Immediate UI Update ---

    try {
      console.log("Clearing backend job queue...");
      // Clear queue first, as queued items won't become active jobs
      await window.electronAPI.ffmpeg.clearQueue();
      toast.info("Backend queue cleared.", { id: cancellationToastId });

      console.log("Fetching active jobs to cancel...");
      const activeJobsResponse =
        await window.electronAPI.ffmpeg.getActiveJobs();
      const activeJobIds =
        activeJobsResponse.data?.activeJobs?.map((job) => job.jobId) || [];

      if (activeJobIds.length > 0) {
        console.log(
          `Sending cancellation requests for ${activeJobIds.length} active jobs...`
        );
        toast.info(`Cancelling ${activeJobIds.length} active job(s)...`, {
          id: cancellationToastId,
        });
        // Send cancel requests without waiting for each to complete individually
        const cancellationPromises = activeJobIds.map((id) =>
          cancelDownload(id).catch((error) => {
            // Log individual errors but don't let one fail the whole process
            console.error(
              `Failed to send cancel request for active job ${id}:`,
              error
            );
          })
        );
        // We don't necessarily need to await all promises here if we just want to send the signal
        // await Promise.all(cancellationPromises); // Keep if you need to know they *tried* to send

        toast.success("Cancellation requests sent.", {
          id: cancellationToastId,
          description: `Sent signal for ${activeJobIds.length} active job(s). Final status may take moments to update.`,
        });
      } else {
        toast.success("Cancellation process initiated.", {
          id: cancellationToastId,
          description: "Queue cleared. No active jobs found to cancel.",
        });
      }
    } catch (error: any) {
      console.error("Error during 'Cancel All':", error);
      toast.error("Failed to cancel all downloads", {
        id: cancellationToastId,
        description: error.message || "Unexpected error.",
      });
    } finally {
      console.log("Finishing 'Cancel All' process.");
      // Reset flags and state via reducer actions
      dispatch({ type: "CANCELLATION_PROCESS_END" });
      dispatch({ type: "BATCH_DOWNLOAD_END" }); // Ensure batch loop state is reset too
      // Refresh state after a short delay to allow backend potentially update faster
      setTimeout(() => {
        refreshAllJobsAndQueueStatus();
        console.log("Post-cancel refresh triggered.");
      }, 500); // Delay refresh slightly
    }
  }, [cancelDownload, refreshAllJobsAndQueueStatus]); // Dependencies are correct

  const handleDownloadSelectedItems = useCallback(async () => {
    console.log("Action: Starting batch download process...");
    const {
      items: initialItemsSnapshot, // Take snapshot at start
      // queueStatus: currentQueueStatus, // We'll check queue inside loop now
      // outputPath: currentOutputPath, // Use stateRef inside loop for latest path
    } = stateRef.current;

    // 1. Identify items to process based on the snapshot
    const itemsToProcessInfo = initialItemsSnapshot
      .map((item, index) => ({ item, originalIndex: index })) // Keep original index
      .filter(
        ({ item }) =>
          item.selected &&
          ["idle", "completed", "error", "cancelled"].includes(
            item.downloadStatus
          )
      );

    if (itemsToProcessInfo.length === 0) {
      return toast.info("No items selected or eligible for download.");
    }

    if (
      !window.electronAPI?.settings?.getSettings ||
      !window.electronAPI?.getJSON ||
      !startDownload
    ) {
      return toast.error(
        "Cannot start download: Required API functions are missing."
      );
    }

    // --- PRE-LOOP STATE UPDATES ---
    console.log(`Batch target: ${itemsToProcessInfo.length} items.`);
    dispatch({ type: "BATCH_DOWNLOAD_START" });
    cancellationRequestedRef.current = false; // Reset cancellation flag

    // 2. Reset State Upfront: Mark items ready for download as 'idle' if they aren't already.
    itemsToProcessInfo.forEach(({ item, originalIndex }) => {
      if (
        originalIndex < stateRef.current.items.length &&
        stateRef.current.items[originalIndex]?.id === item.id && // Double check ID match
        stateRef.current.items[originalIndex].downloadStatus !== "idle"
      ) {
        console.log(
          `Pre-resetting item "${item.title}" (Index: ${originalIndex}) to idle.`
        );
        dispatch({
          type: "RESET_ITEM_FOR_RETRY",
          payload: { itemIndex: originalIndex },
        });
      } else if (
        originalIndex >= stateRef.current.items.length ||
        stateRef.current.items[originalIndex]?.id !== item.id
      ) {
        console.warn(
          `Item "${item.title}" (originally at index ${originalIndex}) seems to have shifted or been removed before reset. Skipping reset.`
        );
      }
    });

    // 3. Allow state updates from resets to apply (brief pause)
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 4. Mark as Waiting Upfront (Optimistic UI Update)
    //    Iterate again, using originalIndex, to mark items as 'waiting' in the NOW current state
    itemsToProcessInfo.forEach(({ item, originalIndex }) => {
      if (
        originalIndex < stateRef.current.items.length &&
        stateRef.current.items[originalIndex]?.id === item.id &&
        stateRef.current.items[originalIndex].downloadStatus === "idle" // Should be idle now
      ) {
        console.log(
          `Marking item "${item.title}" (Index: ${originalIndex}) as waiting.`
        );
        dispatch({
          type: "MARK_ITEM_WAITING", // <-- Use new action
          payload: { itemIndex: originalIndex },
        });
      } else {
        console.warn(
          `Item "${item.title}" (originally at index ${originalIndex}) not found or not idle before marking waiting. Status: ${stateRef.current.items[originalIndex]?.downloadStatus}. Skipping.`
        );
        // Optionally mark as error here? For now, just skip.
      }
    });
    // --- END PRE-LOOP STATE UPDATES ---

    // 5. Proceed with the main processing loop
    let processedCount = 0; // Count items successfully sent to startDownload
    let errorCount = 0;
    const batchToastId = toast.loading(
      `Preparing ${itemsToProcessInfo.length} item(s)...`
    );

    try {
      let cooldownTimeMs = 1000; // Default cooldown
      try {
        const settingsResponse =
          await window.electronAPI.settings.getSettings();
        if (
          settingsResponse.success &&
          settingsResponse.data?.ffmpeg?.cooldownTimeBetweenJobs
        ) {
          cooldownTimeMs = Math.max(
            0,
            settingsResponse.data.ffmpeg.cooldownTimeBetweenJobs * 1000
          );
          console.log(`Using cooldown time: ${cooldownTimeMs}ms`);
        }
      } catch (settingsError) {
        console.warn(
          "Could not fetch cooldown setting, using default:",
          settingsError
        );
      }

      const maxConcurrency = stateRef.current.queueStatus.max;

      // Use the itemsToProcessInfo array which contains the stable originalIndex
      for (let i = 0; i < itemsToProcessInfo.length; i++) {
        const { item: itemToProcess, originalIndex } = itemsToProcessInfo[i];

        if (cancellationRequestedRef.current) {
          console.log("Batch loop: Cancellation requested. Breaking.");
          toast.info("Download process cancelled.", { id: batchToastId });
          setPlaylistProcessing(false);
          break;
        }

        // --- Get Current State Using originalIndex ---
        const findCurrentItemData = () => {
          if (
            originalIndex < stateRef.current.items.length &&
            stateRef.current.items[originalIndex]?.id === itemToProcess.id
          ) {
            return {
              currentItemState: stateRef.current.items[originalIndex],
              currentIndex: originalIndex,
            };
          }
          return null; // Item not found or mismatched
        };

        let currentItemData = findCurrentItemData();

        if (!currentItemData) {
          console.warn(
            `Item "${
              itemToProcess.title
            }" (originally at index ${originalIndex}) not found or mismatched in current state before processing step ${
              i + 1
            }. Skipping.`
          );
          errorCount++;
          continue; // Skip to the next item
        }

        let { currentItemState, currentIndex } = currentItemData;

        // Check if the item is still in 'waiting' state. If not, something else changed it (e.g., manual cancel, previous error).
        if (currentItemState.downloadStatus !== "waiting") {
          console.warn(
            `Item "${currentItemState.title}" (Index: ${currentIndex}) is no longer 'waiting' (status: ${currentItemState.downloadStatus}). Skipping processing step.`
          );
          // Don't count as error unless it's unexpected.
          continue;
        }

        console.log(
          `Processing item ${i + 1}/${itemsToProcessInfo.length}: "${
            currentItemState.title
          }" (Current Index: ${currentIndex})`
        );
        toast.info(`Processing: ${currentItemState.title}`, {
          id: batchToastId,
          duration: 5000,
        }); // Update toast

        // --- Wait for Queue Slot (If needed - simple check example) ---
        // This is a basic check. A more robust system might use a dedicated queue manager.
        let waitAttempts = 0;
        while (
          stateRef.current.queueStatus.current >= maxConcurrency &&
          !cancellationRequestedRef.current
        ) {
          if (waitAttempts === 0) {
            console.log(
              `Queue full (${stateRef.current.queueStatus.current}/${maxConcurrency}). Waiting for slot for "${currentItemState.title}"...`
            );
            toast.info(
              `Waiting for queue slot... (${stateRef.current.queueStatus.current}/${maxConcurrency})`,
              { id: batchToastId }
            );
          }
          waitAttempts++;
          await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5 seconds before checking again
          // Refresh queue status (or rely on the polling effect to update it)
          await refreshAllJobsAndQueueStatus(); // Explicit refresh might be needed here
          if (cancellationRequestedRef.current) break; // Exit inner while loop if cancelled
        }

        if (cancellationRequestedRef.current) break; // Exit outer for loop if cancelled during wait

        // --- Start Download (Individual Item Try/Catch) ---
        try {
          // Re-fetch current state right before async operations
          currentItemData = findCurrentItemData();
          if (!currentItemData)
            throw new Error("Item disappeared before metadata fetch.");
          currentItemState = currentItemData.currentItemState;
          currentIndex = currentItemData.currentIndex;

          // Crucial Check: Ensure the item is still 'waiting' before proceeding.
          if (currentItemState.downloadStatus !== "waiting") {
            console.warn(
              `Item "${currentItemState.title}" status changed to ${currentItemState.downloadStatus} before metadata fetch. Skipping.`
            );
            continue; // Skip to next item
          }

          // Fetch fresh metadata - Mark as Extracting
          console.log(
            `Fetching metadata for: ${currentItemState.original_url}`
          );
          dispatch({
            type: "MARK_ITEM_EXTRACTING",
            payload: { itemIndex: currentIndex },
          }); // <-- Mark as extracting
          toast.info(`Extracting: ${currentItemState.title}`, {
            id: batchToastId,
            duration: 4000,
          });
          setPlaylistProcessing(true); // Indicate processing is happening

          let metadataResponse;
          if (
            window.electronAPI &&
            typeof window.electronAPI.getJSON === "function"
          ) {
            metadataResponse = await window.electronAPI.getJSON(
              currentItemState.original_url
            );
          } else {
            throw new Error(
              "Metadata fetching function (getJSON) is not available."
            );
          }

          if (
            !metadataResponse ||
            !metadataResponse.success ||
            !metadataResponse.data
          ) {
            throw new Error(
              metadataResponse?.message ||
                `Failed to fetch metadata for "${currentItemState.title}"`
            );
          }

          // Re-check for cancellation *after* slow metadata fetch
          if (cancellationRequestedRef.current) {
            console.log("Cancelled after metadata fetch.");
            toast.info("Download cancelled.", { id: batchToastId });
            break; // Exit outer loop
          }

          // Re-fetch current state again after await, before starting download
          currentItemData = findCurrentItemData();
          if (!currentItemData)
            throw new Error("Item disappeared after metadata fetch.");
          currentItemState = currentItemData.currentItemState;
          currentIndex = currentItemData.currentIndex;

          // Check status again - must still be extracting (or maybe backend event already made it queued/error?)
          // If it's already queued/downloading/etc., the backend beat us to it, which is fine.
          // If it's error/cancelled/idle, something went wrong externally.
          if (currentItemState.downloadStatus !== "extracting") {
            console.warn(
              `Item "${currentItemState.title}" status changed to ${currentItemState.downloadStatus} after metadata fetch, before startDownload call. Skipping startDownload.`
            );
            if (currentItemState.downloadStatus === "error") errorCount++; // Count as error if it became error state
            continue; // Skip startDownload for this item
          }

          toast.info(`Queueing: ${currentItemState.title}`, {
            id: batchToastId,
            duration: 3000,
          });

          // Prepare Config
          const downloadConfig: DownloadConfig = {
            data: metadataResponse.data as YtDlpAudioVideoMetadata,
            type: currentItemState.downloadType,
            outputPath: stateRef.current.outputPath ?? undefined, // Use latest path setting
            method: "byFilter",
            filter:
              currentItemState.downloadType === "video"
                ? {
                    videoMaxQuality:
                      currentItemState.quality === "highest"
                        ? "max"
                        : (parseInt(
                            currentItemState.quality,
                            10
                          ) as VideoQualityFilter) || "max",
                  }
                : {
                    audioQuality:
                      currentItemState.quality as AudioQualityFilter,
                  },
            platformUrl: currentItemState.original_url,
            title: currentItemState.title,
          };

          // Call Start Download
          console.log(`Calling startDownload for "${currentItemState.title}"`);
          const startResult = await startDownload(downloadConfig);

          // Find index AGAIN after async startDownload call
          currentItemData = findCurrentItemData();

          if (startResult.success && startResult.jobId) {
            console.log(
              `Backend accepted: "${itemToProcess.title}". Job ID: ${startResult.jobId}`
            );
            processedCount++; // Increment count of successfully handed-off items
            if (currentItemData) {
              // Item still exists, mark as queued by backend
              dispatch({
                type: "MARK_ITEM_BACKEND_QUEUED", // <-- Use new action
                payload: {
                  itemIndex: currentItemData.currentIndex,
                  jobId: startResult.jobId,
                },
              });
            } else {
              // Item removed during startDownload? Cancel the orphaned job.
              console.warn(
                `Item "${itemToProcess.title}" missing after successful download start (Job ${startResult.jobId}). Cancelling orphaned job.`
              );
              await cancelDownload(startResult.jobId).catch((err) =>
                console.error("Failed to cancel orphaned job:", err)
              );
            }
          } else {
            // Throw error to be caught by the outer catch block for this item
            throw new Error(
              startResult.error ||
                `Backend failed to start download job for "${itemToProcess.title}".`
            );
          }
        } catch (downloadError: any) {
          console.error(
            `Error processing item "${itemToProcess.title}":`,
            downloadError
          );
          toast.error(`Error: ${itemToProcess.title}`, {
            description: downloadError.message || "Unknown error occurred.",
          });
          errorCount++;
          // Find item again to mark error using the originalIndex
          currentItemData = findCurrentItemData();
          if (currentItemData) {
            dispatch({
              type: "MARK_ITEM_ERROR",
              payload: {
                itemIndex: currentItemData.currentIndex,
                error: downloadError.message || "Processing failed",
              },
            });
          } else {
            console.warn(
              `Item "${itemToProcess.title}" missing when trying to mark error.`
            );
          }
        } // End individual item try/catch

        // Cooldown (only if successfully processed or errored, not if skipped)
        const isLastItem = i === itemsToProcessInfo.length - 1;
        if (
          !isLastItem &&
          !cancellationRequestedRef.current &&
          cooldownTimeMs > 0
        ) {
          console.log(`Applying ${cooldownTimeMs}ms cooldown...`);
          await new Promise((resolve) => setTimeout(resolve, cooldownTimeMs));
        }
      } // End for loop
    } catch (batchError: any) {
      // Catch errors outside the item loop (e.g., settings fetch)
      console.error("Error during batch download setup:", batchError);
      toast.error("Batch Download Error", {
        description: batchError.message || "An unexpected error occurred.",
        id: batchToastId,
      });
      errorCount = itemsToProcessInfo.length; // Assume all failed if setup crashed
      // Processed count remains 0 or whatever it was before the crash
    } finally {
      console.log("Batch download loop finished or terminated.");
      setPlaylistProcessing(false); // Indicate processing is done
      toast.dismiss(batchToastId); // Dismiss loading toast

      // Final Cleanup: Reset items that were left in 'waiting' or 'extracting'
      // This happens if cancelled or if the loop finished with some items not started
      stateRef.current.items.forEach((item, index) => {
        if (["waiting", "extracting"].includes(item.downloadStatus)) {
          console.log(
            `Resetting item "${item.title}" (Index: ${index}) from ${item.downloadStatus} to idle after batch completion/cancellation.`
          );
          dispatch({
            type: "RESET_ITEM_FOR_RETRY",
            payload: { itemIndex: index },
          });
        }
      });

      // Show summary if not cancelled explicitly by user
      if (!cancellationRequestedRef.current) {
        const finalProcessed = processedCount;
        const finalErrors = errorCount;
        const totalItemsTargeted = itemsToProcessInfo.length;

        if (
          finalProcessed > 0 &&
          finalErrors === 0 &&
          finalProcessed === totalItemsTargeted
        )
          toast.success(
            `Batch complete: ${finalProcessed} item(s) queued for download.`
          );
        else if (finalProcessed > 0 || finalErrors > 0)
          toast.warning(
            `Batch finished: ${finalProcessed} item(s) queued, ${finalErrors} error(s) out of ${totalItemsTargeted} selected.`
          );
        else if (totalItemsTargeted > 0)
          toast.error(
            `Batch failed: Could not process any of the ${totalItemsTargeted} selected item(s).`
          );
      } else {
        console.log("Batch processing ended due to user cancellation.");
        // Optional: Add a final "Batch cancelled" toast if needed
        toast.info("Batch download cancelled by user.");
      }

      // IMPORTANT: Reset flags and state
      dispatch({ type: "BATCH_DOWNLOAD_END" }); // Reset UI state

      await refreshAllJobsAndQueueStatus(); // Final state refresh
    }
  }, [
    startDownload,
    cancelDownload,
    refreshAllJobsAndQueueStatus,
    setPlaylistProcessing,
  ]); // Added setPlaylistProcessing dependency

  // handleRetryJob needs to use the REVISED handleDownloadSelectedItems
  const handleRetryJob = useCallback(
    (itemIndex: number) => {
      console.log(`Action: Requesting retry for item index ${itemIndex}`);
      // 1. Reset the specific item first
      dispatch({ type: "RESET_ITEM_FOR_RETRY", payload: { itemIndex } });

      // 2. Give state a moment to update and THEN trigger the main download function
      //    The main function will now correctly handle the pre-queuing for this single item.
      setTimeout(() => {
        console.log(
          `Triggering download for retried item (index ${itemIndex} should now be selected and idle)`
        );
        // IMPORTANT: Ensure the item is actually selected after reset
        // The RESET_ITEM_FOR_RETRY action already sets selected: true
        handleDownloadSelectedItems(); // Call the revised batch download function
      }, 100); // Slightly longer delay to ensure reset state is processed
    },
    [handleDownloadSelectedItems]
  ); // Depends on the revised batch download function

  // Add dependency for handleRetryJob
  useEffect(() => {}, [handleDownloadSelectedItems, handleRetryJob]);

  // --- Derived State (Memoized) ---
  const { selectAllState, selectedCount, selectableCount } = useMemo(
    () => calculateSelectAll(state.items),
    [state.items]
  );
  const filteredItems = useMemo(() => {
    const query = state.searchQuery.toLowerCase().trim();
    if (!query) return state.items;
    return state.items.filter(
      (item) =>
        item.title?.toLowerCase().includes(query) ||
        item.uploader?.toLowerCase().includes(query)
    );
  }, [state.items, state.searchQuery]);
  const activeOrQueuedCount = useMemo(
    () =>
      state.items.filter((item) =>
        ["downloading", "processing", "queued"].includes(item.downloadStatus)
      ).length,
    [state.items]
  );

  // --- Render Logic ---

  // Show loading state until *both* initialized and hydrated
  if (!state.isInitialized || !state.isHydrated) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader>
          <CardTitle>Initializing Playlist...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-60">
          <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          <p className="ml-2 text-muted-foreground">Loading details...</p>
        </CardContent>
      </Card>
    );
  }

  // Main component render
  return (
    <Card className="w-full flex flex-col h-full border-none shadow-none bg-transparent">
      {/* Header Section */}
      <CardHeader className="flex-shrink-0 px-4 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-30">
        {/* Row 1: Title, Count, Queue */}
        <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2">
          <CardTitle className="text-base lg:text-lg font-semibold flex items-center gap-2 flex-grow min-w-0 mr-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="truncate" title={state.playlistTitle}>
                    {state.playlistTitle}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{state.playlistTitle}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge
              variant="secondary"
              className="text-xs lg:text-sm whitespace-nowrap flex-shrink-0"
            >
              {state.items.length} items
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-shrink-0 text-xs lg:text-sm">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-muted-foreground cursor-default">
                  <Loader2
                    className={`h-3.5 w-3.5 ${
                      state.queueStatus.current > 0
                        ? "animate-spin"
                        : "opacity-50"
                    }`}
                  />
                  <span>
                    {state.queueStatus.current}/{state.queueStatus.max} Active
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Jobs Active or Queued / Max Concurrent</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        {/* Row 2: Controls */}
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 justify-between mt-3 flex-wrap">
          {/* Left Controls: Bulk Selects, Output */}
          <div className="flex flex-col sm:flex-row gap-3 items-start flex-wrap">
            <div className="flex gap-2">
              <Select
                value={state.defaultDownloadType}
                onValueChange={handleBulkTypeChange}
                disabled={
                  state.isBatchDownloading || state.isProcessingCancellation
                }
              >
                <SelectTrigger
                  className="w-[110px] sm:w-[120px] h-8 text-xs"
                  aria-label="Set Default Type"
                >
                  <SelectValue placeholder="Bulk Type" />
                </SelectTrigger>
                <SelectContent>
                  {DOWNLOAD_TYPES.map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-xs"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={
                  state.defaultDownloadType === "video"
                    ? state.defaultVideoQuality
                    : state.defaultAudioQuality
                }
                onValueChange={handleBulkQualityChange}
                disabled={
                  state.isBatchDownloading || state.isProcessingCancellation
                }
              >
                <SelectTrigger
                  className="w-[140px] sm:w-[160px] h-8 text-xs"
                  aria-label="Set Default Quality"
                >
                  <SelectValue placeholder="Bulk Quality" />
                </SelectTrigger>
                <SelectContent>
                  {(state.defaultDownloadType === "video"
                    ? VIDEO_QUALITY_OPTIONS
                    : AUDIO_QUALITY_OPTIONS
                  ).map((o) => (
                    <SelectItem
                      key={o.value}
                      value={o.value}
                      className="text-xs"
                    >
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative w-full sm:w-auto sm:min-w-[220px] md:min-w-[260px]">
              <Label
                htmlFor="output-path-display"
                className={`absolute left-2 transition-all duration-200 ease-out pointer-events-none ${
                  state.outputPath
                    ? "-top-1.5 text-xs text-muted-foreground bg-background px-1 z-10"
                    : "top-1.5 text-sm text-muted-foreground"
                }`}
              >
                Output Location
              </Label>
              <div className="relative flex items-center mt-1">
                <Input
                  id="output-path-display"
                  value={state.outputPath || ""}
                  readOnly
                  placeholder="Default Location"
                  className="h-8 text-xs pr-14 rounded-md"
                  aria-label="Selected output directory"
                />
                <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center space-x-0.5">
                  {state.outputPath && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={handleClearOutputPath}
                            className="h-6 w-6"
                            aria-label="Use default location"
                            disabled={
                              state.isBatchDownloading ||
                              state.isProcessingCancellation
                            }
                          >
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Use Default Location</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleSelectOutputDirectory}
                          className="h-6 w-6"
                          aria-label="Select Output Directory"
                          disabled={
                            state.isBatchDownloading ||
                            state.isProcessingCancellation
                          }
                        >
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Select Directory</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
          {/* Right Controls: Search, Actions */}
          <div className="flex flex-col sm:flex-row gap-3 items-start lg:items-center">
            <div className="relative w-full sm:w-48 md:w-56">
              <Label htmlFor="search-playlist-input" className="sr-only">
                Search Playlist Items
              </Label>
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                id="search-playlist-input"
                type="search"
                placeholder="Search items..."
                value={state.searchQuery}
                onChange={handleSearchInputChange}
                className="pl-7 h-8 text-xs rounded-md"
                disabled={
                  state.isBatchDownloading || state.isProcessingCancellation
                }
              />
              {state.searchQuery && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleClearSearch}
                        className="absolute right-0.5 top-1/2 transform -translate-y-1/2 h-7 w-7"
                        aria-label="Clear Search"
                        disabled={
                          state.isBatchDownloading ||
                          state.isProcessingCancellation
                        }
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear Search</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="gap-1.5 h-8 px-3 text-xs"
                disabled={
                  state.isBatchDownloading ||
                  state.isProcessingCancellation ||
                  selectedCount === 0
                }
                onClick={handleDownloadSelectedItems}
              >
                {state.isBatchDownloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="h-3.5 w-3.5" />
                )}
                Download{" "}
                {selectedCount > 0 ? ` (${selectedCount})` : " Selected"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 px-3 text-xs"
                disabled={
                  (!state.isBatchDownloading && activeOrQueuedCount === 0) ||
                  state.isProcessingCancellation
                }
                onClick={handleCancelAllDownloads}
              >
                {state.isProcessingCancellation ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Cancel All
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      {/* Table Content Section */}
      <CardContent className="flex-grow pt-0 px-0 overflow-hidden">
        <div className="h-full overflow-auto">
          <Table className="min-w-[1000px]">
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-20 shadow-sm">
              <TableRow>
                <TableHead className="w-12 sticky left-0 bg-inherit z-30 px-2">
                  <Checkbox
                    id="select-all-items"
                    checked={selectAllState === "all"}
                    data-state={selectAllState}
                    onCheckedChange={handleSelectAll}
                    disabled={
                      state.isBatchDownloading ||
                      state.isProcessingCancellation ||
                      selectableCount === 0
                    }
                    aria-label="Select all downloadable items"
                  />
                </TableHead>
                <TableHead className="w-12 text-right pr-3">#</TableHead>
                <TableHead className="min-w-[280px] md:min-w-[320px] lg:min-w-[380px] px-2">
                  Item
                </TableHead>
                <TableHead className="w-28 px-2">Status</TableHead>
                <TableHead className="w-28 px-2">Type</TableHead>
                <TableHead className="w-36 px-2">Quality</TableHead>
                <TableHead className="w-52 min-w-[210px] px-2">
                  Progress
                </TableHead>
                <TableHead className="w-24 text-right px-2">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-60 text-center text-muted-foreground"
                  >
                    {state.searchQuery
                      ? "No items match your search."
                      : "Playlist empty."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => {
                  const originalIndex = state.items.findIndex(
                    (stateItem) => stateItem.id === item.id
                  );
                  if (originalIndex === -1) {
                    console.warn(
                      `Filtered item "${item.title}" not found in original state. Skipping render.`
                    );
                    return null;
                  }
                  return (
                    <PlaylistItemRow
                      key={item.id}
                      item={item}
                      itemIndex={originalIndex}
                      isBatchDownloadingGlobal={state.isBatchDownloading}
                      isProcessingCancellationGlobal={
                        state.isProcessingCancellation
                      }
                      onSelectItem={handleSelectItem}
                      onTypeChange={handleItemTypeChange}
                      onQualityChange={handleItemQualityChange}
                      onOpenFile={handleOpenFile}
                      onOpenFolder={handleOpenFolder}
                      onCancelJob={handleCancelIndividualJob}
                      onRetryJob={handleRetryJob}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlaylistDownloader;
