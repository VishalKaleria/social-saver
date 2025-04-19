import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Home,
  History,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight,
  BinaryIcon,
  RefreshCw,
  Heart,
  ExternalLink,
  HelpCircle,
  FileText,
  Globe,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTheme } from "next-themes";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Notifications } from "@/components/common/notification-bell";
import { useGlobalContext } from "@/context/global-context";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appConfig } from "@/lib/app-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { NavigationWarningModal } from "@/components/navigation-warning-modal";
import { ElectronLink } from "@/components/electron-hyperlink";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("sidebar-collapsed") === "true";
    }
    return false;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showNavigationWarning, setShowNavigationWarning] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null
  );
  const [isThemeSaving, setIsThemeSaving] = useState(false);

  const { theme: activeTheme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const {
    globalSettings,
    updateGlobalSettings,
    binaries,
    checkForUpdates,
    appState,
    isSettingsLoading,
    settingsError,
  } = useGlobalContext();

  const preferredTheme = globalSettings?.ui?.theme || "system";
  const isUpdateCheckRunning = binaries.isCheckingForUpdates;
  const isNavigationDisabled = useMemo(
    () => !!appState?.criticalProcessing?.playlistFetching,
    [appState?.criticalProcessing?.playlistFetching]
  );

  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", JSON.stringify(isCollapsed));
  }, [isCollapsed]);

  useEffect(() => {
    if (globalSettings?.ui?.theme) {
      const settingsTheme = globalSettings.ui.theme;

      if (settingsTheme !== activeTheme) {
        console.log(
          `Syncing next-themes (${activeTheme}) with settings theme (${settingsTheme})`
        );
        setTheme(settingsTheme);
      }
    }
  }, [globalSettings?.ui?.theme, setTheme, activeTheme]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  const toggleMobileSidebar = () => setIsMobileOpen(!isMobileOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const toggleTheme = useCallback(async () => {
    if (!globalSettings) {
      toast.error("Cannot toggle theme: Settings not loaded.");
      return;
    }
    if (isThemeSaving) return;

    const currentEffectiveTheme =
      activeTheme === "system"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : activeTheme;
    const nextTheme = currentEffectiveTheme === "dark" ? "light" : "dark";

    setIsThemeSaving(true);

    try {
      setTheme(nextTheme);

      const success = await updateGlobalSettings({
        ui: { theme: nextTheme },
      });

      if (!success) {
        toast.error("Failed to save theme preference.");
      } else {
      }
    } catch (error: any) {
      console.error("Error toggling theme:", error);
      toast.error("Error changing theme", { description: error.message });
    } finally {
      setIsThemeSaving(false);
    }
  }, [
    activeTheme,
    setTheme,
    updateGlobalSettings,
    isThemeSaving,
    globalSettings,
  ]);

  const handleNavigation = useCallback(
    (path: string) => {
      if (isNavigationDisabled && path !== pathname) {
        setPendingNavigation(path);
        setShowNavigationWarning(true);
        return false;
      }
      return true;
    },
    [isNavigationDisabled, pathname]
  );

  const handleContinueNavigation = useCallback(() => {
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
    setShowNavigationWarning(false);
  }, [pendingNavigation, navigate]);

  const routes = useMemo(
    () => [
      { name: "Home", path: "/", icon: <Home size={18} /> },
      { name: "History", path: "/history", icon: <History size={18} /> },
      { name: "Settings", path: "/settings", icon: <Settings size={18} /> },
      {
        name: "Binaries",
        path: "/binaries",
        icon: <BinaryIcon size={18} />,
        badge: binaries.needsUpdate ? "Update" : null,
        badgeVariant: binaries.needsUpdate ? "destructive" : "secondary",
      },
      {
        name: "Donate",
        path: "/donate",
        icon: <Heart size={18} className="text-red-500" />,
      },
    ],
    [binaries.needsUpdate]
  );
  const externalLinks = useMemo(
    () => [
      { name: "Website", url: "https://socialsaver.site", icon: <Globe size={18} /> },
      {
        name: "Documentation",
        url: "https://socialsaver.site/docs",
        icon: <FileText size={18} />,
      },
      {
        name: "GitHub",
        url: appConfig.githubRepo, // Keeping this as is since it likely points to your GitHub repo
        icon: <ExternalLink size={18} />,
      },
      { name: "Help", url: "https://socialsaver.site/docs/troubleshooting", icon: <HelpCircle size={18} /> },
      { name: "About", url: "https://socialsaver.site/about", icon: <FileText size={18} /> },
    ],
    []
  );

  const formatLastChecked = useCallback((date: Date | null) => {
    if (!date) return "Never";
    const now = new Date();
    const diffSeconds = (now.getTime() - date.getTime()) / 1000;
    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }, []);

  return (
    <>
      {/* Navigation Warning Modal */}
      <NavigationWarningModal
        isOpen={showNavigationWarning}
        onClose={() => setShowNavigationWarning(false)}
        onContinue={handleContinueNavigation}
        processingType="playlist"
      />

      {/* Mobile toggle button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 right-3 z-50 md:hidden"
        onClick={toggleMobileSidebar}
        aria-label={isMobileOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isMobileOpen ? <X size={18} /> : <Menu size={18} />}
      </Button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={toggleMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <div
        className={cn(
          "fixed md:sticky top-0 left-0 h-screen border-r bg-background transition-all duration-300 ease-in-out z-40 flex flex-col",
          isCollapsed ? "w-16" : "w-56",
          isMobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full",
          "md:translate-x-0 md:shadow-none"
        )}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-3 border-b shrink-0">
          {!isCollapsed && (
            <Link
              to="/"
              className="text-lg font-semibold gradient-text truncate"
              onClick={(e) => {
                if (!handleNavigation("/")) e.preventDefault();
                setIsMobileOpen(false);
              }}
            >
              {appConfig.name}
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className={cn(
              "h-8 w-8 hidden md:flex",
              isCollapsed ? "ml-auto" : "ml-auto"
            )}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMobileSidebar}
            className={cn(
              "h-8 w-8 md:hidden",
              isCollapsed ? "hidden" : "flex ml-auto"
            )}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </Button>
        </div>

        {/* Status Area */}
        <div
          className={cn(
            "flex items-center justify-between px-3 py-2 border-b shrink-0",
            isCollapsed && "flex-col gap-1 py-1"
          )}
        >
          {!isCollapsed && (
            <span className="text-xs font-medium text-muted-foreground">
              Status
            </span>
          )}
          <div
            className={cn(
              "flex items-center gap-1",
              isCollapsed && "w-full justify-center flex-wrap"
            )}
          >
            <Notifications />
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => checkForUpdates(true)}
                    disabled={isUpdateCheckRunning}
                    aria-label="Check for updates"
                  >
                    {isUpdateCheckRunning ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={isCollapsed ? "right" : "bottom"}>
                  <p>Check for Updates</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Navigation Items */}
        <ScrollArea className="flex-grow">
          <nav className="flex flex-col p-2 space-y-1">
            {/* Routes */}
            {routes.map((route) => (
              <Link
                key={route.path}
                to={route.path}
                onClick={(e) => {
                  if (!handleNavigation(route.path)) e.preventDefault();
                  setIsMobileOpen(false);
                }}
                className={cn("block", isNavigationDisabled && "relative")}
                aria-disabled={isNavigationDisabled && pathname !== route.path}
              >
                <TooltipProvider delayDuration={isCollapsed ? 0 : 500}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={
                          pathname === route.path ? "secondary" : "ghost"
                        }
                        className={cn(
                          "w-full justify-start h-9 relative text-sm",
                          isCollapsed ? "px-0 justify-center" : "px-3",
                          isNavigationDisabled &&
                            pathname !== route.path &&
                            "opacity-50 cursor-not-allowed hover:bg-transparent hover:opacity-50"
                        )}
                        aria-current={
                          pathname === route.path ? "page" : undefined
                        }
                        disabled={
                          isNavigationDisabled && pathname !== route.path
                        }
                      >
                        <span className={cn(isCollapsed ? "mx-auto" : "")}>
                          {route.icon}
                        </span>
                        {!isCollapsed && (
                          <span className="ml-2">{route.name}</span>
                        )}
                        {route.badge && !isCollapsed && (
                          <Badge
                            variant={route.badgeVariant as any}
                            className="ml-auto px-1.5 py-0.5 text-[10px] leading-none h-4"
                          >
                            {route.badge}
                          </Badge>
                        )}
                        {route.badge && isCollapsed && (
                          <span
                            className={cn(
                              "absolute top-1 right-1 block h-2 w-2 rounded-full",
                              route.badgeVariant === "destructive"
                                ? "bg-red-500"
                                : "bg-blue-500"
                            )}
                            aria-hidden="true"
                          />
                        )}
                      </Button>
                    </TooltipTrigger>
                    {(isCollapsed ||
                      (isNavigationDisabled && pathname !== route.path)) && (
                      <TooltipContent side="right">
                        <p>
                          {route.name}
                          {route.badge && isCollapsed && (
                            <span
                              className={`ml-1 ${
                                route.badgeVariant === "destructive"
                                  ? "text-red-500"
                                  : "text-blue-500"
                              }`}
                            >
                              ({route.badge})
                            </span>
                          )}
                          {isNavigationDisabled && pathname !== route.path && (
                            <span className="block text-xs text-destructive mt-1">
                              Navigation disabled
                            </span>
                          )}
                        </p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </Link>
            ))}
            {/* External Links */}
            {externalLinks.length > 0 && (
              <div
                className={cn(
                  "pt-4 pb-1 text-xs font-medium text-muted-foreground",
                  isCollapsed ? "text-center" : "px-3"
                )}
              >
                {isCollapsed ? <Separator /> : "External Links"}
              </div>
            )}
            {externalLinks.map((link) =>
             <ElectronLink
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <TooltipProvider delayDuration={isCollapsed ? 0 : 500}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start h-9 text-sm",
                            isCollapsed ? "px-0 justify-center" : "px-3"
                          )}
                        >
                          <span className={isCollapsed ? "mx-auto" : ""}>
                            {link.icon}
                          </span>
                          {!isCollapsed && (
                            <span className="ml-2">{link.name}</span>
                          )}
                        </Button>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          <p>{link.name}</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </ElectronLink>
              )
            }
          </nav>
        </ScrollArea>

        {/* Footer Status Info (Expanded Only) */}
        {!isCollapsed && (
          <div className="px-3 py-2 border-t mt-auto shrink-0">
            {isSettingsLoading ? (
              <div className="flex items-center text-xs text-muted-foreground">
                <Loader2 size={12} className="animate-spin mr-1" /> Loading...
              </div>
            ) : settingsError ? (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center text-xs text-destructive cursor-help">
                      <AlertTriangle size={12} className="mr-1" /> Status Error
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px]">
                    <p className="text-xs">{settingsError}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <div className="text-xs text-muted-foreground space-y-0.5">
                <div className="flex justify-between items-center">
                  <span>YT-DLP:</span>
                  <Badge
                    variant={binaries.needsUpdate ? "destructive" : "secondary"}
                    className="font-mono px-1 cursor-pointer"
                    onClick={() => navigate("/binaries")}
                    title={
                      binaries.needsUpdate ? "Update Available" : "Up to date"
                    }
                  >
                    {binaries.localYtdlpVersion || "N/A"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>App:</span>
                  <Badge variant="secondary" className="font-mono px-1">
                    v{appConfig.version}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Checked:</span>
                  <span className="font-mono">
                    {formatLastChecked(binaries.lastChecked)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Theme Toggle Footer */}
        <div className="border-t p-2 shrink-0">
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  disabled={isThemeSaving || isSettingsLoading}
                  className={cn(
                    "w-full h-9",
                    isCollapsed ? "" : "justify-start px-3"
                  )}
                  aria-label={`Switch to ${
                    activeTheme === "dark" ? "light" : "dark"
                  } mode`}
                >
                  {/* Show loader if saving */}
                  {isThemeSaving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      {isCollapsed ? (
                        activeTheme === "dark" ? (
                          <Sun size={18} />
                        ) : (
                          <Moon size={18} />
                        )
                      ) : (
                        <>
                          {" "}
                          {activeTheme === "dark" ? (
                            <Sun size={18} />
                          ) : (
                            <Moon size={18} />
                          )}{" "}
                          <span className="ml-2 text-sm">Toggle Theme</span>{" "}
                        </>
                      )}
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              {isCollapsed && (
                <TooltipContent side="right">
                  <p>Toggle Theme</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </>
  );
}
