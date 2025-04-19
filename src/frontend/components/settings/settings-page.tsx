import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  AlertCircleIcon,
  Info,
  Loader2,
  RefreshCw,
  Save,
  Undo,
  Check,
  XIcon,
  FolderOpen,
  AlertTriangleIcon,
} from "lucide-react";
import isEqual from "lodash/isEqual";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

import { useGlobalContext } from "@/context/global-context";

import { GlobalSettings } from "@/types";

const FILENAME_VARIABLES = [
  { name: "title", description: "Video title" },
  { name: "id", description: "Video ID" },
  { name: "uploader", description: "Uploader name (channel/artist/etc.)" },
  { name: "channel", description: "Channel name (if applicable)" },
  { name: "upload_date", description: "Upload date (formatted)" },
  { name: "timestamp", description: "Download timestamp" },
  { name: "duration", description: "Duration in seconds" },
  { name: "view_count", description: "View count (if available)" },
  { name: "like_count", description: "Like count (if available)" },
  { name: "resolution", description: "Video resolution/Audio quality" },
  { name: "ext", description: "File extension" },
  { name: "format_id", description: "Selected format ID" },
  { name: "quality", description: "Quality setting used" },
  { name: "type", description: "Media type (video, audio, etc.)" },
  { name: "artist", description: "Artist name (audio)" },
  { name: "album", description: "Album name (audio)" },
  { name: "track", description: "Track name/number (audio)" },
];
const DATE_FORMATS = [
  { format: "YYYY-MM-DD", example: "2023-04-15" },
  { format: "MM/DD/YYYY", example: "04/15/2023" },
  { format: "DD.MM.YYYY", example: "15.04.2023" },
  { format: "YYYYMMDD", example: "20230415" },
  { format: "YYYY/MM/DD", example: "2023/04/15" },
  { format: "MMMM D, YYYY", example: "April 15, 2023" },
  { format: "D MMMM YYYY", example: "15 April 2023" },
];

const formSchema = z.object({
  downloadPaths: z.object({
    video: z.string().min(1, "Video path is required"),
    audio: z.string().min(1, "Audio path is required"),
    image: z.string().min(1, "Image path is required"),
    playlist: z.string().optional(),
    combined: z.string().optional(),
  }),
  ffmpeg: z.object({
    defaultQuality: z.enum(["high", "medium", "low", "original"] as const),
    defaultVideoFormat: z.string().min(1, "Video format required"),
    defaultAudioFormat: z.string().min(1, "Audio format required"),
    defaultImageFormat: z.string().min(1, "Image format required"),
    maxConcurrentJobs: z.number().min(1).max(10),
    cooldownTimeBetweenJobs: z.number().min(0).max(60),
  }),
  uiAutoStart: z.object({ autoStart: z.boolean() }),
  filenameTemplate: z.object({
    enabled: z.boolean(),
    template: z.string().min(1, "Template required when enabled"),
    sanitizeFilename: z.boolean(),
    maxLength: z.number().min(0).max(255),
    dateFormat: z.string().min(1, "Date format required"),
    handleDuplicates: z.boolean(),
  }),
  uiApp: z.object({
    theme: z.enum(["light", "dark", "system"] as const),
    saveHistory: z.boolean(),
    showNotifications: z.boolean(),
    confirmBeforeDelete: z.boolean(),
    maxHistoryItems: z.number().min(10).max(10000),
  }),
  updateSettings: z.object({
    autoCheckUpdates: z.boolean(),
    notifyOnUpdates: z.boolean(),
    checkFrequency: z.enum([
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "never",
    ] as const),
    preferNightlyYtdlp: z.boolean(),
    autoUpdateYtdlp: z.boolean(),
  }),
  historyCleanup: z.object({
    maxCompletedJobsToKeep: z.number().min(10).max(10000),
    autoCleanupCompletedJobs: z.boolean(),
    autoCleanupTimeHours: z.number().min(1).max(720),
  }),
  ytdlp: z.object({
    ytdlpPath: z.string().min(1, "yt-dlp path required"),
    maxRetries: z.number().min(0).max(10),
    timeout: z.number().min(1000).max(300000),
    verbose: z.boolean(),
    proxy: z.string().optional(),
    cookies: z.string().optional(),
    userAgent: z.string().optional(),
    referer: z.string().optional(),
    skipUnavailableFragments: z.boolean(),
    maxBuffer: z
      .number()
      .min(1024 * 1024)
      .max(2 * 1024 * 1024 * 1024),
  }),
});
type SettingsFormValues = z.infer<typeof formSchema>;

