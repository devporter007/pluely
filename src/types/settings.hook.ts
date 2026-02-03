import { TYPE_PROVIDER } from "./provider.type";
import { ScreenshotConfig, ScreenshotMode } from "./settings";

export interface UseSettingsReturn {
  screenshotConfiguration: ScreenshotConfig;
  setScreenshotConfiguration: React.Dispatch<
    React.SetStateAction<ScreenshotConfig>
  >;
  handleScreenshotModeChange: (value: ScreenshotMode) => void;
  handleScreenshotPromptChange: (value: string) => void;
  handleScreenshotEnabledChange: (enabled: boolean) => void;
  handleScreenshotAttachChange: (enabled: boolean) => void;
  handleAttachAudioWithScreenshotChange: (enabled: boolean) => void;
  handleScreenshotAudioModeChange: (mode: "last" | "record") => void;
  handleScreenshotAudioDurationChange: (seconds: number) => void;
  handleScreenshotCompressionEnabledChange: (enabled: boolean) => void;
  handleScreenshotCompressionQualityChange: (quality: number) => void;
  handleScreenshotCompressionMaxDimChange: (maxDim: number) => void;
  allAiProviders: TYPE_PROVIDER[];
  allSttProviders: TYPE_PROVIDER[];
  selectedAIProvider: { provider: string; variables: Record<string, string> };
  selectedSttProvider: {
    provider: string;
    variables: Record<string, string>;
  };
  onSetSelectedAIProvider: (provider: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  onSetSelectedSttProvider: (provider: {
    provider: string;
    variables: Record<string, string>;
  }) => void;
  handleDeleteAllChatsConfirm: () => void;
  showDeleteConfirmDialog: boolean;
  setShowDeleteConfirmDialog: React.Dispatch<React.SetStateAction<boolean>>;
  variables: { key: string; value: string }[];
  sttVariables: { key: string; value: string }[];
  hasActiveLicense: boolean;
}
