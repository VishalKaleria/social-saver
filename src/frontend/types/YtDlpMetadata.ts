// Base HTTP and downloader types
type HttpHeaders = {
  "User-Agent": string;
  Accept: string;
  "Accept-Language": string;
  "Sec-Fetch-Mode": string;
};

type DownloaderOptions = {
  http_chunk_size: number;
};

// Base format type - common properties for all format types
export type FormatBase = {
  format_id: string;
  url: string;
  ext: string;
  protocol: string;
  vcodec: string;
  acodec: string;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  source_preference?: number;
  quality?: number;
  has_drm?: boolean;
  language_preference?: number;
  preference?: any;
  dynamic_range?: string | null;
  container?: string;
  downloader_options?: DownloaderOptions;
  http_headers?: HttpHeaders;
  format?: string;
  resolution?: string;
};

// Video-specific format
export type VideoFormat = FormatBase & {
  asr: null;
  audio_channels: null;
  height: number;
  width: number;
  language: null;
  fps: number;
  aspect_ratio: number;
  vbr: number;
  video_ext: string;
  audio_ext?: never; // Explicitly mark as never to avoid conflicts
  abr?: never; // Explicitly mark as never to avoid conflicts
};

// Audio-specific format
export type AudioFormat = FormatBase & {
  asr: number;
  audio_channels: number;
  height: null;
  width: null;
  language: string | null;
  fps: null;
  aspect_ratio: null;
  abr: number;
  audio_ext: string;
  video_ext?: never; // Explicitly mark as never to avoid conflicts
  vbr?: never; // Explicitly mark as never to avoid conflicts
};

// Combined format (video+audio)
export type CombinedFormat = FormatBase & {
  asr: number;
  audio_channels: number;
  height: number;
  width: number;
  language: string | null;
  fps: number;
  aspect_ratio: number;
  dynamic_range: string | null;
  video_ext: string;
  audio_ext: string;
  // No vbr or abr for combined format
};

// Best formats organized by type
export type BestFormats = {
  video?: VideoFormat;
  audio?: AudioFormat;
  combined?: CombinedFormat;
};

// Audio formats organized by quality
export type AudioFormats = {
  high?: AudioFormat[];
  medium?: AudioFormat[];
  low?: AudioFormat[];
};

// Formats organized by quality
export type FormatsByQuality = {
  [key: string]: {
    video?: VideoFormat[];
    combined?: CombinedFormat[];
  };
};

// Direct URLs to formats
export type DirectUrls = {
  best?: {
    video?: string;
    audio?: string;
    combined?: string;
  };
  audio?: {
    high?: string[];
    medium?: string[];
    low?: string[];
  };
  byQuality?: {
    [key: string]: {
      video?: string[];
      combined?: string[];
    };
  };
};

// Format details with statistics
export type FormatDetails = {
  totalUnique: number;
  totalOriginal: number;
  videoFormats?: {
    count: number;
    formatTypes: { [key: string]: number };
    resolutions: { [key: string]: number };
    codecs: { [key: string]: number };
  };
  audioFormats?: {
    count: number;
    formatTypes: { [key: string]: number };
    resolutions: { [key: string]: {} };
    codecs: { [key: string]: number };
  };
  combinedFormats?: {
    count: number;
    formatTypes: { [key: string]: number };
    resolutions: { [key: string]: number };
    codecs: { [key: string]: number };
  };
};

// Thumbnail type
export type Thumbnail = {
  url: string;
  preference?: number;
  id?: string;
  height?: number;
  width?: number;
  resolution?: string;
};

// Caption and subtitle types
export type Caption = {
  ext: string;
  url: string;
  name: string;
};

export type Captions = {
  [key: string]: Caption[];
};

export type Subtitle = {
  url: string;
  video_id?: string;
  ext: string;
  protocol?: string;
};

export type Subtitles = {
  [key: string]: Subtitle[];
};

// Heatmap type for video engagement
export type Heatmap = {
  start_time: number;
  end_time: number;
  value: number;
};

// Requested format type
export type RequestedFormat = {
  format_id: string;
  url: string;
  ext: string;
  protocol: string;
  format: string;
  asr?: number;
  filesize?: number;
  format_note?: string;
  source_preference?: number;
  fps?: number;
  audio_channels?: number;
  height?: number;
  quality?: number;
  has_drm?: boolean;
  tbr?: number;
  filesize_approx?: number;
  width?: number;
  language?: string;
  language_preference?: number;
  preference?: any;
  vcodec?: string;
  acodec?: string;
  dynamic_range?: string;
  container?: string;
  downloader_options?: DownloaderOptions;
  video_ext?: string;
  audio_ext?: string;
  vbr?: number;
  abr?: number;
  resolution?: string;
  aspect_ratio?: number;
  http_headers?: HttpHeaders;
};

