import { PageHeader } from "@/components/common/page-header";
import { GlobalSettingsPage } from "@/components/settings/settings-page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-6 px-4 md:px-6 lg:px-8 space-y-6">
      {" "}
      {/* Added container and spacing */}
      <PageHeader
        title="Settings"
        description="Configure application preferences, download options, and update behavior"
      />
      {/* <Alert variant="destructive" className="mt-4">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Under Development</AlertTitle>
        <AlertDescription>
          Some advanced UI options or specific update configurations might still
          be under development. Core functionality is available.
        </AlertDescription>
      </Alert> */}
      <div>
        <GlobalSettingsPage />
      </div>
    </div>
  );
}
