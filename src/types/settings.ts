// Custom Provider types
export interface CustomProviderInput {
  text: {
    placement: string;
    exampleStructure: any;
  };
  image: {
    type: string;
    placement: string;
    exampleStructure: any;
  };
}

export interface CustomProviderResponse {
  contentPath: string;
  usagePath: string;
}

export interface CustomProvider {
  id: string;
  name: string;
  baseUrl: string;
  chatEndpoint: string;
  authType: string;
  authParam?: string;
  customHeaderName?: string;
  defaultModel: string;
  response: CustomProviderResponse;
  input: CustomProviderInput;
  models: null;
  isCustom: true;
  supportsStreaming: boolean;
  responseContentPath?: string;
  responseUsagePath?: string;
  textExampleStructure?: string;
  imageType?: string;
  imageExampleStructure?: string;
}

export type ScreenshotMode = "auto" | "manual";

// Screenshot configuration types
export interface ScreenshotConfig {
  mode: ScreenshotMode;
  autoPrompt: string;
  enabled: boolean;
  // When true, capture a full-screen screenshot and attach it to every AI request
  attachOnEveryRequest?: boolean;
  // When true, also attach a short system audio recording when a screenshot is taken
  attachAudioWithScreenshot?: boolean;
  // Mode for audio attachment: 'last' = use most recent stt snippet, 'record' = record a short clip at screenshot time
  audioAttachMode?: "last" | "record";
  // If audioAttachMode is 'record', duration (in seconds) to record for the clip
  audioRecordDurationSeconds?: number;

  // Compression settings: when enabled, screenshots will be resized and encoded as JPEG
  compressionEnabled?: boolean;
  // JPEG quality (1-100)
  compressionQuality?: number;
  // Maximum dimension (px) for the longest side before resizing
  compressionMaxDimension?: number;
}

// Speech-to-Text provider types
export interface SpeechProviderRequestConfig {
  audioFormat: string;
  audioFieldName: string;
  additionalFields?: { [key: string]: any };
}

export interface SpeechProviderResponse {
  contentPath: string;
  exampleStructure: any;
}

export interface SpeechProvider {
  id: string;
  name: string;
  baseUrl: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  authType: "bearer" | "custom-header" | "query" | "none";
  authParam?: string;
  customHeaderName?: string;
  apiKey?: string;
  request: SpeechProviderRequestConfig;
  response: SpeechProviderResponse;
  isCustom: boolean;
  supportsStreaming?: boolean;
  additionalHeaders?: { [key: string]: string };
}

export interface SpeechProviderFormData {
  name: string;
  baseUrl: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH";
  authType: "bearer" | "custom-header" | "query" | "none";
  authParam: string;
  customHeaderName: string;
  apiKey?: string;
  audioFormat: string;
  audioFieldName: string;
  contentPath: string;
  additionalFields: { [key: string]: string };
  additionalHeaders: { [key: string]: string };
  supportsStreaming: boolean;
}

// Settings-related types
export interface SettingsState {
  selectedProvider: string;
  apiKey: string;
  isApiKeySubmitted: boolean;
  selectedModel: string;
  customModel: string;
  systemPrompt: string;
  availableModels: string[];
  isLoadingModels: boolean;
  modelsFetchError: string | null;
  openAiApiKey: string;
  isOpenAiApiKeySubmitted: boolean;
  screenshotConfig: ScreenshotConfig;
  selectedSpeechProvider: string;
  speechProviders: SpeechProvider[];
  isSpeechProviderSubmitted: boolean;
}

export interface ModelSelectionProps {
  provider: string;
  selectedModel: string;
  customModel: string;
  onModelChange: (value: string) => void;
  onCustomModelChange: (value: string) => void;
  disabled?: boolean;
  availableModels?: string[];
  isLoadingModels?: boolean;
  modelsFetchError?: string | null;
}

export interface SelectedSpeechProvider {
  id: string;
  name: string;
  isConfigured: boolean;
  apiKey?: string;
}
