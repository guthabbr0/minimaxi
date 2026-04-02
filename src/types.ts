export type AppMode = "text" | "image" | "video";
export type Theme = "midnight" | "ember" | "abyss";
export type TextBackend = "openai" | "native";
export type CatalogSource = "static" | "dynamic";
export type ThreadItemStatus = "running" | "success" | "error";
export type ImageVariant = "t2i" | "i2i";
export type VideoVariant = "t2v" | "i2v";
export type VideoTaskStatus =
  | "queued"
  | "processing"
  | "success"
  | "failed";
export type ImageResponseFormat = "base64" | "url";
export type ImageReferenceType = "character" | "subject" | "style";

export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  total_characters?: number;
}

export interface Telemetry {
  requestStartedAt: number;
  headersAt?: number;
  firstTokenAt?: number;
  completedAt?: number;
  ttfbMs?: number;
  ttftMs?: number;
  generationMs?: number;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
  approximate?: boolean;
  requestId?: string;
  responseId?: string;
  model?: string;
}

export interface ApiErrorInfo {
  status?: number;
  code?: string | number;
  message: string;
  raw?: unknown;
}

export interface AppSettings {
  apiBaseUrl: string;
  apiKey: string;
  activeMode: AppMode;
  streamText: boolean;
  rememberKey: boolean;
  showReasoning: boolean;
  theme: Theme;
}

export interface UploadAsset {
  id: string;
  assetId: string;
  name: string;
  mimeType: string;
  previewUrl?: string;
}

export interface ImageReference extends UploadAsset {
  type: ImageReferenceType;
}

export interface TextConfig {
  backend: TextBackend;
  model: string;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoningSplit: boolean;
  toolsJson: string;
  toolChoice: string;
  extraBodyJson: string;
}

export interface ImageConfig {
  variant: ImageVariant;
  model: string;
  prompt: string;
  aspectRatio: string;
  width: number | "";
  height: number | "";
  responseFormat: ImageResponseFormat;
  seed: number | "";
  n: number;
  promptOptimizer: boolean;
  subjectReferences: ImageReference[];
}

export interface VideoConfig {
  variant: VideoVariant;
  model: string;
  prompt: string;
  duration: number;
  resolution: string;
  promptOptimizer: boolean;
  fastPretreatment: boolean;
  firstFrameImage: UploadAsset | null;
  firstFrameUrl: string;
}

export interface ThreadDrafts {
  textPrompt: string;
  imagePrompt: string;
  videoPrompt: string;
}

export interface OpenAiTextMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
  reasoning_details?: Array<Record<string, unknown>>;
}

export interface NativeTextMessage {
  role: "system" | "user" | "assistant";
  name?: string;
  content?: string;
}

export interface TextRequestPayload {
  prompt: string;
  backend: TextBackend;
  model: string;
  stream: boolean;
  systemPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  reasoningSplit: boolean;
  toolsJson?: string;
  toolChoice?: string;
  extraBodyJson?: string;
}

export interface TextResponsePayload {
  content: string;
  reasoning: string;
  toolCalls: unknown[];
  finishReason?: string | null;
  usage?: TokenUsage;
  rawMessage?: Record<string, unknown>;
  raw?: unknown;
}

export interface GeneratedImage {
  assetId?: string;
  mimeType: string;
  objectUrl?: string;
  remoteUrl?: string;
  width?: number;
  height?: number;
}

export interface ImageRequestPayload {
  prompt: string;
  variant: ImageVariant;
  model: string;
  aspectRatio: string;
  width: number | "";
  height: number | "";
  responseFormat: ImageResponseFormat;
  seed: number | "";
  n: number;
  promptOptimizer: boolean;
  subjectReferences: ImageReference[];
}

export interface ImageResponsePayload {
  images: GeneratedImage[];
  metadata?: {
    failed_count?: string;
    success_count?: string;
  };
  raw?: unknown;
}

export interface VideoRequestPayload {
  prompt: string;
  variant: VideoVariant;
  model: string;
  duration: number;
  resolution: string;
  promptOptimizer: boolean;
  fastPretreatment: boolean;
  firstFrameImage: UploadAsset | null;
  firstFrameUrl: string;
}

export interface VideoResponsePayload {
  taskId: string;
  status: VideoTaskStatus;
  fileId?: string;
  downloadUrl?: string;
  expiresAt?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  pollStartedAt?: number;
  raw?: unknown;
}

export type ThreadItemRequest =
  | TextRequestPayload
  | ImageRequestPayload
  | VideoRequestPayload;

export type ThreadItemResponse =
  | TextResponsePayload
  | ImageResponsePayload
  | VideoResponsePayload;

export interface ThreadItem {
  id: string;
  kind: AppMode;
  mode: AppMode;
  status: ThreadItemStatus;
  request: ThreadItemRequest;
  response?: ThreadItemResponse;
  telemetry?: Telemetry;
  error?: ApiErrorInfo;
  createdAt: number;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  items: ThreadItem[];
  drafts: ThreadDrafts;
  textConfig: TextConfig;
  imageConfig: ImageConfig;
  videoConfig: VideoConfig;
}

export interface ModelCatalog {
  source: CatalogSource;
  textOpenAi: string[];
  textNative: string[];
  imageT2I: string[];
  imageI2I: string[];
  videoT2V: string[];
  videoI2V: string[];
}

export interface CatalogState {
  catalog: ModelCatalog;
  isDiscovering: boolean;
  error?: string;
}

export interface GeneratedImagePayload {
  mimeType: string;
  blob?: Blob;
  remoteUrl?: string;
}

export interface ImageGenerationResult {
  id?: string;
  generated: GeneratedImagePayload[];
  metadata?: {
    failed_count?: string;
    success_count?: string;
  };
  raw?: unknown;
  requestId?: string;
}

export interface VideoFileInfo {
  fileId?: string;
  downloadUrl?: string;
  expiresAt?: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
  raw?: unknown;
}

export interface TextGenerationResult {
  content: string;
  reasoning: string;
  toolCalls: unknown[];
  usage?: TokenUsage;
  rawMessage?: Record<string, unknown>;
  raw?: unknown;
  finishReason?: string | null;
  responseId?: string;
  requestId?: string;
  firstTokenAt?: number;
}

export interface StreamSnapshot {
  content: string;
  reasoning: string;
  toolCalls: unknown[];
  responseId?: string;
}