const mapFormToGlobalSettings = (
  values: SettingsFormValues,
  currentSettings: GlobalSettings | null
): GlobalSettings => {
  if (!currentSettings) {
    throw new Error(
      "Cannot map settings: current global settings are missing."
    );
  }
  return {
    downloadPaths: {
      video: values.downloadPaths.video,
      audio: values.downloadPaths.audio,
      image: values.downloadPaths.image,
      playlist: values.downloadPaths.playlist,

      combined: values.downloadPaths.combined || values.downloadPaths.video,
    },
    ffmpeg: {
      ffmpegPath: currentSettings.ffmpeg.ffmpegPath,
      defaultQuality: values.ffmpeg.defaultQuality,
      defaultVideoFormat: values.ffmpeg.defaultVideoFormat,
      defaultAudioFormat: values.ffmpeg.defaultAudioFormat,
      defaultImageFormat: values.ffmpeg.defaultImageFormat,
      maxConcurrentJobs: values.ffmpeg.maxConcurrentJobs,
      cooldownTimeBetweenJobs: values.ffmpeg.cooldownTimeBetweenJobs,

      maxCompletedJobsToKeep: values.historyCleanup.maxCompletedJobsToKeep,
      autoCleanupCompletedJobs: values.historyCleanup.autoCleanupCompletedJobs,
      autoCleanupTimeMs: values.historyCleanup.autoCleanupTimeHours * 3600000,
    },
    filenameTemplate: {
      enabled: values.filenameTemplate.enabled,
      template: values.filenameTemplate.template,
      sanitizeFilename: values.filenameTemplate.sanitizeFilename,
      maxLength: values.filenameTemplate.maxLength,
      dateFormat: values.filenameTemplate.dateFormat,
      handleDuplicates: values.filenameTemplate.handleDuplicates,
    },
    ui: {
      autoStart: values.uiAutoStart.autoStart,
      theme: values.uiApp.theme,
      saveHistory: values.uiApp.saveHistory,
      showNotifications: values.uiApp.showNotifications,
      confirmBeforeDelete: values.uiApp.confirmBeforeDelete,
      maxHistoryItems: values.uiApp.maxHistoryItems,
    },
    site: {
      autoCheckUpdates: values.updateSettings.autoCheckUpdates,
      notifyOnUpdates: values.updateSettings.notifyOnUpdates,
      checkFrequency: values.updateSettings.checkFrequency,
      preferNightlyYtdlp: values.updateSettings.preferNightlyYtdlp,
      autoUpdateYtdlp: values.updateSettings.autoUpdateYtdlp,

      lastUpdateCheck: currentSettings.site.lastUpdateCheck,
    },
    ytdlp: {
      ...values.ytdlp,

      proxy: values.ytdlp.proxy || undefined,
      cookies: values.ytdlp.cookies || undefined,
      userAgent: values.ytdlp.userAgent || undefined,
      referer: values.ytdlp.referer || undefined,
    },
  };
};

const mapGlobalSettingsToForm = (
  settings: GlobalSettings
): SettingsFormValues => {
  return {
    downloadPaths: settings.downloadPaths,
    ffmpeg: {
      defaultQuality: settings.ffmpeg.defaultQuality,
      defaultVideoFormat: settings.ffmpeg.defaultVideoFormat,
      defaultAudioFormat: settings.ffmpeg.defaultAudioFormat,
      defaultImageFormat: settings.ffmpeg.defaultImageFormat,
      maxConcurrentJobs: settings.ffmpeg.maxConcurrentJobs,
      cooldownTimeBetweenJobs: settings.ffmpeg.cooldownTimeBetweenJobs,
    },
    uiAutoStart: {
      autoStart: settings.ui.autoStart,
    },
    filenameTemplate: settings.filenameTemplate,
    uiApp: {
      theme: settings.ui.theme,
      saveHistory: settings.ui.saveHistory,
      showNotifications: settings.ui.showNotifications,
      confirmBeforeDelete: settings.ui.confirmBeforeDelete,
      maxHistoryItems: settings.ui.maxHistoryItems,
    },
    updateSettings: {
      autoCheckUpdates: settings.site.autoCheckUpdates,
      notifyOnUpdates: settings.site.notifyOnUpdates,
      checkFrequency: settings.site.checkFrequency,
      preferNightlyYtdlp: settings.site.preferNightlyYtdlp,
      autoUpdateYtdlp: settings.site.autoUpdateYtdlp,
    },
    historyCleanup: {
      maxCompletedJobsToKeep: settings.ffmpeg.maxCompletedJobsToKeep,
      autoCleanupCompletedJobs: settings.ffmpeg.autoCleanupCompletedJobs,
      autoCleanupTimeHours: Math.max(
        1,
        Math.round(settings.ffmpeg.autoCleanupTimeMs / 3600000)
      ),
    },
    ytdlp: {
      ...settings.ytdlp,

      proxy: settings.ytdlp.proxy || "",
      cookies: settings.ytdlp.cookies || "",
      userAgent: settings.ytdlp.userAgent || "",
      referer: settings.ytdlp.referer || "",
    },
  };
};

