import type {
  DeepPartial,
  YtDlpCommandOptions,
  YtDlpMediaMetadata,
} from "@/types";
import type {
  FFmpegDownloadOptions,
  JobInfo,
  JobResponse,
} from "@/types/FfmpegCore";
import type { GlobalSettings } from "@/types/Settings";

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string;
    VITE_PUBLIC: string;
  }
}

interface TerminalOutput {
  sessionId: string;
  type: "start" | "stdout" | "stderr" | "exit" | "error" | "killed";
  data?: string;
  code?: number;
  success?: boolean;
  error?: string;
  command?: string;
  args?: string[];
  timestamp: string;
}

interface TerminalExecuteParams {
  sessionId: string;
  command: string;
  args?: string[];
  options?: Record<string, any>;
  admin?: boolean;
}

interface TerminalSessionParams {
  sessionId: string;
}

type EventSystem = {
  subscribe: (callback: (data: any) => void) => () => void;
  unsubscribe: (callback: (data: any) => void) => void;
  unsubscribeAll: () => void;
};

declare global {
  interface Window {
    ipcRenderer: import("electron").IpcRenderer;

    electronAPI: {
      selectDirectory: (
        operation?: "import" | "export"
      ) => Promise<string | null>;

      getJSON: <T = YtDlpMediaMetadata>(
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
          data: JobResponse;
          code: number;
          message?: string;
        }>;
        getActiveJobs: () => Promise<{
          success: boolean;
          data: { activeJobs: JobInfo[] } | null;
          code: number;
          message?: string;
        }>;
        getQueuedJobs: () => Promise<{
          success: boolean;
          data: { queuedJobs: JobInfo[] } | null;
          code: number;
          message?: string;
        }>;
        getCompletedJobs: () => Promise<{
          success: boolean;
          data: { completedJobs: JobInfo[] } | null;
          code: number;
          message?: string;
        }>;
        cancelJob: (jobId: string) => Promise<{
          success: boolean;
          data: { canceled: boolean } | null;
          code: number;
          message?: string;
        }>;
        clearQueue: () => Promise<{
          success: boolean;
          data: { clearedCount: number } | null;
          code: number;
          message?: string;
        }>;
        cleanupCompletedJobs: (maxAgeMs?: number) => Promise<{
          success: boolean;
          data: null;
          code: number;
          message?: string;
        }>;
        getJobInfo: (jobId: string) => Promise<{
          success: boolean;
          data: { jobInfo: JobInfo | null } | null;
          code: number;
          message?: string;
        }>;
        listJobs: () => Promise<{
          success: boolean;
          data: { jobs: JobInfo[] } | null;
          code: number;
          message?: string;
        }>;
        retryJob: (jobId: string) => Promise<{
          success: boolean;
          data: JobResponse | null;
          code: number;
          message?: string;
        }>;
        events: {
          progress: EventSystem;
          start: EventSystem;
          end: EventSystem;
          error: EventSystem;
          jobCancelled: EventSystem;
          jobStart: EventSystem;
          queueUpdate: EventSystem;
          queueCleared: EventSystem;
        };
      };

      terminal: {
        createSession: () => Promise<{
          success: boolean;
          sessionId: string;
          message?: string;
        }>;
        executeCommand: (params: TerminalExecuteParams) => Promise<{
          success: boolean;
          code?: number;
          error?: string;
        }>;
        killProcess: (params: TerminalSessionParams) => Promise<{
          success: boolean;
          error?: string;
        }>;
        closeSession: (params: TerminalSessionParams) => Promise<{
          success: boolean;
          error?: string;
        }>;
        onOutput: (callback: (data: TerminalOutput) => void) => () => void;
      };

      settings: {
        getSettings: () => Promise<{
          success: boolean;
          data: GlobalSettings | null;
          code: number;
          message?: string;
        }>;
        updateSettings: (settings: DeepPartial<GlobalSettings>) => Promise<{
          success: boolean;
          data: GlobalSettings | null;
          code: number;
          message?: string;
        }>;
        resetToDefaults: () => Promise<{
          success: boolean;
          data: GlobalSettings | null;
          code: number;
          message?: string;
        }>;
      };

      dialog: {
        selectDirectory: () => Promise<{
          success: boolean;
          data: { path: string } | null;
          code: number;
          message?: string;
        }>;
        selectFile: () => Promise<{
          success: boolean;
          data: { path: string } | null;
          code: number;
          message?: string;
        }>;
      };

      shell: {
        openFolder: (path: string) => Promise<{
          success: boolean;
          data: null;
          code: number;
          message?: string;
        }>;
        openFile: (path: string) => Promise<{
          success: boolean;
          data: null;
          code: number;
          message?: string;
        }>;
        showItemInFolder: (path: string) => Promise<{
          success: boolean;
          data: null;
          code: number;
          message?: string;
        }>;
        openExternal: (path: string) => Promise<{
          success: boolean;
          data: null;
          code: number;
          message?: string;
        }>;
      };
    };
  }
}
