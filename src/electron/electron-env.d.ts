import { YtDlpCommandOptions, YtDlpVideoMetadata } from '@/types';
import { FFmpegDownloadOptions } from '@/types/FfmpegCore';

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.mjs
     * │ │ └── preload.mjs
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Event system type for IPC event listeners
type EventSystem = {
  subscribe: (callback: (data: any) => void) => () => void;
  unsubscribe: (callback: (data: any) => void) => void;
  unsubscribeAll: () => void;
};

// Used in Renderer process, expose in `preload.ts`
interface Window {
  // Standard Electron IPC
  ipcRenderer: import('electron').IpcRenderer;
  
  // Custom API
  electronAPI: {
    getJSON: <T = YtDlpVideoMetadata>(
      url: string,
      options?: YtDlpCommandOptions
    ) => Promise<{
      success: boolean;
      data: T | null;
      code: number;
      message?: string;
    }>;
    executeCommand: (args: string[]) => Promise<{
      success: boolean;
      data: { stdout: string; stderr: string };
      code: number;
      message?: string;
    }>;
    ffmpeg: {
      download: (options: FFmpegDownloadOptions) => Promise<{
        success: boolean;
        data: { outputPath: string } | null;
        code: number;
        message?: string;
      }>;
      getActiveJobs: () => Promise<{
        success: boolean;
        data: { activeJobs: string[] } | null;
        code: number;
        message?: string;
      }>;
      cancelJob: (jobId: string) => Promise<{
        success: boolean;
        data: { canceled: boolean } | null;
        code: number;
        message?: string;
      }>;
      getJobInfo: (jobId: string) => Promise<{
        success: boolean;
        data: { jobInfo: any } | null;
        code: number;
        message?: string;
      }>;
      listJobs: () => Promise<{
        success: boolean;
        data: { jobs: any[] } | null;
        code: number;
        message?: string;
      }>;
      events: {
        progress: EventSystem;
        start: EventSystem;
        end: EventSystem;
        error: EventSystem;
        jobCancelled: EventSystem;
      };
    };
  };
}