export function GlobalSettingsPage() {
  const {
    globalSettings,
    updateGlobalSettings,
    refreshGlobalSettings,
    isSettingsLoading: isContextLoading,
    settingsError,
  } = useGlobalContext();

  const [isProcessing, setIsProcessing] = useState(false);

  const [initialFormValues, setInitialFormValues] =
    useState<SettingsFormValues | null>(null);
  const [previewFilename, setPreviewFilename] = useState(
    "Example Video [abc123].mp4"
  );

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  });

  const {
    reset,
    formState: { isDirty },
    watch,
    getValues,
    setValue,
  } = form;

  useEffect(() => {
    if (globalSettings && !isContextLoading && !settingsError) {
      console.log("Mapping GlobalSettings to form on mount/update...");
      try {
        const mappedValues = mapGlobalSettingsToForm(globalSettings);
        reset(mappedValues);
        setInitialFormValues(mappedValues);
        generatePreview(mappedValues.filenameTemplate);
        console.log("Form reset complete.");
      } catch (error) {
        console.error("Error mapping settings to form:", error);
        toast.error("Form Error", {
          description: "Could not populate settings form.",
        });
      }
    }
  }, [globalSettings, isContextLoading, settingsError, reset]);

  const formatDateForPreview = useCallback(
    (dateStr: string, format: string) => {
      if (!dateStr || dateStr.length !== 8 || !/^\d{8}$/.test(dateStr))
        return "2023-04-15";
      const year = dateStr.substring(0, 4),
        month = dateStr.substring(4, 6),
        day = dateStr.substring(6, 8);
      try {
        const date = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day)
        );
        const monthNames = [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];
        return format
          .replace("YYYY", year)
          .replace("MM", month)
          .replace("DD", day)
          .replace("MMMM", monthNames[date.getMonth()])
          .replace("D", day.startsWith("0") ? day.substring(1) : day);
      } catch (e) {
        return "2023-04-15";
      }
    },
    []
  );

  const generatePreview = useCallback(
    (templateValues: SettingsFormValues["filenameTemplate"] | undefined) => {
      if (!templateValues?.enabled) {
        setPreviewFilename("Example Video.mp4");
        return;
      }
      const rawDate = "20230415";
      const formattedDate = formatDateForPreview(
        rawDate,
        templateValues.dateFormat || "YYYY-MM-DD"
      );
      const mockData = {
        /* ... same mock data ... */ title: "Example Video Title",
        id: "vid123",
        uploader: "Example Channel",
        channel: "Example Channel",
        upload_date: formattedDate,
        timestamp: Date.now().toString(),
        duration: "360",
        view_count: "123456",
        like_count: "7890",
        resolution: "1080p",
        ext: "mp4",
        format_id: "22",
        quality: "high",
        type: "video",
        artist: "Example Artist",
        album: "Example Album",
        track: "Example Track",
      };
      let filename = templateValues.template || "";
      FILENAME_VARIABLES.forEach((variable) => {
        const key = variable.name as keyof typeof mockData;
        filename = filename.replace(
          new RegExp(`\\$\\{${key}\\}`, "g"),
          mockData[key] || ""
        );
      });
      if (templateValues.sanitizeFilename) {
        filename = filename.replace(/[\/\\?%*:|"<>]/g, "_").trim();
      }
      if (!/\.[^./]+$/.test(filename)) {
        filename += `.${mockData.ext}`;
      }
      const extMatch = filename.match(/\.[^.]+$/),
        ext = extMatch ? extMatch[0] : "";
      let base = ext
        ? filename.substring(0, filename.length - ext.length)
        : filename;
      if (
        templateValues.maxLength > 0 &&
        base.length > templateValues.maxLength - ext.length
      ) {
        base = base.substring(0, templateValues.maxLength - ext.length);
        filename = base + ext;
      }
      if (templateValues.handleDuplicates) {
        const dupExt = ext || ".ext";
        filename = filename.replace(
          new RegExp(`\\${dupExt}$`),
          ` (1)${dupExt}`
        );
      }
      if (!filename.trim() || filename.trim() === ext) {
        filename = `preview_download.${mockData.ext}`;
      }
      setPreviewFilename(filename);
    },
    [formatDateForPreview]
  );

  useEffect(() => {
    const subscription = watch((value, { name }) => {
      if (name && name.startsWith("filenameTemplate.")) {
        generatePreview(value.filenameTemplate);
      }
    });

    const currentTemplateValues = getValues("filenameTemplate");
    if (currentTemplateValues) {
      generatePreview(currentTemplateValues);
    }
    return () => subscription.unsubscribe();
  }, [watch, generatePreview, getValues]);

  const insertVariable = useCallback(
    (variable: string) => {
      const currentTemplate = getValues("filenameTemplate.template") || "";
      const templateInput = document.getElementById(
        "filenameTemplate.template"
      ) as HTMLInputElement | null;
      const cursorPosition =
        templateInput?.selectionStart ?? currentTemplate.length;
      const newTemplate = `${currentTemplate.substring(
        0,
        cursorPosition
      )}\${${variable}}${currentTemplate.substring(cursorPosition)}`;
      setValue("filenameTemplate.template", newTemplate, {
        shouldValidate: true,
        shouldDirty: true,
      });
      templateInput?.focus();
      setTimeout(() => {
        const newPos = cursorPosition + variable.length + 3;
        templateInput?.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [getValues, setValue]
  );

  const handleSelectDirectory = useCallback(
    async (fieldName: keyof SettingsFormValues["downloadPaths"]) => {
      try {
        if (!window.electronAPI?.dialog?.selectDirectory)
          throw new Error("Dialog API not available");
        const response = await window.electronAPI.dialog.selectDirectory();
        if (response.success && response.data?.path) {
          setValue(`downloadPaths.${fieldName}`, response.data.path, {
            shouldValidate: true,
            shouldDirty: true,
          });
        } else if (
          !response.success &&
          response.message !== "Dialog was canceled."
        ) {
          toast.error("Error Selecting Directory", {
            description: response.message || "Failed.",
          });
        }
      } catch (error: any) {
        console.error("Failed to select directory:", error);
        toast.error("Error", {
          description: error.message || "Failed to open directory dialog.",
        });
      }
    },
    [setValue]
  );

  const handleSelectFile = useCallback(
    async (fieldName: keyof SettingsFormValues["ytdlp"]) => {
      try {
        if (!window.electronAPI?.dialog?.selectFile)
          throw new Error("Dialog API not available");
        const response = await window.electronAPI.dialog.selectFile();
        if (response.success && response.data?.path) {
          setValue(`ytdlp.${fieldName}`, response.data.path, {
            shouldValidate: true,
            shouldDirty: true,
          });
        } else if (
          !response.success &&
          response.message !== "Dialog was canceled."
        ) {
          toast.error("Error Selecting File", {
            description: response.message || "Failed.",
          });
        }
      } catch (error: any) {
        console.error("Failed to select file:", error);
        toast.error("Error", {
          description: error.message || "Failed to open file dialog.",
        });
      }
    },
    [setValue]
  );

  const onSubmit = useCallback(
    async (values: SettingsFormValues) => {
      if (!isDirty && initialFormValues && isEqual(values, initialFormValues)) {
        toast.info("No Changes Detected", {
          description: "Settings haven't been modified.",
        });
        return;
      }

      console.log("Form values submitted:", values);
      setIsProcessing(true);
      try {
        const settingsToSave = mapFormToGlobalSettings(values, globalSettings);
        console.log("Mapped GlobalSettings for update:", settingsToSave);

        const success = await updateGlobalSettings(settingsToSave);

        if (success) {
          toast.success("Settings Saved", {
            icon: <Check className="h-4 w-4" />,
          });

          reset(values);
          setInitialFormValues(values);
        } else {
          toast.error("Save Failed", {
            description: "Could not save settings. Check logs.",
            icon: <XIcon className="h-4 w-4" />,
          });
        }
      } catch (error: any) {
        console.error("Failed to save settings:", error);
        toast.error("Error Saving Settings", {
          description: error.message || "An unknown error occurred.",
          icon: <XIcon className="h-4 w-4" />,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [globalSettings, updateGlobalSettings, reset, isDirty, initialFormValues]
  );

  const resetToDefaults = useCallback(async () => {
    // first check is there any active downloads
    if (typeof window.electronAPI.ffmpeg.getActiveJobs === "function") {
      const activeJobs = await window.electronAPI.ffmpeg.getActiveJobs();
      if (activeJobs.success && activeJobs.data.activeJobs.length > 0) {
        toast.error("Cannot Reset Settings", {
          description:
            "There are active downloads. Please wait for them to finish.",
          icon: <XIcon className="h-4 w-4" />,
        });
        return;
      }
    }

    if (
      !window.confirm("Reset all settings to defaults? This cannot be undone.")
    )
      return;
    setIsProcessing(true);
    try {
      if (!window.electronAPI?.settings?.resetToDefaults) {
        throw new Error("Settings reset API not available");
      }

      const response = await window.electronAPI.settings.resetToDefaults();

      if (response.success && response.data) {
        const defaultSettings: GlobalSettings = response.data;

        const mappedDefaults = mapGlobalSettingsToForm(defaultSettings);

        reset(mappedDefaults);
        setInitialFormValues(mappedDefaults);
        generatePreview(mappedDefaults.filenameTemplate);

        await refreshGlobalSettings();
        toast.warning("Settings Reset", {
          description: "Settings have been reset to defaults.",
        });
      } else {
        throw new Error(
          response.message || "Failed to reset settings via API."
        );
      }
    } catch (error: any) {
      console.error("Failed to reset settings:", error);
      toast.error("Error Resetting Settings", {
        description: error.message || "An unknown error occurred.",
        icon: <XIcon className="h-4 w-4" />,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [reset, refreshGlobalSettings, generatePreview]);

  const renderDownloadsTab = () => (
    <div className="space-y-6">
      {/* Download Locations */}
      <Card>
        <CardHeader>
          <CardTitle>Download Locations</CardTitle>
          <CardDescription>
            Choose where different types of media files will be saved on your
            computer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(["video", "audio", "image"] as const).map((type) => (
            <FormField
              key={type}
              control={form.control}
              name={`downloadPaths.${type}`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="capitalize">{type} Path</FormLabel>
                  <FormDescription>
                    Folder for downloaded {type} files.
                  </FormDescription>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        {...field}
                        placeholder={`e.g., C:\\Users\\You\\Downloads\\${
                          type.charAt(0).toUpperCase() + type.slice(1)
                        }`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleSelectDirectory(type)}
                        disabled={isProcessing}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" /> Browse
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          {/* Currenly not implimanted */}
          {/* <FormField
            control={form.control}
            name="downloadPaths.combined"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Combined Path (Optional)</FormLabel>
                <FormDescription>
                  Folder where combined video and audio files are saved. If
                  empty, uses the Video Path.
                </FormDescription>
                <FormControl>
                  <div className="flex gap-2">
                    <Input {...field} placeholder="Defaults to Video Path" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSelectDirectory("combined")}
                      disabled={isProcessing}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" /> Browse
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </CardContent>
      </Card>

      {/* Default Formats & Quality */}
      <Card>
        <CardHeader>
          <CardTitle>Default Formats & Quality</CardTitle>
          <CardDescription>
            Set preferred file types and quality for downloads, especially when
            conversion is needed.
          </CardDescription>
          <Alert variant="destructive">
            <AlertTitle className="flex gap-1">
              <AlertTriangleIcon className="h-3 my-auto w-3" /> Warning
            </AlertTitle>
            <AlertDescription>
              Changing the default audio format is not recommended unless you're
              sure what you're doing. Unsupported formats may cause conversion
              failures or playback issues.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="ffmpeg.defaultQuality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conversion Quality</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="original">
                      Original (No Conversion if possible)
                    </SelectItem>
                    <SelectItem value="high">
                      High (Best quality conversion)
                    </SelectItem>
                    <SelectItem value="medium">
                      Medium (Balanced quality/size)
                    </SelectItem>
                    <SelectItem value="low">Low (Smaller file size)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Quality level used when converting files (e.g., changing audio
                  codec).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ffmpeg.defaultVideoFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Video Format</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mp4">MP4 (Widely Compatible)</SelectItem>
                    <SelectItem value="mkv">
                      MKV (Flexible Container)
                    </SelectItem>
                    <SelectItem value="webm">WebM (Web Optimized)</SelectItem>
                    <SelectItem value="mov">MOV (Apple QuickTime)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Preferred video container when format isn't specified or
                  conversion is needed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ffmpeg.defaultAudioFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Audio Format</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="mp3">MP3 (Compatible)</SelectItem>
                    <SelectItem value="m4a">M4A (AAC, Good Quality)</SelectItem>
                    <SelectItem value="opus">Opus (Efficient, Web)</SelectItem>
                    {/* Disable OGG audio input format becuase it cause error in conversion */}
                    {/* <SelectItem value="ogg">OGG (Vorbis)</SelectItem> */}
                    <SelectItem value="wav">WAV (Uncompressed)</SelectItem>
                    <SelectItem value="flac">FLAC (Lossless)</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Preferred format for audio-only downloads or conversions.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ffmpeg.defaultImageFormat"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default Image Format</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="jpg">JPG (Good Compression)</SelectItem>
                    <SelectItem value="png">
                      PNG (Lossless, Transparency)
                    </SelectItem>
                    <SelectItem value="webp">
                      WebP (Modern, Efficient)
                    </SelectItem>
                    <SelectItem value="avif">
                      AVIF (Newest, Very Efficient)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Preferred format when saving thumbnails or images.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Download Performance</CardTitle>
          <CardDescription>
            Control how many downloads run at once and the timing between them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="uiAutoStart.autoStart"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Auto Start Downloads
                  </FormLabel>
                  <FormDescription>
                    Start downloading immediately when a link is added or
                    chosen, instead of waiting in queue.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ffmpeg.maxConcurrentJobs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Concurrent Downloads: {field.value}</FormLabel>
                <FormControl>
                  <Slider
                    min={1}
                    max={10}
                    step={1}
                    value={[field.value]}
                    onValueChange={(v) => field.onChange(v[0])}
                  />
                </FormControl>
                <FormDescription>
                  How many downloads can run at the same time. Higher values
                  need more system resources and bandwidth.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ffmpeg.cooldownTimeBetweenJobs"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cooldown Between Jobs: {field.value} sec</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={60}
                    step={1}
                    value={[field.value]}
                    onValueChange={(v) => field.onChange(v[0])}
                  />
                </FormControl>
                <FormDescription>
                  Wait time (in seconds) before starting the next download in a
                  batch. Helps prevent overwhelming websites or getting
                  rate-limited.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );

  const renderFilenamesTab = () => (
    <Card>
      <CardHeader>
        <CardTitle>Filename Generation</CardTitle>
        <CardDescription>
          Customize how downloaded files are named using templates and
          variables.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <FormField
          control={form.control}
          name="filenameTemplate.enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">
                  Use Custom Filename Template
                </FormLabel>
                <FormDescription>
                  Enable this to use the template below. If disabled, files will
                  typically be named using the media title.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
        {watch("filenameTemplate.enabled") && (
          <div className="space-y-4 pl-4 border-l-2 ml-2">
            {/* Template Input Field */}
            <FormField
              control={form.control}
              name="filenameTemplate.template"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center">
                    <FormLabel>Filename Template</FormLabel>
                    {/* Variables Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Info className="h-4 w-4 mr-2" /> Variables
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-96 max-h-80 overflow-y-auto">
                        <div className="space-y-3">
                          <h4 className="font-medium leading-none">
                            Available Variables
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            Click a variable to insert it into the template
                            below.
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {FILENAME_VARIABLES.map((v) => (
                              <div
                                key={v.name}
                                className="flex flex-col p-2 border rounded-md"
                              >
                                <Badge
                                  variant="secondary"
                                  className="cursor-pointer hover:bg-accent self-start mb-1"
                                  onClick={() => insertVariable(v.name)}
                                >{`\${${v.name}}`}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {v.description}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <FormDescription>
                    Construct the filename using text and variables (e.g., `$
                    {"{uploader}"} - ${"{title}"}.${"{ext}"}`).
                  </FormDescription>
                  <FormControl>
                    <Input
                      {...field}
                      id="filenameTemplate.template"
                      placeholder="${title}.${ext}"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Sanitize Filenames Switch */}
            <FormField
              control={form.control}
              name="filenameTemplate.sanitizeFilename"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Sanitize Filenames
                    </FormLabel>
                    <FormDescription>
                      Automatically remove characters that are not allowed in
                      filenames (like `/`, `\`, `:`, `*`, `?`, `"`, `&lt;`,
                      `&gt;`, `|`).
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {/* Handle Duplicates Switch */}
            <FormField
              control={form.control}
              name="filenameTemplate.handleDuplicates"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Handle Duplicate Filenames
                    </FormLabel>
                    <FormDescription>
                      If a file with the generated name already exists, append a
                      number (e.g., `file (1).mp4`).
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {/* Max Length Slider */}
            <FormField
              control={form.control}
              name="filenameTemplate.maxLength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Max Filename Length:{" "}
                    {field.value === 0
                      ? "Unlimited"
                      : `${field.value} characters`}
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={255}
                      step={5}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum allowed characters for the filename *before* the
                    extension (e.g., `.mp4`). Set to 0 for no limit.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Date Format Select */}
            <FormField
              control={form.control}
              name="filenameTemplate.dateFormat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Date Format for `${"{upload_date}"}` Variable
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DATE_FORMATS.map((fmt) => (
                        <SelectItem key={fmt.format} value={fmt.format}>
                          {fmt.example} ({fmt.format})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Choose how dates are formatted when using the `$
                    {"{upload_date}"}` variable.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        {/* Preview Section */}
        <div className="mt-6 p-4 border rounded-lg bg-muted/40">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium">Filename Preview:</div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => generatePreview(getValues("filenameTemplate"))}
              title="Refresh Preview"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm font-mono bg-background p-2 rounded border text-foreground/80 break-all">
            {previewFilename}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderApplicationTab = () => (
    <div className="space-y-6">
      {/* Application Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Application Behavior</CardTitle>
          <CardDescription>
            Customize the user interface and general application interactions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Theme Select */}
          <FormField
            control={form.control}
            name="uiApp.theme"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Theme</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Choose the visual appearance (Light, Dark, or match your OS
                  setting).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Switches */}
          {[
            {
              name: "saveHistory" as const,
              label: "Save Download History",
              desc: "Keep the list of completed/failed downloads when you close and reopen the app.",
            },
            {
              name: "showNotifications" as const,
              label: "Show Desktop Notifications",
              desc: "Display system notifications for events like download completion or errors.",
            },
            {
              name: "confirmBeforeDelete" as const,
              label: "Confirm Before Deleting History",
              desc: "Show a confirmation prompt before removing items from the download history.",
            },
          ].map((item) => (
            <FormField
              key={item.name}
              control={form.control}
              name={`uiApp.${item.name}`}
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">{item.label}</FormLabel>
                    <FormDescription>{item.desc}</FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ))}
          {/* Max History Items Slider */}
          <FormField
            control={form.control}
            name="uiApp.maxHistoryItems"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Max History Items Displayed: {field.value}
                </FormLabel>
                <FormControl>
                  <Slider
                    min={10}
                    max={10000}
                    step={10}
                    value={[field.value]}
                    onValueChange={(v) => field.onChange(v[0])}
                  />
                </FormControl>
                <FormDescription>
                  Limits how many past downloads are shown on the History page.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Update Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Updates (yt-dlp Engine)</CardTitle>
          <CardDescription>
            Control how the core download engine (yt-dlp) is kept up-to-date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto Check Switch */}
          <FormField
            control={form.control}
            name="updateSettings.autoCheckUpdates"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Automatically Check for Updates
                  </FormLabel>
                  <FormDescription>
                    Allow the application to periodically check if a newer
                    version of yt-dlp is available.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {/* Conditional Update Options */}
          {watch("updateSettings.autoCheckUpdates") && (
            <div className="space-y-4 pl-4 border-l-2 ml-2">
              {/* Check Frequency Select */}
              <FormField
                control={form.control}
                name="updateSettings.checkFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="hourly">Hourly</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="never">
                          Never (Manual Only)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      How often the app checks for yt-dlp updates (if auto-check
                      is enabled).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {/* Notify Switch */}
              <FormField
                control={form.control}
                name="updateSettings.notifyOnUpdates"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Notify When Update Found
                      </FormLabel>
                      <FormDescription>
                        Show a desktop notification when a new yt-dlp version is
                        available (if auto-check is enabled).
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/* Prefer Nightly Switch */}
              <FormField
                control={form.control}
                name="updateSettings.preferNightlyYtdlp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Prefer Nightly Builds
                      </FormLabel>
                      <FormDescription>
                        Target the latest development (nightly) builds instead
                        of official stable releases. Nightly builds have the
                        newest features/fixes but might be less stable.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              {/* Auto Update Switch */}
              <FormField
                control={form.control}
                name="updateSettings.autoUpdateYtdlp"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Automatically Install Updates
                      </FormLabel>
                      <FormDescription>
                        Download and install the recommended yt-dlp update in
                        the background without asking (if auto-check is
                        enabled).
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderAdvancedTab = () => (
    <div className="space-y-6">
      {/* History & Job Management */}
      <Card>
        <CardHeader>
          <CardTitle>History & Job Management</CardTitle>
          <CardDescription>
            Control internal storage limits and cleanup for completed download
            records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Max Completed Jobs Slider */}
          <FormField
            control={form.control}
            name="historyCleanup.maxCompletedJobsToKeep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Completed Job Records: {field.value}</FormLabel>
                <FormControl>
                  <Slider
                    min={10}
                    max={10000}
                    step={10}
                    value={[field.value]}
                    onValueChange={(v) => field.onChange(v[0])}
                  />
                </FormControl>
                <FormDescription>
                  Maximum number of completed download records kept internally
                  by the download engine (distinct from the items shown on the
                  History page).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Auto-Cleanup Switch */}
          <FormField
            control={form.control}
            name="historyCleanup.autoCleanupCompletedJobs"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Automatically Cleanup Old Job Records
                  </FormLabel>
                  <FormDescription>
                    Periodically remove very old internal records of completed
                    jobs to save space.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          {/* Conditional Cleanup Time */}
          {watch("historyCleanup.autoCleanupCompletedJobs") && (
            <FormField
              control={form.control}
              name="historyCleanup.autoCleanupTimeHours"
              render={({ field }) => (
                <FormItem className="pl-4 border-l-2 ml-2">
                  <FormLabel>
                    Cleanup Records Older Than: {field.value} hours
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={720}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    Internal job records older than this duration will be
                    removed during automatic cleanup (1-720 hours).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </CardContent>
      </Card>

      {/* Yt-dlp Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>yt-dlp Configuration</CardTitle>
          <CardDescription>
            Fine-tune the behavior of the yt-dlp download engine. Use with
            caution.
          </CardDescription>
          {/* Alert for Path Importance */}
          <Alert
            variant="default"
            className="mt-2 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800"
          >
            <AlertCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">
              yt-dlp Path/Command
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              This should be the command name (like `yt-dlp`) if it's in your
              system's PATH, or the full path to the executable (e.g.,
              `/usr/local/bin/yt-dlp` or `C:\Tools\yt-dlp.exe`). It's usually
              detected automatically.
            </AlertDescription>
          </Alert>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Path Input */}
          <FormField
            control={form.control}
            name="ytdlp.ytdlpPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel>yt-dlp Executable Path or Command</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="yt-dlp" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Retries and Timeout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ytdlp.maxRetries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Retries: {field.value}</FormLabel>
                  <FormControl>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[field.value]}
                      onValueChange={(v) => field.onChange(v[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    How many times yt-dlp tries again if downloading a piece of
                    the media fails.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ytdlp.timeout"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Network Timeout: {field.value / 1000} sec
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1000}
                      max={300000}
                      step={1000}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value, 10) || 1000)
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Max time (in milliseconds) to wait for a network response
                    before giving up (1000ms = 1s).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {/* Proxy Input */}
          <FormField
            control={form.control}
            name="ytdlp.proxy"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proxy Server URL (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="http://user:pass@proxy.example.com:8080"
                  />
                </FormControl>
                <FormDescription>
                  Route downloads through a proxy. Format:
                  `protocol://[user:pass@]host:port`. Leave empty if not needed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Cookies File Input */}
          <FormField
            control={form.control}
            name="ytdlp.cookies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cookies File Path (Optional)</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input {...field} placeholder="/path/to/your/cookies.txt" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSelectFile("cookies")}
                      disabled={isProcessing}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" /> Browse
                    </Button>
                  </div>
                </FormControl>
                <FormDescription>
                  Path to a cookies file (Netscape format). Needed for sites
                  requiring login. Use a browser extension like 'Get cookies.txt
                  LOCALLY' to export.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* User-Agent Input */}
          <FormField
            control={form.control}
            name="ytdlp.userAgent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom User-Agent (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
                  />
                </FormControl>
                <FormDescription>
                  Make yt-dlp identify as a specific browser. Usually not
                  required.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Referer Input */}
          <FormField
            control={form.control}
            name="ytdlp.referer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Custom Referer URL (Optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="https://www.example.com/source-page"
                  />
                </FormControl>
                <FormDescription>
                  Specify the URL the download request should appear to come
                  from. Usually not required.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Switches (Verbose, Skip Fragments) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ytdlp.verbose"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel>Verbose Logging</FormLabel>
                    <FormDescription>
                      Enable detailed yt-dlp output in logs, useful for
                      debugging issues.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ytdlp.skipUnavailableFragments"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between border p-4 rounded-lg">
                  <div className="space-y-0.5">
                    <FormLabel>Skip Unavailable Fragments</FormLabel>
                    <FormDescription>
                      Try to complete downloads even if some parts are missing.
                      May result in incomplete or corrupted files.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
          {/* Max Buffer Input */}
          <FormField
            control={form.control}
            name="ytdlp.maxBuffer"
            render={({ field }) => (
              <FormItem>
                {/* Display calculated MB value */}
                <FormLabel>
                  Max Download Buffer Size:{" "}
                  {Math.round(field.value / (1024 * 1024))} MB
                </FormLabel>
                <FormControl>
                  {/* Input field still works with bytes */}
                  <Input
                    type="number"
                    min={1 * 1024 * 1024}
                    max={2 * 1024 * 1024 * 1024}
                    step={1 * 1024 * 1024}
                    value={field.value}
                    onChange={(e) => {
                      const bytes = parseInt(e.target.value, 10);

                      const clampedBytes = Math.max(
                        1 * 1024 * 1024,
                        Math.min(
                          bytes || 1 * 1024 * 1024,
                          2 * 1024 * 1024 * 1024
                        )
                      );
                      field.onChange(clampedBytes);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  Memory buffer size (in bytes) for downloads. Larger values
                  might help on very fast connections but use more RAM. (Min:
                  1MB, Max: 2GB)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );

  if (isContextLoading || !initialFormValues) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Settings...</span>
      </div>
    );
  }
  if (settingsError) {
    return (
      <Alert variant="destructive" className="m-4">
        <AlertCircleIcon className="h-4 w-4" />
        <AlertTitle>Error Loading Settings</AlertTitle>
        <AlertDescription>{settingsError}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6 p-4 md:p-6"
      >
        <Tabs defaultValue="downloads" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 h-full mb-4">
            <TabsTrigger value="downloads">Downloads</TabsTrigger>
            <TabsTrigger value="filenames">Filenames</TabsTrigger>
            <TabsTrigger value="application">Application</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <TabsContent value="downloads">{renderDownloadsTab()}</TabsContent>
          <TabsContent value="filenames">{renderFilenamesTab()}</TabsContent>
          <TabsContent value="application">
            {renderApplicationTab()}
          </TabsContent>
          <TabsContent value="advanced">{renderAdvancedTab()}</TabsContent>
        </Tabs>
        {/* Action Buttons Footer */}
        <div className="flex justify-between items-center pt-6 border-t mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={resetToDefaults}
            disabled={isProcessing}
            title="Reset all settings to defaults"
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Undo className="mr-2 h-4 w-4" />
            )}{" "}
            Reset Defaults
          </Button>
          <Button
            type="submit"
            disabled={isProcessing || !isDirty}
            title={!isDirty ? "No changes to save" : "Save settings"}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}{" "}
            Save Settings
          </Button>
        </div>
      </form>
    </Form>
  );
}
