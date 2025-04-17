// app/binaries/page.tsx
import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
  AlertTriangle,
  Info,
  Shield,
  Loader2,
  ServerCrash,
  Rocket,
  Star,
  PackageCheck,
  GitBranch,
  Settings2, // Icon for preferences
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  determineYtdlpType,
  useGlobalContext,
  YtdlpUpdateType,
} from "@/context/global-context";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { DeepPartial, GlobalSettings, SiteSettings } from "@/types"; // Import types

// --- Reusable Version Display Card (No Changes) ---
const VersionDisplayCard = ({
  /* ... props ... */ title,
  version,
  date,
  icon,
  isRecommended = false,
  isLocalType = false,
  localType,
  tooltipContent,
}: {
  /* ... props types ... */ title: string;
  version: string | null | undefined;
  date?: string | null;
  icon: React.ReactNode;
  isRecommended?: boolean;
  isLocalType?: boolean;
  localType?: "stable" | "nightly" | "unknown";
  tooltipContent?: string;
}) => (
  <div
    className={`relative space-y-1 p-3 rounded-lg border ${
      isRecommended
        ? "border-primary/50 bg-primary/5 shadow-sm"
        : "bg-muted/40 border-border"
    } h-full flex flex-col justify-between`}
  >
    <div>
      {" "}
      {/* Top Section */}
      <div className="flex justify-between items-start gap-2 mb-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          {icon} {title}
        </p>
        <div className="flex flex-col items-end gap-1">
          {isRecommended && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className="text-primary border-primary bg-primary/10 cursor-default"
                  >
                    Recommended
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Recommended based on settings.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {isLocalType && localType !== "unknown" && (
            <Badge variant="secondary" className="capitalize">
              {localType}
            </Badge>
          )}
        </div>
      </div>
      <p className="text-lg font-mono truncate" title={version || "N/A"}>
        {version || "N/A"}
      </p>
    </div>
    <div className="flex justify-between items-end mt-1 pt-1">
      {" "}
      {/* Bottom Section */}
      {date ? (
        <p className="text-xs text-muted-foreground">
          {new Date(date).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </p>
      ) : (
        <div />
      )}
      {tooltipContent && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger className="cursor-help ml-auto">
              <Info
                size={12}
                className="text-muted-foreground hover:text-foreground"
              />
            </TooltipTrigger>
            <TooltipContent side="top" align="end" className="max-w-xs">
              <p className="text-xs">{tooltipContent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  </div>
);

// --- Main Binaries Page Component ---
const BinariesPage = () => {
  const {
    globalSettings,
    updateGlobalSettings, // Function to save settings changes
    binaries,
    updateYtdlpTo,
    checkForUpdates,
    isSettingsLoading, // Loading state for initial global settings fetch
    settingsError, // Error from initial global settings fetch
  } = useGlobalContext();

  // Local state for UI interactions
  const [isSavingSettings, setIsSavingSettings] = useState(false); // For saving preference changes

  const {
    localYtdlpVersion,
    localYtdlpType,
    latestYtdlpVersions,
    targetVersionForUpdate,
    needsUpdate,
    isUpdating: isYtdlpUpdating, // Renamed for clarity
    lastChecked,
    updateCheckError, // Error specific to the *last* update check attempt
    isCheckingForUpdates, // Is the check currently running?
  } = binaries;

  // Get site settings (update preferences) or provide defaults if not loaded
  const siteSettings = useMemo(
    () =>
      globalSettings?.site ?? {
        autoCheckUpdates: true,
        notifyOnUpdates: true,
        checkFrequency: "daily",
        preferNightlyYtdlp: false,
        autoUpdateYtdlp: true,
        lastUpdateCheck: null,
      },
    [globalSettings?.site]
  );

  // Combined loading state
  const isLoading = isSettingsLoading || isCheckingForUpdates;

  // --- Handlers ---

  // Update YT-DLP to the recommended version
  const handleUpdateToRecommended = useCallback(async () => {
    if (
      needsUpdate &&
      targetVersionForUpdate &&
      !isYtdlpUpdating &&
      !isLoading
    ) {
      const typeToUpdate = determineYtdlpType(targetVersionForUpdate.version);
      if (typeToUpdate === "stable" || typeToUpdate === "nightly") {
        await updateYtdlpTo(typeToUpdate);
      } else {
        console.error(
          "Cannot update: Target version type unknown",
          targetVersionForUpdate
        );
        toast.error("Update Failed", {
          description: "Could not determine target version type.",
        });
      }
    }
  }, [
    needsUpdate,
    targetVersionForUpdate,
    isYtdlpUpdating,
    isLoading,
    updateYtdlpTo,
  ]);

  // Update YT-DLP to a specific channel (Stable/Nightly)
  const handleUpdateToSpecific = useCallback(
    async (type: YtdlpUpdateType) => {
      if (!isYtdlpUpdating && !isLoading) {
        // update preferences based on type
        if (type === "stable") {
          toast.success("Updating to Stable version.");
          handlePreferenceChange("preferNightlyYtdlp", false);
        } else if (type === "nightly") {
          toast.success("Updating to Nightly version.");
          handlePreferenceChange("preferNightlyYtdlp", true);
        }

        // now update to prefered ytdlp build types
        await updateYtdlpTo(type);
      }
    },
    [isYtdlpUpdating, isLoading, updateYtdlpTo]
  );

  // Manually trigger an update check
  const handleRefresh = useCallback(async () => {
    if (!isLoading && !isYtdlpUpdating) {
      await checkForUpdates(true); // Force check
    }
  }, [isLoading, isYtdlpUpdating, checkForUpdates]);

  // Generic handler to update a site setting preference
  const handlePreferenceChange = useCallback(
    async <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => {
      if (!globalSettings || isSavingSettings) return; // Prevent updates if settings aren't loaded or already saving

      setIsSavingSettings(true);
      try {
        // Construct payload with only the site settings part changed
        const updatePayload: DeepPartial<GlobalSettings> = {
          site: {
            ...globalSettings.site, // Spread current site settings
            [key]: value, // Update the specific key
          },
        };
        const success = await updateGlobalSettings(updatePayload);
        if (!success) {
          toast.error("Failed to save preference.");
          // Optionally revert UI state here if needed, though context refresh should handle it
        } else {
          // Optionally show success toast
          // toast.success("Preference updated");
          // Trigger update check if preference change might affect recommendation
          if (key === "preferNightlyYtdlp") {
            console.log(
              "Nightly preference changed, re-checking update status..."
            );
            await checkForUpdates(); // Re-check status (don't force if within interval)
          }
        }
      } catch (error: any) {
        console.error(`Error updating preference ${key}:`, error);
        toast.error("Error Saving Preference", { description: error.message });
      } finally {
        setIsSavingSettings(false);
      }
    },
    [globalSettings, updateGlobalSettings, isSavingSettings, checkForUpdates]
  );

  // --- Derived State & Checks (Memoized) ---
  const canUpdateToStable = useMemo(
    () =>
      latestYtdlpVersions?.stable &&
      localYtdlpVersion !== latestYtdlpVersions.stable.version,
    [localYtdlpVersion, latestYtdlpVersions?.stable]
  );
  const canUpdateToNightly = useMemo(
    () =>
      latestYtdlpVersions?.nightly &&
      localYtdlpVersion !== latestYtdlpVersions.nightly.version,
    [localYtdlpVersion, latestYtdlpVersions?.nightly]
  );

  // --- Alert Rendering Logic ---
  const renderVersionStatusAlert = useCallback(() => {
    // Prioritize critical errors or loading states
    if (isSettingsLoading)
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading Settings...</AlertTitle>
        </Alert>
      );
    if (settingsError)
      return (
        <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Settings Error</AlertTitle>
          <AlertDescription>{settingsError}</AlertDescription>
        </Alert>
      );
    if (isCheckingForUpdates && !lastChecked)
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Checking Versions...</AlertTitle>
          <AlertDescription>Fetching YT-DLP info.</AlertDescription>
        </Alert>
      );
    if (isCheckingForUpdates && lastChecked)
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Refreshing Status...</AlertTitle>
          <AlertDescription>Getting latest versions.</AlertDescription>
        </Alert>
      );
    if (updateCheckError)
      return (
        <Alert variant="destructive">
          <ServerCrash className="h-4 w-4" />
          <AlertTitle>Version Check Failed</AlertTitle>
          <AlertDescription>{updateCheckError}</AlertDescription>
        </Alert>
      );
    if (isYtdlpUpdating)
      return (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Update in Progress...</AlertTitle>
          <AlertDescription>YT-DLP is updating.</AlertDescription>
        </Alert>
      );
    if (
      !isCheckingForUpdates &&
      lastChecked &&
      !latestYtdlpVersions?.stable &&
      !latestYtdlpVersions?.nightly
    )
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could Not Get Latest Versions</AlertTitle>
          <AlertDescription>
            Check complete, but no version details retrieved. Local:{" "}
            {localYtdlpVersion || "unknown"}.
          </AlertDescription>
        </Alert>
      );

    // Status based on comparison
    if (needsUpdate && targetVersionForUpdate)
      return (
        <Alert
          variant="destructive"
          className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle>Update Recommended</AlertTitle>
          <AlertDescription>
            Update to YT-DLP{" "}
            <strong>
              {targetVersionForUpdate.version} (
              {determineYtdlpType(targetVersionForUpdate.version)})
            </strong>{" "}
            is recommended. Your version: {localYtdlpVersion || "unknown"}.
          </AlertDescription>
        </Alert>
      );
    if (localYtdlpVersion && !needsUpdate && lastChecked)
      return (
        <Alert
          variant="default"
          className="border-green-500 bg-green-50 dark:bg-green-950/20 dark:border-green-800"
        >
          <PackageCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertTitle>Up to Date</AlertTitle>
          <AlertDescription>
            Your YT-DLP (
            <strong>
              {localYtdlpVersion} - {localYtdlpType}
            </strong>
            ) matches the recommended version.
          </AlertDescription>
        </Alert>
      );

    // Default / Initial state
    return (
      <Alert variant="default">
        <Info className="h-4 w-4" />
        <AlertTitle>Status</AlertTitle>
        <AlertDescription>
          YT-DLP status will be shown here after checking.
        </AlertDescription>
      </Alert>
    );
  }, [
    isSettingsLoading,
    settingsError,
    isCheckingForUpdates,
    updateCheckError,
    isYtdlpUpdating,
    lastChecked,
    latestYtdlpVersions,
    needsUpdate,
    targetVersionForUpdate,
    localYtdlpVersion,
    localYtdlpType,
  ]);

  // --- Main Component Render ---
  // Handle overall loading/error state before rendering main content
  if (isSettingsLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Binary Settings...</span>
      </div>
    );
  }
  if (settingsError) {
    return (
      <Alert variant="destructive" className="m-4">
        <ServerCrash className="h-4 w-4" />
        <AlertTitle>Failed to Load Settings</AlertTitle>
        <AlertDescription>{settingsError}</AlertDescription>
      </Alert>
    );
  }
  // Should not happen if context logic is correct, but safeguard
  if (!globalSettings) {
    return (
      <Alert variant="destructive" className="m-4">
        <ServerCrash className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Global settings unavailable.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto py-6 space-y-6">
      <PageHeader
        title="Download Engine (YT-DLP)"
        description="Manage and update the core download engine."
      />

      {/* Controls Row: Refresh and Last Checked */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center ml-4 gap-2 text-sm text-muted-foreground order-2 sm:order-1">
          {(isCheckingForUpdates || isYtdlpUpdating) && (
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          )}
          <span className="whitespace-nowrap">
            Last checked:{" "}
            {lastChecked
              ? formatDistanceToNow(lastChecked, { addSuffix: true })
              : "Never"}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading || isYtdlpUpdating}
          className="order-1 sm:order-2 w-full sm:w-auto"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${
              isCheckingForUpdates ? "animate-spin" : ""
            }`}
          />
          Refresh Status
        </Button>
      </div>

      {/* Status & Versions Card */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            YT-DLP Status & Versions
          </CardTitle>
          <CardDescription>
            Keep this engine updated for reliable downloads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {renderVersionStatusAlert()}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {/* Version Cards */}
            <VersionDisplayCard
              title="Installed Version"
              version={localYtdlpVersion}
              icon={<PackageCheck size={14} />}
              isLocalType={true}
              localType={localYtdlpType}
              tooltipContent="The version currently active."
            />
            <VersionDisplayCard
              title="Latest Stable"
              version={latestYtdlpVersions?.stable?.version}
              date={latestYtdlpVersions?.stable?.releaseDate}
              icon={<Star size={14} />}
              isRecommended={
                !siteSettings.preferNightlyYtdlp &&
                targetVersionForUpdate?.version ===
                  latestYtdlpVersions?.stable?.version
              }
              tooltipContent="Latest official stable release."
            />
            <VersionDisplayCard
              title="Latest Nightly"
              version={latestYtdlpVersions?.nightly?.version}
              date={latestYtdlpVersions?.nightly?.releaseDate}
              icon={<Rocket size={14} />}
              isRecommended={
                siteSettings.preferNightlyYtdlp &&
                targetVersionForUpdate?.version ===
                  latestYtdlpVersions?.nightly?.version
              }
              tooltipContent="Latest development build."
            />
          </div>
        </CardContent>
        {/* Update Actions Footer */}
        <CardFooter className="bg-muted/30 p-4 border-t flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={handleUpdateToRecommended}
            disabled={
              !needsUpdate ||
              isYtdlpUpdating ||
              isLoading ||
              !targetVersionForUpdate
            }
            className="w-full sm:w-auto flex-grow"
            variant={needsUpdate ? "default" : "outline"}
            size="default"
          >
            {isYtdlpUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...
              </>
            ) : needsUpdate && targetVersionForUpdate ? (
              <>
                <Download className="h-4 w-4 mr-2" /> Update to Recommended (
                {determineYtdlpType(targetVersionForUpdate.version)})
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" /> Up To Date
              </>
            )}
          </Button>
          <div className="flex gap-3 w-full sm:w-auto">
            {/* Specific Stable Button */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Button
                      onClick={() => handleUpdateToSpecific("stable")}
                      disabled={
                        !canUpdateToStable ||
                        isYtdlpUpdating ||
                        isLoading ||
                        !latestYtdlpVersions?.stable
                      }
                      variant="outline"
                      className="w-full"
                    >
                      <Star className="h-4 w-4 mr-2" /> Stable
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Update to Stable (
                    {latestYtdlpVersions?.stable?.version || "N/A"})
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {/* Specific Nightly Button */}
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex-1">
                    <Button
                      onClick={() => handleUpdateToSpecific("nightly")}
                      disabled={
                        !canUpdateToNightly ||
                        isYtdlpUpdating ||
                        isLoading ||
                        !latestYtdlpVersions?.nightly
                      }
                      variant="outline"
                      className="w-full"
                    >
                      <Rocket className="h-4 w-4 mr-2" /> Nightly
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Update to Nightly (
                    {latestYtdlpVersions?.nightly?.version || "N/A"})
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardFooter>
      </Card>

      {/* NEW: Update Preferences Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Update Preferences
          </CardTitle>
          <CardDescription>
            Configure how YT-DLP updates are checked and applied. Settings are
            saved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Prefer Nightly Toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="prefer-nightly" className="text-base font-medium">
                Prefer Nightly Builds
              </Label>
              <p className="text-sm text-muted-foreground">
                Recommend and target nightly releases if available.
              </p>
            </div>
            <Switch
              id="prefer-nightly"
              checked={siteSettings.preferNightlyYtdlp}
              onCheckedChange={(checked) =>
                handlePreferenceChange("preferNightlyYtdlp", checked)
              }
              disabled={isLoading || isYtdlpUpdating || isSavingSettings}
              aria-labelledby="prefer-nightly-label"
            />
          </div>

          {/* Auto Check Toggle */}
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="auto-check" className="text-base font-medium">
                Check Automatically
              </Label>
              <p className="text-sm text-muted-foreground">
                Periodically check for new versions in the background.
              </p>
            </div>
            <Switch
              id="auto-check"
              checked={siteSettings.autoCheckUpdates}
              onCheckedChange={(checked) =>
                handlePreferenceChange("autoCheckUpdates", checked)
              }
              disabled={isLoading || isYtdlpUpdating || isSavingSettings}
            />
          </div>

          {/* Options shown only if Auto Check is enabled */}
          {siteSettings.autoCheckUpdates && (
            <div className="space-y-5 pl-4 border-l-2 ml-2">
              {/* Check Frequency */}
              <div className="grid gap-2">
                <Label htmlFor="check-frequency">Check Frequency</Label>
                <Select
                  value={siteSettings.checkFrequency}
                  onValueChange={(value: SiteSettings["checkFrequency"]) =>
                    handlePreferenceChange("checkFrequency", value)
                  }
                  disabled={isLoading || isYtdlpUpdating || isSavingSettings}
                >
                  <SelectTrigger
                    id="check-frequency"
                    className="w-full sm:w-[180px]"
                  >
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hourly">Hourly</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="never">Never (Manual Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notify Toggle */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="notify-updates"
                    className="text-base font-medium"
                  >
                    Notify on Updates
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show a notification when a new version is found.
                  </p>
                </div>
                <Switch
                  id="notify-updates"
                  checked={siteSettings.notifyOnUpdates}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("notifyOnUpdates", checked)
                  }
                  disabled={isLoading || isYtdlpUpdating || isSavingSettings}
                />
              </div>

              {/* Auto Update Toggle */}
              <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label
                    htmlFor="auto-update"
                    className="text-base font-medium"
                  >
                    Install Automatically
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically install the preferred update when found.
                  </p>
                </div>
                <Switch
                  id="auto-update"
                  checked={siteSettings.autoUpdateYtdlp}
                  onCheckedChange={(checked) =>
                    handlePreferenceChange("autoUpdateYtdlp", checked)
                  }
                  disabled={isLoading || isYtdlpUpdating || isSavingSettings}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* About Section (Unchanged) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-5 w-5 text-blue-500" />
            About YT-DLP Updates
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            YT-DLP fetches download links. Websites change often, breaking
            YT-DLP. Keeping it updated is crucial.
          </p>
          <p>
            <strong>Stable:</strong> Official, tested releases. Recommended for
            most. <br />
            <strong>Nightly:</strong> Development snapshots with latest fixes,
            possibly less stable. Use if Stable has issues.
          </p>
          <p>
            Use the preferences above to control updates. The main "Update"
            button targets your preferred version type.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BinariesPage;
