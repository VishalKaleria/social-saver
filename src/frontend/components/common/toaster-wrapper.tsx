import { useGlobalContext } from "@/context/global-context";
import { Toaster } from "sonner";

/**
 * ToasterWrapper
 *
 * This component wraps the Toaster component from sonner and passes the
 * showNotifications setting from global settings to it. If the showNotifications
 * setting is false, it renders nothing.
 *
 * @returns {React.ReactElement | null} The Toaster component or null if showNotifications is false.
 */
const ToasterWrapper = () => {
  const { globalSettings } = useGlobalContext();

  const shouldShowToaster = globalSettings?.ui?.showNotifications === true;

  console.log(
    "Rendering ToasterWrapper, shouldShowToaster:",
    shouldShowToaster
  );

  return shouldShowToaster ? (
    <Toaster
      closeButton={true}
      duration={5000}
      richColors={true}
      position="bottom-right"
      visibleToasts={5}
    />
  ) : null;
};

export default ToasterWrapper;
