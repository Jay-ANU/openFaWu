export type JsonObject = Record<string, unknown>;

export interface BridgeStatus extends JsonObject {
  bridgeVersion?: string;
  codexAvailable?: boolean;
  codexCommand?: string;
  codexVersion?: string | null;
  appServerRunning?: boolean;
  appServerPid?: number | null;
  allowedRoots?: string[];
  pendingRequests?: number;
  latestEventSequence?: number;
  stderrTail?: string[];
  security?: {
    loopbackOnly?: boolean;
    allowedSandboxes?: string[];
    allowNoApproval?: boolean;
    directShellEndpoint?: boolean;
  };
}

export interface BridgeEvent {
  sequence: number;
  receivedAt: number;
  kind: "notification" | "request" | "bridge" | "log" | string;
  method: string;
  params: JsonObject;
  threadId?: string | null;
  requestKey?: string;
}

export interface EventPage {
  events: BridgeEvent[];
  cursor: number;
  oldestSequence: number;
  latestSequence: number;
  resetRequired: boolean;
}

export interface PendingRequest {
  requestKey: string;
  method: string;
  params: JsonObject;
  supported: boolean;
}

export class BridgeHttpError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "BridgeHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");

export class CodexBridgeApi {
  readonly baseUrl: string;
  readonly token: string;

  constructor(baseUrl: string, token: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
    this.token = token.trim();
  }

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: "GET", signal });
  }

  async post<T>(path: string, body: JsonObject = {}): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.baseUrl) throw new Error("请先填写桥接器地址。");
    if (!this.token) throw new Error("请先填写桥接器 Token。");

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const error =
        payload && typeof payload === "object"
          ? (payload as { error?: { message?: string; code?: string; details?: unknown } })
              .error
          : undefined;
      throw new BridgeHttpError(
        response.status,
        error?.message || `桥接器请求失败（HTTP ${response.status}）。`,
        error?.code,
        error?.details
      );
    }
    return payload as T;
  }
}

export const asRecord = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

export const nestedString = (value: unknown, ...keys: string[]): string | undefined => {
  let current: unknown = value;
  for (const key of keys) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined;
    current = (current as JsonObject)[key];
  }
  return typeof current === "string" ? current : undefined;
};
