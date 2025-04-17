export * from "./YtDlpCore"
export * from "./YtDlpMetadata"
export * from "./FfmpegCore"
export * from "./Settings"


export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };