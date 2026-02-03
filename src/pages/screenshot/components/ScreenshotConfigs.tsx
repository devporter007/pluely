import {
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Header,
  Switch,
} from "@/components";
import { UseSettingsReturn } from "@/types";
import { LaptopMinimalIcon, MousePointer2Icon } from "lucide-react";

export const ScreenshotConfigs = ({
  screenshotConfiguration,
  handleScreenshotModeChange,
  handleScreenshotPromptChange,
  handleScreenshotEnabledChange,
  handleScreenshotAttachChange,
  handleAttachAudioWithScreenshotChange,
  handleScreenshotAudioModeChange,
  handleScreenshotAudioDurationChange,
  handleScreenshotCompressionEnabledChange,
  handleScreenshotCompressionQualityChange,
  handleScreenshotCompressionMaxDimChange,
  handleScreenshotRecompressAttachmentsChange,
  hasActiveLicense,
}: UseSettingsReturn) => {
  return (
    <div id="screenshot" className="space-y-3">
      <div className="space-y-3">
        {/* Screenshot Capture Mode: Selection and Screenshot */}
        <div className="space-y-2">
          <div className="flex flex-col">
            <Header
              title="Capture Method"
              description={
                screenshotConfiguration.enabled
                  ? "Screenshot Mode: Quickly capture the entire screen with one click."
                  : "Selection Mode: Click and drag to select a specific area to capture."
              }
            />
          </div>
          <Select
            value={screenshotConfiguration.enabled ? "screenshot" : "selection"}
            onValueChange={(value) =>
              handleScreenshotEnabledChange(value === "screenshot")
            }
          >
            <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
              <div className="flex items-center gap-2">
                {screenshotConfiguration.enabled ? (
                  <LaptopMinimalIcon className="size-4" />
                ) : (
                  <MousePointer2Icon className="size-4" />
                )}
                <div className="text-sm font-medium">
                  {screenshotConfiguration.enabled
                    ? "Screenshot Mode"
                    : "Selection Mode"}
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="selection" disabled={!hasActiveLicense}>
                <div className="flex items-center gap-2">
                  <MousePointer2Icon className="size-4" />
                  <div className="font-medium">Selection Mode</div>
                  {!hasActiveLicense && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                      You need an active license to use Selection Mode.
                    </span>
                  )}
                </div>
              </SelectItem>
              <SelectItem value="screenshot" className="flex flex-row gap-2">
                <LaptopMinimalIcon className="size-4" />
                <div className="font-medium">Screenshot Mode</div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Mode Selection: Auto and Manual */}
        <div className="space-y-2">
          <div className="flex flex-col">
            <Header
              title="Processing Mode"
              description={
                screenshotConfiguration.mode === "manual"
                  ? "Screenshots will be captured and automatically added to your attached files. You can then submit them with your own prompt. you can capture multiple screenshots and submit them later."
                  : "Screenshots will be automatically submitted to AI using your custom prompt. No manual intervention required. only one screenshot can be submitted at a time."
              }
            />
          </div>
          <Select
            value={screenshotConfiguration.mode}
            onValueChange={handleScreenshotModeChange}
          >
            <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium">
                  {screenshotConfiguration.mode === "auto" ? "Auto" : "Manual"}{" "}
                  Mode
                </div>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">
                <div className="font-medium">Manual Mode</div>
              </SelectItem>
              <SelectItem value="auto">
                <div className="font-medium">Auto Mode</div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto Prompt Input - Only show when auto mode is selected */}
        {screenshotConfiguration.mode === "auto" && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Auto Prompt</Label>
            <Input
              placeholder="Enter prompt for automatic screenshot analysis..."
              value={screenshotConfiguration.autoPrompt}
              onChange={(e) => handleScreenshotPromptChange(e.target.value)}
              className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
            />
            <p className="text-xs text-muted-foreground">
              This prompt will be used automatically when screenshots are taken
            </p>
          </div>
        )}

        {/* Attach on every request toggle - visible when screenshot mode is enabled */}
        {screenshotConfiguration.enabled && (
          <>
            <div className="flex justify-between items-center space-x-2 pt-3">
              <div className="flex-1">
                <Header
                  title="Attach to every request"
                  description="Automatically capture and attach a full-screen screenshot to every AI request when enabled."
                />
              </div>
              <div className="flex items-center">
                <Switch
                  checked={!!screenshotConfiguration.attachOnEveryRequest}
                  onCheckedChange={(checked) =>
                    handleScreenshotAttachChange(checked)
                  }
                />
              </div>
            </div>

            {/* Compression settings - visible regardless of attach-on-every-request */}
            <div className="flex justify-between items-center space-x-2 pt-3">
              <div className="flex-1">
                <Header
                  title="Compress screenshots"
                  description="Reduce image size by resizing and encoding screenshots as JPEG. This speeds up uploads while keeping text legible. Can also recompress manually attached images if enabled."
                />
              </div>
              <div className="flex items-center">
                <Switch
                  checked={!!screenshotConfiguration.compressionEnabled}
                  onCheckedChange={(checked) =>
                    handleScreenshotCompressionEnabledChange(checked as boolean)
                  }
                />
              </div>
            </div>

            {/* Compression options */}
            {screenshotConfiguration.compressionEnabled && (
              <div className="grid sm:grid-cols-2 gap-2 mt-3">
                <div className="space-y-1">
                  <Label className="text-sm font-medium">JPEG Quality (1-100)</Label>
                  <Input
                    type="number"
                    min={20}
                    max={100}
                    value={screenshotConfiguration.compressionQuality ?? 75}
                    onChange={(e) =>
                      handleScreenshotCompressionQualityChange(Number(e.target.value))
                    }
                    className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
                  />
                  <p className="text-xs text-muted-foreground">
                    Lower values produce smaller images but reduce clarity.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-medium">Max Dimension (px)</Label>
                  <Input
                    type="number"
                    min={400}
                    max={5000}
                    value={screenshotConfiguration.compressionMaxDimension ?? 1600}
                    onChange={(e) =>
                      handleScreenshotCompressionMaxDimChange(Number(e.target.value))
                    }
                    className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum length of the longest side before resizing.
                  </p>
                </div>
              </div>
            )}

            {/* Optionally recompress manually attached images */}
            {screenshotConfiguration.compressionEnabled && (
              <div className="flex justify-between items-center space-x-2 pt-3">
                <div className="flex-1">
                  <Header
                    title="Recompress attachments"
                    description="When enabled, images you attach manually will be recompressed with the same compression settings."
                  />
                </div>
                <div className="flex items-center">
                  <Switch
                    checked={!!screenshotConfiguration.recompressAttachments}
                    onCheckedChange={(checked) =>
                      handleScreenshotRecompressAttachmentsChange(checked as boolean)
                    }
                  />
                </div>
              </div>
            )}

            {/* Audio attachment options for screenshots */}
            {screenshotConfiguration.attachOnEveryRequest && (
              <div className="space-y-2 mt-3">
                <div className="flex justify-between items-center space-x-2">
                  <div className="flex-1">
                    <Header
                      title="Attach system audio"
                      description="Also attach a short system audio clip (and its transcription) with screenshots."
                    />
                  </div>
                  <div className="flex items-center">
                    <Switch
                      checked={!!screenshotConfiguration.attachAudioWithScreenshot}
                      onCheckedChange={(checked) =>
                        handleAttachAudioWithScreenshotChange(checked)
                      }
                    />
                  </div>
                </div>

                {screenshotConfiguration.attachAudioWithScreenshot && (
                  <div className="grid grid-cols-1 gap-2">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">Audio Mode</Label>
                      <Select
                        value={screenshotConfiguration.audioAttachMode || "last"}
                        onValueChange={(value) =>
                          handleScreenshotAudioModeChange(value as "last" | "record")
                        }
                      >
                        <SelectTrigger className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium">
                              {screenshotConfiguration.audioAttachMode === "record"
                                ? "Record now"
                                : "Use last transcription"}
                            </div>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="last">
                            <div className="font-medium">Use last transcription</div>
                          </SelectItem>
                          <SelectItem value="record">
                            <div className="font-medium">Record a short clip now</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {screenshotConfiguration.audioAttachMode === "record" && (
                      <div className="space-y-1">
                        <Label className="text-sm font-medium">Record Duration (seconds)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={screenshotConfiguration.audioRecordDurationSeconds || 3}
                          onChange={(e) =>
                            handleScreenshotAudioDurationChange(Number(e.target.value))
                          }
                          className="w-full h-11 border-1 border-input/50 focus:border-primary/50 transition-colors"
                        />
                        <p className="text-xs text-muted-foreground">
                          Length of the short audio clip recorded when you take a screenshot.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Tips */}
      <div className="text-xs text-muted-foreground/70">
        <p>
          💡 <strong>Tip:</strong>{" "}
          {screenshotConfiguration.enabled
            ? "Screenshot mode captures the full screen with one click."
            : "Selection mode lets you choose specific areas to capture."}{" "}
          Auto mode is great for quick analysis, manual mode gives you more
          control.
        </p>
      </div>
    </div>
  );
};
