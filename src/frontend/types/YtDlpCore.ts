/**
 * Standard response interface for all yt-dlp operations
 */
export interface YtDlpResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    message: string;
    stderr?: string;
    code?: number;
  };
}


export interface YtDlpFormat {
  format_id: string;
  format_note: string;
  ext: string;
  protocol: string;
  acodec: string;
  vcodec: string;
  url: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  rows: number | null;
  columns: number | null;
  resolution: string | null;
  tbr: number | null;
  abr: number | null;
  asr: number | null;
  vbr: number | null;
  format: string;
  filesize: number | null;
  filesize_approx: number | null;
  quality: number | null;
  dynamic_range: string | null;

  // Allow for additional fields
  [key: string]: any;
}

export interface YtDlpChapter {
  start_time: number;
  end_time: number;
  title: string;
}

export interface YtDlpError {
  error: true;
  message?: string;
  stderr?: string;
  stdout?: string;
  code?: number;
}

export type YtDlpResult<T> = T | YtDlpError;

// Service configuration options
export interface YtDlpServiceOptions {
  ytdlpPath?: string;
  maxRetries?: number;
  timeout?: number;
  verbose?: boolean;
  proxy?: string;
  cookies?: string;
  userAgent?: string;
  referer?: string;
  skipUnavailableFragments?: boolean;
  maxBuffer?: number;
}

// Comprehensive command options interface
export interface YtDlpCommandOptions {
  // Format selection options
  format?: string;
  videoFormat?: string;
  preferFreeFormats?: boolean;
  noCheckFormats?: boolean;
  videoQuality?: string | number;
  mergeOutputFormat?: MergeOutputFormatString;
  listFormats?: boolean;

  // Video selection options
  playlistItems?: string;
  playlistEnd?: number;
  playlistStart?: number;
  noPlaylist?: boolean;
  flatPlaylist?: boolean;
  maxDownloads?: number;
  minFilesize?: string;
  maxFilesize?: string;
  dateRange?: string;
  dateBefore?: string;
  dateAfter?: string;
  matchTitle?: string;
  rejectTitle?: string;
  matchFilter?: string;
  noMatchFilter?: string;
  ageLimit?: number;
  includeAds?: boolean;

  // Download options
  limitRate?: string;
  retries?: number | 'infinite';
  fragmentRetries?: number | 'infinite';
  skipUnavailableFragments?: boolean;
  abortOnUnavailableFragment?: boolean;
  keepFragments?: boolean;
  bufferSize?: string;
  noResizeBuffer?: boolean;
  httpChunkSize?: string;
  playlistReverse?: boolean;
  playlistRandom?: boolean;
  xattrSetFilesize?: boolean;
  hlsPreferNative?: boolean;
  hlsUseNative?: boolean;
  hlsAllowUnencrypted?: boolean;
  downloader?: string;
  downloaderArgs?: string;

  // Filesystem options
  output?: string;
  outputNaPlaylist?: string;
  restrictFilenames?: boolean;
  windowsFilenames?: boolean;
  noOverwrites?: boolean;
  forceOverwrites?: boolean;
  continue?: boolean;
  noPart?: boolean;
  noMtime?: boolean;
  writeDescription?: boolean;
  writeInfoJson?: boolean;
  writePlaylistMetafiles?: boolean;
  cleanInfoJson?: boolean;
  writeComments?: boolean;
  noCleanInfo?: boolean;
  writeLinks?: boolean;
  list?: boolean;

  // Thumbnail options
  writeThumbnail?: boolean;
  writeAllThumbnails?: boolean;

  // Internet Shortcut options
  writeLink?: boolean;
  writeUrlLink?: boolean;
  writeWeblocLink?: boolean;
  writeDesktopLink?: boolean;

  // Verbosity / Simulation Options
  quiet?: boolean;
  noWarnings?: boolean;
  simulate?: boolean;
  skipDownload?: boolean;
  getUrl?: boolean;
  getTitle?: boolean;
  getId?: boolean;
  getThumbnail?: boolean;
  getDuration?: boolean;
  getFilename?: boolean;
  getFormat?: boolean;
  dumpJson?: boolean;
  dumpSingleJson?: boolean;
  printJson?: boolean;

  // Workaround options
  encoding?: string;
  noCheckCertificates?: boolean;
  preferInsecure?: boolean;
  addHeader?: string;
  bidiWorkaround?: boolean;
  sleepInterval?: number;

  // Video Format options
  extractAudio?: boolean;
  audioFormat?: AudioFormatString;
  audioQuality?: string | number;
  remuxVideo?: string;
  recodeVideo?: string;
  postProcessorArgs?: string;
  keepVideo?: boolean;
  noPostOverwrites?: boolean;
  embedSubs?: boolean;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  embedChapters?: boolean;
  embedInfoJson?: boolean;
  updateMetadata?: boolean;
  updateSubtitles?: boolean;

  // Subtitle options
  writeSubtitles?: boolean;
  writeAutomaticSubtitles?: boolean;
  subtitlesFormat?: string;
  subtitlesLanguages?: string[];

  // Authentication options
  username?: string;
  password?: string;
  twoFactor?: string;
  netrc?: boolean;
  videoPassword?: string;
  apCookie?: string;
  cookies?: string;
  cookiesFromBrowser?: string;

  // Post-processing options
  ffmpegLocation?: string;
  exec?: string;
  execBeforeDownload?: string;
  convertSubs?: string;
  convertSubtitles?: string;

  // SponsorBlock options
  sponsorblockMark?: SponsorBlockCategory[];
  sponsorblockRemove?: SponsorBlockCategory[];
  sponsorblockChapterTitle?: string;
  noSponsorblock?: boolean;
  sponsorblockAPI?: string;

  // Extractor options
  extractorDescriptions?: string[];
  extractorRetries?: number | 'infinite';
  allowDynamicMpd?: boolean;

  // Debug options
  dumpPages?: boolean;
  writePages?: boolean;
  printTraffic?: boolean;

  // Network options
  socketTimeout?: number;
  proxy?: string;
  sourceAddress?: string;
  forceIpv4?: boolean;
  forceIpv6?: boolean;
  enableFileUrls?: boolean;
  geoVerification?: boolean;
  geoBypassCountry?: string;
  geoBypassIpBlock?: string;
  refreshToken?: string;

  // Misc options
  noConfig?: boolean;
  noColorTerminal?: boolean;
  progress?: boolean;
  consoleTitle?: boolean;
  dumpUserAgent?: boolean;
  listExtractors?: boolean;
  extractor?: string;
  defaultSearch?: string;
  ignoreConfig?: boolean;
  configLocation?: string;

  // Experimental options
  rmCacheDir?: boolean;
  markWatched?: boolean;
  cacheDir?: string;

  // Any additional custom options
  [key: string]: any;
}

// Audio formats enum
export type AudioFormatString = 'best' | 'aac' | 'flac' | 'm4a' | 'mp3' | 'opus' | 'vorbis' | 'wav';

// Video merge output format enum
export type MergeOutputFormatString = 'mkv' | 'mp4' | 'ogg' | 'webm' | 'flv';

// SponsorBlock categories
export type SponsorBlockCategory =
  'sponsor' |
  'intro' |
  'outro' |
  'selfpromo' |
  'preview' |
  'filler' |
  'interaction' |
  'music_offtopic' |
  'poi_highlight';


