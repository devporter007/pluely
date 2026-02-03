import { useState, useCallback, useEffect } from "react";
import {
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollArea,
} from "@/components";
import {
  HeadphonesIcon,
  AlertCircleIcon,
  LoaderIcon,
  AudioLinesIcon,
  CameraIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { ModeSwitcher } from "./ModeSwitcher";
import { RecordingPanel } from "./RecordingPanel";
import { ResultsSection } from "./ResultsSection";
import { SettingsPanel } from "./SettingsPanel";
import { PermissionFlow } from "./PermissionFlow";
import { QuickActions } from "./QuickActions";
import { Warning } from "./Warning";
import { useSystemAudioType } from "@/hooks";
import { useApp } from "@/contexts";
import { cn } from "@/lib/utils";

export const SystemAudio = (props: useSystemAudioType) => {
  const {
    capturing,
    isProcessing,
    isAIProcessing,
    lastTranscription,
    lastAIResponse,
    error,
    setupRequired,
    startCapture,
    stopCapture,
    isPopoverOpen,
    setIsPopoverOpen,
    useSystemPrompt,
    setUseSystemPrompt,
    contextContent,
    setContextContent,
    startNewConversation,
    conversation,
    resizeWindow,
    quickActions,
    addQuickAction,
    removeQuickAction,
    isManagingQuickActions,
    setIsManagingQuickActions,
    showQuickActions,
    setShowQuickActions,
    handleQuickActionClick,
    vadConfig,
    updateVadConfiguration,
    isRecordingInContinuousMode,
    recordingProgress,
    manualStopAndSend,
    startContinuousRecording,
    ignoreContinuousRecording,
    scrollAreaRef,
  } = props;

  const { hasActiveLicense, supportsImages, screenRecordingPermissionGranted, setScreenRecordingPermission, screenshotConfiguration } = useApp();

  // View mode toggle
  const [conversationMode, setConversationMode] = useState(false);

  // Screenshot state
  const [screenshotImage, setScreenshotImage] = useState<string | null>(null);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);

  const isVadMode = vadConfig.enabled;
  const hasResponse = lastAIResponse || isAIProcessing;

  // Keyboard shortcut for Cmd+K to toggle view mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPopoverOpen) return;

      // Cmd+K or Ctrl+K to toggle view mode
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setConversationMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPopoverOpen]);

  // Reset screenshot when processing starts (message is being sent)
  useEffect(() => {
    if (isProcessing && screenshotImage) {
      setScreenshotImage(null);
      props.setPendingScreenshotBase64?.(null);
      props.setPendingScreenshotAudioBase64?.(null);
    }
  }, [isProcessing, screenshotImage, props]);

  const handleToggleCapture = async () => {
    if (capturing) {
      await stopCapture();
    } else {
      await startCapture();
    }
  };

  const handleModeChange = (vadEnabled: boolean) => {
    updateVadConfiguration({
      ...vadConfig,
      enabled: vadEnabled,
    });
  };

  // Capture screenshot functionality
  const handleCaptureScreenshot = useCallback(async () => {
    if (isCapturingScreenshot) return;

    setIsCapturingScreenshot(true);
    try {
      // Check screen recording permission on macOS
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("mac")) {
        const {
          checkScreenRecordingPermission,
          requestScreenRecordingPermission,
        } = await import("tauri-plugin-macos-permissions-api");

        // Use cached value first to avoid repeated permission dialogs
        if (!screenRecordingPermissionGranted) {
          const hasPermission = await checkScreenRecordingPermission();
          if (!hasPermission) {
            await requestScreenRecordingPermission();
            // wait and recheck
            await new Promise((resolve) => setTimeout(resolve, 2000));
            const hasPermissionNow = await checkScreenRecordingPermission();
            if (!hasPermissionNow) {
              // Prompt the user to open System Settings
              const openSettings = window.confirm(
                "Screen Recording permission appears to be blocked. Open System Settings > Privacy & Security > Screen & System Audio Recording now?"
              );
              if (openSettings) {
                // Open system settings to screen recording pane
                try {
                  const shellModule = await eval('import("@tauri-apps/api/shell")');
                  if (shellModule?.open) {
                    shellModule.open(
                      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
                    );
                  } else {
                    window.open(
                      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
                    );
                  }
                } catch (err) {
                  window.open(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
                  );
                }
              }
              setIsCapturingScreenshot(false);
              setScreenRecordingPermission(false);
              return;
            } else {
              setScreenRecordingPermission(true);
            }
          } else {
            setScreenRecordingPermission(true);
          }
        }
      }

      // Capture screenshot
      const base64: string = await invoke("capture_screenshot", {
        screenId: null, // Use default screen
      });

      // Quick validation to detect blocked captures
      try {
        const { isLikelyInvalidScreenshot } = await import("@/lib/utils");
        const invalid = await isLikelyInvalidScreenshot(base64);
        if (invalid) {
          const openSettings = window.confirm(
            "Captured image looks invalid (possibly blocked by macOS. Open System Settings > Privacy & Security > Screen & System Audio Recording now?)"
          );
          if (openSettings) {
            try {
              const shellModule = await eval('import("@tauri-apps/api/shell")');
              if (shellModule?.open) {
                shellModule.open(
                  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
                );
              } else {
                window.open(
                  "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
                );
              }
            } catch (err) {
              window.open(
                "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenRecording"
              );
            }
          }
          setScreenRecordingPermission(false);
          setIsCapturingScreenshot(false);
          return;
        }
      } catch (e) {
        // ignore validation failures
      }

      setScreenshotImage(base64);

      // If configured, capture or attach audio and store in system audio hook to be sent with next transcription
      try {
        if (screenshotConfiguration?.attachAudioWithScreenshot) {
          let audioBase64: string | undefined;
          if (screenshotConfiguration.audioAttachMode === "record") {
            const duration = screenshotConfiguration.audioRecordDurationSeconds || 3;
            const result = await (props.captureShortAudio?.(duration) || Promise.resolve(null));
            audioBase64 = result?.base64 ?? undefined;
            if (audioBase64) props.setPendingScreenshotAudioBase64?.(audioBase64);
            if (result?.transcription) {
              // Also set last transcription so it can be included in the prompt
              // Note: useSystemAudio already stores lastTranscription on normal speech-detected events
            }
          } else {
            audioBase64 = props.lastAudioBase64 ?? undefined;
            if (audioBase64) props.setPendingScreenshotAudioBase64?.(audioBase64);
          }

          if (audioBase64) {
            // store pending screenshot and audio in hook
            props.setPendingScreenshotBase64?.(base64 as string);
          } else {
            // still store screenshot even if audio failed
            props.setPendingScreenshotBase64?.(base64 as string);
          }
        } else {
          props.setPendingScreenshotBase64?.(base64 as string);
        }
      } catch (e) {
        console.debug("Failed to attach audio to screenshot:", e);
        props.setPendingScreenshotBase64?.(base64 as string);
      }
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
    } finally {
      setIsCapturingScreenshot(false);
    }
  }, [isCapturingScreenshot]);

  const handleRemoveScreenshot = useCallback(() => {
    setScreenshotImage(null);
    props.setPendingScreenshotBase64?.(null);
    props.setPendingScreenshotAudioBase64?.(null);
  }, [props]);

  const getButtonIcon = () => {
    if (setupRequired) return <AlertCircleIcon className="text-orange-500" />;
    if (error && !setupRequired)
      return <AlertCircleIcon className="text-red-500" />;
    if (isProcessing) return <LoaderIcon className="animate-spin" />;
    if (capturing)
      return <AudioLinesIcon className="text-green-500 animate-pulse" />;
    return <HeadphonesIcon />;
  };

  const getButtonTitle = () => {
    if (setupRequired) return "Setup required - Click for instructions";
    if (error && !setupRequired) return `Error: ${error}`;
    if (isProcessing) return "Transcribing audio...";
    if (capturing) return "Stop system audio capture";
    return "Start system audio capture";
  };

  return (
    <Popover
      open={isPopoverOpen}
      onOpenChange={(open) => {
        if (capturing && !open) {
          return;
        }
        setIsPopoverOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size="icon"
          title={getButtonTitle()}
          onClick={handleToggleCapture}
          className={cn(
            capturing && "bg-green-50 hover:bg-green-100",
            error && "bg-red-100 hover:bg-red-200"
          )}
        >
          {getButtonIcon()}
        </Button>
      </PopoverTrigger>

      {(capturing || setupRequired || error) && (
        <PopoverContent
          align="end"
          side="bottom"
          className="select-none w-screen p-0 border shadow-lg overflow-hidden border-input/50"
          sideOffset={8}
        >
          <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
            {/* Header - Mode Switcher + Actions */}
            <div className="flex-shrink-0 p-3 border-b border-border/50">
              <div className="flex items-center justify-between gap-2">
                {/* Mode Switcher */}
                {!setupRequired && (
                  <ModeSwitcher
                    isVadMode={isVadMode}
                    onModeChange={handleModeChange}
                    disabled={
                      isRecordingInContinuousMode ||
                      isProcessing ||
                      isAIProcessing
                    }
                  />
                )}
                {setupRequired && (
                  <h2 className="font-semibold text-sm">Setup Required</h2>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Screenshot Button */}
                  {hasActiveLicense && !setupRequired && supportsImages && (
                    <Button
                      size="sm"
                      variant={screenshotImage ? "default" : "outline"}
                      onClick={handleCaptureScreenshot}
                      disabled={isCapturingScreenshot}
                      className={cn(
                        "h-6 text-[10px] gap-1 px-2",
                        screenshotImage && "bg-primary text-primary-foreground"
                      )}
                      title="Capture screenshot to include with transcription"
                    >
                      {isCapturingScreenshot ? (
                        <LoaderIcon className="w-3 h-3 animate-spin" />
                      ) : (
                        <CameraIcon className="w-3 h-3" />
                      )}
                      Screenshot
                    </Button>
                  )}

                  {/* New Conversation Button */}
                  {!setupRequired && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={startNewConversation}
                      className="h-6 text-[10px] gap-1 px-2"
                      title="Start a new conversation"
                    >
                      <PlusIcon className="w-3 h-3" />
                      New
                    </Button>
                  )}

                  {/* Close Button */}
                  {!capturing && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      title="Close"
                      onClick={() => {
                        setIsPopoverOpen(false);
                        resizeWindow(false);
                      }}
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
              <div className="p-2 space-y-2">
                {/* Screenshot Preview */}
                {screenshotImage && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <img
                      src={`data:image/png;base64,${screenshotImage}`}
                      alt="Screenshot"
                      className="h-12 w-20 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium">
                        Screenshot attached
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        Will be sent with next transcription
                      </p>
                      {props.pendingScreenshotAudioBase64 && (
                        <p className="text-[9px] text-muted-foreground mt-1">
                          🔊 Audio will be attached with screenshot
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={handleRemoveScreenshot}
                    >
                      <XIcon className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {/* Error Display */}
                {error && !setupRequired && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200">
                    <AlertCircleIcon className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-medium text-red-800">
                        Error
                      </p>
                      <p className="text-[10px] text-red-700">{error}</p>
                    </div>
                  </div>
                )}

                {/* Setup Required - Permission Flow */}
                {setupRequired ? (
                  <PermissionFlow
                    onPermissionGranted={() => {
                      startCapture();
                    }}
                    onPermissionDenied={() => {
                      // Keep showing setup instructions
                    }}
                  />
                ) : (
                  <>
                    {/* Recording Panel */}
                    <RecordingPanel
                      isVadMode={isVadMode}
                      isRecording={isRecordingInContinuousMode}
                      isProcessing={isProcessing}
                      isAIProcessing={isAIProcessing}
                      recordingProgress={recordingProgress}
                      maxDuration={vadConfig.max_recording_duration_secs}
                      onStartRecording={startContinuousRecording}
                      onStopAndSend={manualStopAndSend}
                      onIgnore={ignoreContinuousRecording}
                    />

                    {/* AI Response */}
                    <ResultsSection
                      lastTranscription={lastTranscription}
                      lastAIResponse={lastAIResponse}
                      isAIProcessing={isAIProcessing}
                      conversation={conversation}
                      conversationMode={conversationMode}
                      setConversationMode={setConversationMode}
                    />

                    {/* Settings Panel */}
                    <SettingsPanel
                      vadConfig={vadConfig}
                      onUpdateVadConfig={updateVadConfiguration}
                      useSystemPrompt={useSystemPrompt}
                      setUseSystemPrompt={setUseSystemPrompt}
                      contextContent={contextContent}
                      setContextContent={setContextContent}
                    />

                    {/* Help/Keyboard Shortcuts */}
                    <Warning isVadMode={isVadMode} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            {!setupRequired && hasResponse && (
              <div className="flex-shrink-0 border-t border-border/50 p-2">
                <QuickActions
                  actions={quickActions}
                  onActionClick={handleQuickActionClick}
                  onAddAction={addQuickAction}
                  onRemoveAction={removeQuickAction}
                  isManaging={isManagingQuickActions}
                  setIsManaging={setIsManagingQuickActions}
                  show={showQuickActions}
                  setShow={setShowQuickActions}
                />
              </div>
            )}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
};
