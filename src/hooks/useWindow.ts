import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useCallback, useEffect, useRef } from "react";

// Helper function to check if any popover is open in the DOM
const isAnyPopoverOpen = (): boolean => {
  const popoverContents = document.querySelectorAll(
    "[data-radix-popper-content-wrapper]"
  );
  return popoverContents.length > 0;
};

export const useWindowResize = () => {
  // Debounce + deduplicate resize requests to prevent rapid flicker
  const lastRequestedHeightRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<number | null>(null);

  const resizeWindow = useCallback(async (expanded: boolean) => {
    try {
      const window = getCurrentWebviewWindow();

      if (!expanded && isAnyPopoverOpen()) {
        return;
      }

      const newHeight = expanded ? 600 : 54;

      // Skip if the same height was requested recently
      if (lastRequestedHeightRef.current === newHeight) {
        return;
      }

      // Debounce multiple quick calls
      if (resizeTimerRef.current) {
        clearTimeout(resizeTimerRef.current);
        resizeTimerRef.current = null;
      }

      // Use a short debounce to avoid rapid toggling when responses stream
      const timer = setTimeout(async () => {
        try {
          await invoke("set_window_height", {
            window,
            height: newHeight,
          });
          lastRequestedHeightRef.current = newHeight;
        } catch (error) {
          console.error("Failed to resize window:", error);
        } finally {
          if (resizeTimerRef.current) {
            clearTimeout(resizeTimerRef.current);
            resizeTimerRef.current = null;
          }
        }
      }, 150);

      // store numeric id
      resizeTimerRef.current = typeof timer === "number" ? timer : (timer as unknown as number);
    } catch (error) {
      console.error("Failed to schedule window resize:", error);
    }
  }, []);

  // Setup drag handling and popover monitoring
  useEffect(() => {
    let isDragging = false;

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isDragRegion = target.closest('[data-tauri-drag-region="true"]');

      if (isDragRegion) {
        isDragging = true;
      }
    };

    const handleMouseUp = async () => {
      if (isDragging) {
        isDragging = false;

        setTimeout(() => {
          if (!isAnyPopoverOpen()) {
            resizeWindow(false);
          }
        }, 100);
      }
    };

    const observer = new MutationObserver(() => {
      if (!isAnyPopoverOpen()) {
        resizeWindow(false);
      }
    });

    // Observe the body for changes to detect popover open/close
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mouseup", handleMouseUp);
      observer.disconnect();
    };
  }, [resizeWindow]);

  return { resizeWindow };
};

interface UseWindowFocusOptions {
  onFocusLost?: () => void;
  onFocusGained?: () => void;
}

export const useWindowFocus = ({
  onFocusLost,
  onFocusGained,
}: UseWindowFocusOptions = {}) => {
  const handleFocusChange = useCallback(
    async (focused: boolean) => {
      if (focused && onFocusGained) {
        onFocusGained();
      } else if (!focused && onFocusLost) {
        onFocusLost();
      }
    },
    [onFocusLost, onFocusGained]
  );

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupFocusListener = async () => {
      try {
        const window = getCurrentWebviewWindow();

        // Listen to focus change events
        unlisten = await window.onFocusChanged(({ payload: focused }) => {
          handleFocusChange(focused);
        });
      } catch (error) {
        console.error("Failed to setup focus listener:", error);
      }
    };

    setupFocusListener();

    // Cleanup
    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [handleFocusChange]);
};