// Base metadata that applies to all media types
export type BaseMediaMetadata = {
  id: string;
  title: string;
  description?: string;
  thumbnails?: Thumbnail[];
  thumbnail?: string;
  webpage_url: string;
  original_url?: string;
  webpage_url_basename?: string;
  webpage_url_domain?: string;
  display_id?: string;
  extractor?: string;
  extractor_key?: string;
  duration?: number;
  duration_string?: string;
  upload_date?: string;
  timestamp?: number;
  release_timestamp?: number;
  release_date?: string;
  release_year?: number;
  availability?: string;
  epoch?: number;
  _version?: {
    version: string;
    current_git_head?: string;
    release_git_head?: string;
    repository: string;
  };
};

// Video-specific metadata
export type VideoMetadata = BaseMediaMetadata & {
  channel_id?: string;
  channel_url?: string;
  channel?: string;
  channel_follower_count?: number;
  channel_is_verified?: boolean;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  average_rating?: any;
  age_limit?: number;
  categories?: string[];
  tags?: string[];
  playable_in_embed?: boolean;
  live_status?: string;
  is_live?: boolean;
  was_live?: boolean;
  media_type?: any;
  _format_sort_fields?: string[];
  chapters?: any;
  heatmap?: Heatmap[];
  fulltitle?: string;
  automatic_captions?: Captions;
  subtitles?: Subtitles;
  requested_subtitles?: any;
  _has_drm?: any;
  requested_formats?: RequestedFormat[];
};

// Audio-specific metadata (for music platforms)
export type AudioMetadata = BaseMediaMetadata & {
  album?: string;
  artists?: string[];
  genre?: string[];
  track?: string;
  track_number?: number;
  artist?: string;
  composer?: string;
  publisher?: string;
  release_date?: string;
  playlist_count?: number;
  album_artist?: string;
  album_type?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
};

// Playlist item metadata (for items within a playlist)
export type PlaylistItemMetadata = BaseMediaMetadata & {
  playlist?: string;
  playlist_id?: string;
  playlist_title?: string;
  playlist_uploader?: string;
  playlist_uploader_id?: string;
  playlist_index?: number;
  playlist_count?: number;
  playlist_autonumber?: number;
  n_entries?: number;
  __last_playlist_index?: number;
  playlist_channel?: string;
  playlist_channel_id?: string;
  playlist_webpage_url?: string;
  channel_id?: string;
  channel?: string;
  channel_url?: string;
  uploader?: string;
  uploader_id?: string;
  uploader_url?: string;
  view_count?: number;
  _type?: string;
  ie_key?: string;
  url?: string;
};

// Define a generic type for a format array
export type FormatArray = (VideoFormat | AudioFormat | CombinedFormat)[];

// Formats container for video/audio media
export type FormatsContainer = {
  originalCount: number;
  uniqueCount: number;
  allUniqueFormats: FormatArray;
  bestFormats: BestFormats;
  audioFormats?: AudioFormats;
  formatsByQuality?: FormatsByQuality;
  directUrls?: DirectUrls;
  formatDetails: FormatDetails;
  audioOnlyFormats: AudioFormat[];
  videoOnlyFormats: VideoFormat[];
  combinedFormats: CombinedFormat[];
};

// Complete Video metadata with processed formats
export type YtDlpVideoMetadata = VideoMetadata & {
  formats: FormatsContainer;
  __dataType: "video";
};

// Complete Audio metadata with processed formats
export type YtDlpAudioMetadata = AudioMetadata & {
  formats: FormatsContainer;
  __dataType: "audio";
};

// Playlist metadata with items
export type YtDlpPlaylistMetadata = {
  title?: string;
  id?: string;
  webpage_url?: string;
  entries: PlaylistItemMetadata[];
  __dataType: "playlist";
};

export type YtDlpMediaType = "video" | "audio" | "playlist";

// Union type for all media types
export type YtDlpMediaMetadata = 
  | YtDlpVideoMetadata 
  | YtDlpAudioMetadata 
  | YtDlpPlaylistMetadata;

export type YtDlpAudioVideoMetadata =   YtDlpVideoMetadata | YtDlpAudioMetadata 

