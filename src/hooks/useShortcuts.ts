import { useEffect } from "react";
import { useGlobalShortcuts } from "./useGlobalShortcuts";

interface UseShortcutsProps {
  onScreenshot?: () => void;
  customShortcuts?: Record<string, () => void>;
}

/**
 * Hook to manage global shortcuts for the application
 * Automatically registers callbacks for all shortcut actions
 */
export const useShortcuts = ({
  onScreenshot,
  customShortcuts = {},
}: UseShortcutsProps = {}) => {
  const {
    registerScreenshotCallback,
    registerCustomShortcutCallback,
    unregisterCustomShortcutCallback,
  } = useGlobalShortcuts();

  useEffect(() => {
    if (onScreenshot) {
      registerScreenshotCallback(onScreenshot);
    }
  }, [onScreenshot, registerScreenshotCallback]);

  // Register custom shortcut callbacks
  useEffect(() => {
    Object.entries(customShortcuts).forEach(([actionId, callback]) => {
      registerCustomShortcutCallback(actionId, callback);
    });

    // Cleanup on unmount
    return () => {
      Object.keys(customShortcuts).forEach((actionId) => {
        unregisterCustomShortcutCallback(actionId);
      });
    };
  }, [
    customShortcuts,
    registerCustomShortcutCallback,
    unregisterCustomShortcutCallback,
  ]);

  return useGlobalShortcuts();
};
