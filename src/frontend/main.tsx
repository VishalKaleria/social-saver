import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "@/index.css";
import { ThemeProvider } from "@/components/common/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSkeleton } from "@/components/common/app-skeleton";
import { Sidebar } from "@/components/common/sidebar";
import ToasterWrapper from "@/components/common/toaster-wrapper";
import Footer from "@/components/common/footer";
import { DownloadProvider } from "@/context/download-context";
import { GlobalContextProvider } from "@/context/global-context";

const App = lazy(() => import("@/App"));
const SettingsPage = lazy(() => import("@/components/pages/settings"));
const HistoryPage = lazy(() => import("@/components/pages/history"));
const BinariesPage = lazy(() => import("@/components/pages/binaries"));
const DonatePage = lazy(() => import("@/components/pages/donate"));

const preloadMainComponents = () => {
  import("@/App");
  import("@/components/common/sidebar");
};

preloadMainComponents();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider delayDuration={100}>
        {/* Context providers are NOT lazy loaded */}
        <GlobalContextProvider>
          <DownloadProvider>
            <Router>
              <div className="flex min-h-screen w-full">
                <Sidebar />
                <div className="flex-1 w-0 min-w-0">
                  <main className="p-4 overflow-auto h-full">
                    <ToasterWrapper />
                    <Suspense fallback={<AppSkeleton />}>
                      <Routes>
                        <Route path="/" element={<App />} />
                        <Route path="/history" element={<HistoryPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/binaries" element={<BinariesPage />} />
                        <Route path="/donate" element={<DonatePage />} />
                        <Route path="*" element={<h1>404 Not Found</h1>} />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </div>
            </Router>
            <Footer />
          </DownloadProvider>
        </GlobalContextProvider>
      </TooltipProvider>
    </ThemeProvider>
  </>
);
