import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styled from "styled-components";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleStop,
  Clipboard,
  Code2,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FolderOpen,
  LogIn,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  TerminalSquare,
  X,
} from "lucide-react";
import { useEnv } from "../../components/hooks/UseEnv";
import {
  asRecord,
  BridgeEvent,
  BridgeStatus,
  CodexBridgeApi,
  JsonObject,
  nestedString,
  PendingRequest,
} from "./codexBridge";

const STORAGE_KEY = "openfawu.codexBridge.settings.v1";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  padding: 28px;
  background: radial-gradient(
      circle at 78% 0%,
      rgba(34, 130, 120, 0.14),
      transparent 30rem
    ),
    #f3f2ee;
  color: #172234;

  @media (max-width: 760px) {
    padding: 18px 12px 42px;
  }
`;

const Shell = styled.div`
  width: min(1480px, 100%);
  margin: 0 auto;
`;

const Header = styled.header`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 22px;

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const TitleGroup = styled.div`
  max-width: 820px;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #176c67;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(34px, 4vw, 54px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -1.7px;
`;

const Subtitle = styled.p`
  margin: 14px 0 0;
  color: #637184;
  line-height: 1.7;
  max-width: 760px;
`;

const StatusChip = styled.div<{ $ready: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 999px;
  padding: 9px 13px;
  background: ${(props) =>
    props.$ready ? "rgba(23,108,103,.11)" : "rgba(146,91,36,.11)"};
  color: ${(props) => (props.$ready ? "#176c67" : "#875624")};
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
`;

const Layout = styled.div`
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 18px;
  align-items: start;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.section`
  border: 1px solid rgba(23, 34, 52, 0.1);
  background: rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  box-shadow: 0 14px 40px rgba(24, 36, 52, 0.06);
  overflow: hidden;
`;

const PanelHeader = styled.div`
  padding: 18px 20px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const PanelBody = styled.div`
  padding: 18px 20px 20px;
`;

const Field = styled.label`
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
  color: #536174;
  font-size: 12px;
  font-weight: 800;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.15);
  border-radius: 10px;
  padding: 10px 11px;
  background: #fff;
  color: #172234;
  font: inherit;
  font-size: 13px;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.16);
    border-color: #31827d;
  }
`;

const Select = styled.select`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.15);
  border-radius: 10px;
  padding: 10px 11px;
  background: #fff;
  color: #172234;
  font: inherit;
  font-size: 13px;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.16);
    border-color: #31827d;
  }
`;

const TokenWrap = styled.div`
  position: relative;
`;

const TokenInput = styled(Input)`
  padding-right: 42px;
`;

const IconButton = styled.button`
  border: 0;
  background: transparent;
  color: #637184;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
  padding: 6px;
  border-radius: 7px;

  &:hover {
    background: rgba(23, 34, 52, 0.06);
  }
`;

const TokenToggle = styled(IconButton)`
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  border: 1px solid
    ${(props) =>
      props.$danger
        ? "rgba(168,57,57,.28)"
        : props.$primary
        ? "#176c67"
        : "rgba(23,34,52,.14)"};
  background: ${(props) =>
    props.$danger ? "#fff5f4" : props.$primary ? "#176c67" : "#fff"};
  color: ${(props) =>
    props.$danger ? "#a13939" : props.$primary ? "#fff" : "#26364a"};
  border-radius: 10px;
  padding: 9px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
`;

const SmallNote = styled.p`
  margin: 11px 0 0;
  color: #7a8798;
  font-size: 12px;
  line-height: 1.55;
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(23, 34, 52, 0.08);
  margin: 18px 0;
`;

const StatusList = styled.div`
  display: grid;
  gap: 9px;
`;

const StatusRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #68778a;
`;

const StatusValue = styled.span<{ $ok?: boolean }>`
  color: ${(props) => (props.$ok ? "#176c67" : "#47566a")};
  font-weight: 800;
  text-align: right;
`;

const SafetyBox = styled.div`
  margin-top: 16px;
  border-radius: 12px;
  padding: 13px;
  color: #4d5c6f;
  background: #eef1ec;
  font-size: 12px;
  line-height: 1.6;
`;

const WorkspaceHeader = styled.div`
  padding: 16px 20px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const SessionMeta = styled.div`
  min-width: 0;
`;

const SessionTitle = styled.div`
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SessionId = styled.div`
  margin-top: 5px;
  color: #8490a0;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChatBody = styled.div`
  min-height: 520px;
  max-height: calc(100dvh - 300px);
  overflow: auto;
  padding: 22px;
  background: rgba(248, 248, 245, 0.78);

  @media (max-width: 980px) {
    max-height: none;
    min-height: 430px;
  }
`;

const EmptyState = styled.div`
  height: 430px;
  display: grid;
  place-items: center;
  color: #7a8798;
  text-align: center;
  line-height: 1.7;
`;

const EmptyIcon = styled.div`
  width: 58px;
  height: 58px;
  margin: 0 auto 16px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: #e5eeeb;
  color: #176c67;
`;

const Message = styled.div<{ $user?: boolean }>`
  width: min(820px, 94%);
  margin: 0 ${(props) => (props.$user ? "0 0 auto" : "auto 0 0")} 16px;
  border-radius: 15px;
  border: 1px solid rgba(23, 34, 52, 0.1);
  background: ${(props) => (props.$user ? "#183149" : "#fff")};
  color: ${(props) => (props.$user ? "#f8f7f0" : "#26364a")};
  padding: 15px 16px;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
`;

const MessageMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 7px;
  opacity: 0.66;
  font-size: 11px;
  margin-bottom: 7px;
  font-weight: 800;
`;

const ActivityCard = styled.div`
  width: min(880px, 96%);
  margin: 0 auto 13px;
  border: 1px solid rgba(23, 34, 52, 0.09);
  background: #f1f3ef;
  border-radius: 12px;
  padding: 12px 14px;
  color: #526174;
  font-size: 12px;
`;

const ActivityTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #314257;
  font-weight: 800;
`;

const Mono = styled.pre`
  margin: 9px 0 0;
  max-height: 190px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  line-height: 1.55;
`;

const Composer = styled.form`
  padding: 16px;
  border-top: 1px solid rgba(23, 34, 52, 0.08);
  background: #fff;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 92px;
  resize: vertical;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.14);
  border-radius: 12px;
  padding: 13px;
  font: inherit;
  color: #172234;
  line-height: 1.55;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.15);
    border-color: #31827d;
  }
`;

const ComposerFooter = styled.div`
  margin-top: 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const ApprovalStack = styled.div`
  display: grid;
  gap: 12px;
  margin-bottom: 16px;
`;

const ApprovalCard = styled.div`
  border: 1px solid rgba(160, 91, 38, 0.25);
  background: #fff9f1;
  border-radius: 14px;
  padding: 15px;
`;

const ApprovalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  color: #875624;
  font-size: 13px;
  font-weight: 900;
`;

const ErrorBox = styled.div`
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  background: #fff1f0;
  color: #9c3838;
  font-size: 13px;
  line-height: 1.55;
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

const DeviceBox = styled.div`
  margin-top: 12px;
  padding: 13px;
  border-radius: 12px;
  background: #eef3f1;
  color: #46576a;
  font-size: 12px;
  line-height: 1.6;
`;

const DeviceCode = styled.code`
  display: block;
  margin: 8px 0;
  padding: 9px;
  border-radius: 8px;
  background: #17283b;
  color: #fff;
  font-size: 17px;
  letter-spacing: 2px;
  text-align: center;
`;

const ThreadList = styled.div`
  display: grid;
  gap: 7px;
  margin-top: 10px;
`;

const ThreadButton = styled.button`
  width: 100%;
  border: 1px solid rgba(23, 34, 52, 0.1);
  background: #fff;
  padding: 9px 10px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  color: #3c4d61;
  text-align: left;
  font-size: 12px;

  &:hover {
    border-color: rgba(23, 108, 103, 0.35);
  }
`;

type SavedSettings = {
  baseUrl: string;
  token: string;
  cwd: string;
  sandbox: "read-only" | "workspace-write";
  approvalPolicy: "on-request" | "untrusted";
  model: string;
};

type TranscriptEntry = {
  id: string;
  kind: "user" | "assistant" | "activity";
  text: string;
  title?: string;
};

const readSavedSettings = (defaultUrl: string): SavedSettings => {
  const fallback: SavedSettings = {
    baseUrl: defaultUrl || "http://127.0.0.1:8765",
    token: "",
    cwd: "",
    sandbox: "read-only",
    approvalPolicy: "on-request",
    model: "",
  };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<SavedSettings>;
    return {
      ...fallback,
      ...parsed,
      sandbox:
        parsed.sandbox === "workspace-write" ? "workspace-write" : "read-only",
      approvalPolicy:
        parsed.approvalPolicy === "untrusted" ? "untrusted" : "on-request",
    };
  } catch {
    return fallback;
  }
};

const readableAccount = (account: JsonObject | null): string => {
  if (!account) return "未读取";
  const email =
    nestedString(account, "account", "email") ||
    nestedString(account, "account", "name") ||
    nestedString(account, "email");
  if (email) return email;
  const type = nestedString(account, "account", "type");
  return type || "已连接";
};

const jsonPreview = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const itemSummary = (item: JsonObject): { title: string; detail: string } => {
  const type = typeof item.type === "string" ? item.type : "item";
  if (type === "commandExecution") {
    return {
      title: "命令执行",
      detail: [item.command, item.aggregatedOutput || item.output]
        .filter(Boolean)
        .map(String)
        .join("\n\n"),
    };
  }
  if (type === "fileChange") {
    return { title: "文件修改", detail: jsonPreview(item.changes || item) };
  }
  if (type === "reasoning") {
    return {
      title: "执行说明",
      detail: String(item.summary || "Codex 正在分析任务。"),
    };
  }
  return { title: type, detail: jsonPreview(item) };
};

export const LocalCodexPage = () => {
  const { REACT_APP_CODEX_BRIDGE_URL } = useEnv();
  const [settings, setSettings] = useState<SavedSettings>(() =>
    readSavedSettings(REACT_APP_CODEX_BRIDGE_URL)
  );
  const [showToken, setShowToken] = useState(false);
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [account, setAccount] = useState<JsonObject | null>(null);
  const [deviceLogin, setDeviceLogin] = useState<JsonObject | null>(null);
  const [threadId, setThreadId] = useState("");
  const [activeTurnId, setActiveTurnId] = useState("");
  const [threads, setThreads] = useState<JsonObject[]>([]);
  const [prompt, setPrompt] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cursorRef = useRef(0);
  const assistantTextRef = useRef<Record<string, string>>({});
  const chatRef = useRef<HTMLDivElement | null>(null);

  const api = useMemo(
    () => new CodexBridgeApi(settings.baseUrl, settings.token),
    [settings.baseUrl, settings.token]
  );

  const saveSettings = useCallback((next: SavedSettings) => {
    setSettings(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const updateSetting = <K extends keyof SavedSettings>(
    key: K,
    value: SavedSettings[K]
  ) => {
    saveSettings({ ...settings, [key]: value });
  };

  const appendEntry = useCallback((entry: TranscriptEntry) => {
    setTranscript((current) => {
      const existing = current.findIndex((item) => item.id === entry.id);
      if (existing < 0) return [...current, entry].slice(-180);
      const next = [...current];
      next[existing] = entry;
      return next;
    });
  }, []);

  const refreshPending = useCallback(async () => {
    const result = await api.get<{ data?: PendingRequest[] }>(
      "/api/v1/requests"
    );
    setPendingRequests(Array.isArray(result.data) ? result.data : []);
  }, [api]);

  const refreshConnection = useCallback(async () => {
    const nextStatus = await api.get<BridgeStatus>("/api/v1/status");
    setStatus(nextStatus);
    if (!settings.cwd && nextStatus.allowedRoots?.[0]) {
      saveSettings({ ...settings, cwd: nextStatus.allowedRoots[0] });
    }
    if (nextStatus.appServerRunning) {
      try {
        setAccount(await api.get<JsonObject>("/api/v1/account"));
      } catch {
        setAccount(null);
      }
      await refreshPending();
    }
  }, [api, refreshPending, saveSettings, settings]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/api/v1/connect");
      await refreshConnection();
      const result = await api.get<{ data?: JsonObject[] }>(
        "/api/v1/threads?limit=12"
      );
      setThreads(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法连接本地 Codex。");
    } finally {
      setBusy(false);
    }
  }, [api, refreshConnection]);

  const processEvent = useCallback(
    (event: BridgeEvent) => {
      const params = asRecord(event.params);
      if (event.kind === "request" && event.requestKey) {
        setPendingRequests((current) => {
          if (current.some((item) => item.requestKey === event.requestKey))
            return current;
          return [
            ...current,
            {
              requestKey: event.requestKey as string,
              method: event.method,
              params,
              supported:
                event.method === "item/commandExecution/requestApproval" ||
                event.method === "item/fileChange/requestApproval",
            },
          ];
        });
        return;
      }

      if (event.method === "turn/started") {
        const id = nestedString(params, "turn", "id");
        if (id) setActiveTurnId(id);
        return;
      }
      if (event.method === "turn/completed") {
        const id = nestedString(params, "turn", "id");
        setActiveTurnId((current) => (current === id || !id ? "" : current));
        return;
      }
      if (event.method === "item/agentMessage/delta") {
        const itemId =
          nestedString(params, "itemId") ||
          nestedString(params, "item", "id") ||
          "agent";
        const delta = typeof params.delta === "string" ? params.delta : "";
        assistantTextRef.current[itemId] =
          (assistantTextRef.current[itemId] || "") + delta;
        appendEntry({
          id: `assistant-${itemId}`,
          kind: "assistant",
          title: "Codex",
          text: assistantTextRef.current[itemId],
        });
        return;
      }
      if (
        event.method === "item/completed" ||
        event.method === "item/started"
      ) {
        const item = asRecord(params.item);
        const itemId =
          typeof item.id === "string" ? item.id : `${event.sequence}`;
        const type = typeof item.type === "string" ? item.type : "";
        if (type === "agentMessage") {
          const text = typeof item.text === "string" ? item.text : "";
          if (text) {
            assistantTextRef.current[itemId] = text;
            appendEntry({
              id: `assistant-${itemId}`,
              kind: "assistant",
              title: "Codex",
              text,
            });
          }
          return;
        }
        if (type === "userMessage") return;
        const summary = itemSummary(item);
        appendEntry({
          id: `activity-${itemId}`,
          kind: "activity",
          title: `${summary.title}${
            event.method.endsWith("started") ? " · 执行中" : ""
          }`,
          text: summary.detail,
        });
        return;
      }
      if (event.method === "account/login/completed") {
        void refreshConnection();
      }
      if (event.kind === "log" && typeof params.message === "string") {
        appendEntry({
          id: `log-${event.sequence}`,
          kind: "activity",
          title: "Codex 日志",
          text: params.message,
        });
      }
    },
    [appendEntry, refreshConnection]
  );

  useEffect(() => {
    if (!settings.token || !status?.appServerRunning) return undefined;
    let cancelled = false;
    let controller: AbortController | null = null;

    const poll = async () => {
      while (!cancelled) {
        controller = new AbortController();
        try {
          const page = await api.get<{
            events?: BridgeEvent[];
            cursor?: number;
            latestSequence?: number;
          }>(
            `/api/v1/events?after=${cursorRef.current}&wait=20&limit=300`,
            controller.signal
          );
          for (const event of page.events || []) processEvent(event);
          cursorRef.current =
            page.cursor ?? page.latestSequence ?? cursorRef.current;
        } catch (err) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : "事件流连接中断。");
          await new Promise((resolve) => window.setTimeout(resolve, 1500));
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [api, processEvent, settings.token, status?.appServerRunning]);

  useEffect(() => {
    chatRef.current?.scrollTo({
      top: chatRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [transcript, pendingRequests]);

  const startDeviceLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.post<JsonObject>("/api/v1/account/login/device");
      setDeviceLogin(result);
      const url =
        nestedString(result, "verificationUrl") ||
        nestedString(result, "verificationUri") ||
        nestedString(result, "verification_url");
      if (url) window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法发起设备码登录。");
    } finally {
      setBusy(false);
    }
  };

  const startThread = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api.post<JsonObject>("/api/v1/threads", {
        cwd: settings.cwd,
        sandbox: settings.sandbox,
        approvalPolicy: settings.approvalPolicy,
        model: settings.model,
      });
      const id = nestedString(result, "thread", "id");
      if (!id) throw new Error("Codex 未返回线程 ID。");
      setThreadId(id);
      setActiveTurnId("");
      setTranscript([]);
      assistantTextRef.current = {};
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法创建 Codex 会话。");
    } finally {
      setBusy(false);
    }
  };

  const resumeThread = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await api.post(`/api/v1/threads/${encodeURIComponent(id)}/resume`);
      setThreadId(id);
      setActiveTurnId("");
      setTranscript([]);
      assistantTextRef.current = {};
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法恢复 Codex 会话。");
    } finally {
      setBusy(false);
    }
  };

  const sendPrompt = async (event: FormEvent) => {
    event.preventDefault();
    const value = prompt.trim();
    if (!value || !threadId || activeTurnId) return;
    setPrompt("");
    appendEntry({
      id: `user-${Date.now()}`,
      kind: "user",
      text: value,
      title: "你",
    });
    setError("");
    try {
      const result = await api.post<JsonObject>(
        `/api/v1/threads/${encodeURIComponent(threadId)}/turns`,
        {
          prompt: value,
          clientUserMessageId: crypto.randomUUID?.() || `${Date.now()}`,
        }
      );
      const id = nestedString(result, "turn", "id");
      if (id) setActiveTurnId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "任务提交失败。");
    }
  };

  const interrupt = async () => {
    if (!threadId || !activeTurnId) return;
    try {
      await api.post(
        `/api/v1/threads/${encodeURIComponent(
          threadId
        )}/turns/${encodeURIComponent(activeTurnId)}/interrupt`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "中断任务失败。");
    }
  };

  const decide = async (requestKey: string, decision: string) => {
    try {
      await api.post(`/api/v1/requests/${requestKey}/decision`, { decision });
      setPendingRequests((current) =>
        current.filter((request) => request.requestKey !== requestKey)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "审批提交失败。");
    }
  };

  const connected = Boolean(status?.appServerRunning);
  const deviceUrl =
    nestedString(deviceLogin, "verificationUrl") ||
    nestedString(deviceLogin, "verificationUri") ||
    nestedString(deviceLogin, "verification_url");
  const deviceCode =
    nestedString(deviceLogin, "userCode") ||
    nestedString(deviceLogin, "user_code");

  return (
    <Page>
      <Shell>
        <Header>
          <TitleGroup>
            <Eyebrow>
              <TerminalSquare size={16} /> 宿主机执行器
            </Eyebrow>
            <Title>本地 Codex</Title>
            <Subtitle>
              网页负责法务任务、会话和审批；Codex CLI 使用你本机的 ChatGPT
              登录、工作目录和沙箱执行。桥接器只监听回环地址，不提供任意 Shell
              API。
            </Subtitle>
          </TitleGroup>
          <StatusChip $ready={connected}>
            {connected ? <Check size={15} /> : <AlertTriangle size={15} />}
            {connected ? "Codex 已连接" : "尚未连接桥接器"}
          </StatusChip>
        </Header>

        {error && (
          <ErrorBox>
            <AlertTriangle size={17} />
            <span>{error}</span>
          </ErrorBox>
        )}

        <Layout>
          <div>
            <Panel>
              <PanelHeader>
                <PanelTitle>
                  <Code2 size={17} /> 本机连接
                </PanelTitle>
                <IconButton
                  type="button"
                  title="刷新"
                  onClick={() => void refreshConnection()}
                >
                  <RefreshCw size={15} />
                </IconButton>
              </PanelHeader>
              <PanelBody>
                <Field>
                  桥接器地址
                  <Input
                    value={settings.baseUrl}
                    onChange={(event) =>
                      updateSetting("baseUrl", event.target.value)
                    }
                    placeholder="http://127.0.0.1:8765"
                  />
                </Field>
                <Field>
                  桥接器 Token
                  <TokenWrap>
                    <TokenInput
                      type={showToken ? "text" : "password"}
                      value={settings.token}
                      onChange={(event) =>
                        updateSetting("token", event.target.value)
                      }
                      placeholder="make -f openfawu.mk codex-token"
                      autoComplete="off"
                    />
                    <TokenToggle
                      type="button"
                      aria-label={showToken ? "隐藏 Token" : "显示 Token"}
                      onClick={() => setShowToken((value) => !value)}
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </TokenToggle>
                  </TokenWrap>
                </Field>
                <ButtonRow>
                  <Button
                    $primary
                    type="button"
                    disabled={busy}
                    onClick={() => void connect()}
                  >
                    <Play size={15} /> 连接 Codex
                  </Button>
                  <Button
                    type="button"
                    disabled={!settings.token || busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api.post("/api/v1/restart");
                        await refreshConnection();
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "重启失败。"
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <RotateCcw size={15} /> 重启
                  </Button>
                </ButtonRow>
                <SmallNote>
                  初始化命令：<code>make -f openfawu.mk codex-init</code>
                  ；启动命令：
                  <code>make -f openfawu.mk codex-bridge</code>。
                </SmallNote>

                <Divider />
                <StatusList>
                  <StatusRow>
                    Codex CLI
                    <StatusValue $ok={status?.codexAvailable}>
                      {status?.codexVersion ||
                        (status?.codexAvailable ? "已安装" : "未检测到")}
                    </StatusValue>
                  </StatusRow>
                  <StatusRow>
                    App Server
                    <StatusValue $ok={status?.appServerRunning}>
                      {status?.appServerRunning
                        ? `PID ${status.appServerPid}`
                        : "未启动"}
                    </StatusValue>
                  </StatusRow>
                  <StatusRow>
                    ChatGPT 账户
                    <StatusValue $ok={Boolean(account)}>
                      {readableAccount(account)}
                    </StatusValue>
                  </StatusRow>
                  <StatusRow>
                    待审批
                    <StatusValue $ok={pendingRequests.length === 0}>
                      {pendingRequests.length}
                    </StatusValue>
                  </StatusRow>
                </StatusList>

                <ButtonRow style={{ marginTop: 14 }}>
                  <Button
                    type="button"
                    disabled={!connected || busy}
                    onClick={() => void startDeviceLogin()}
                  >
                    <LogIn size={15} /> ChatGPT 设备码登录
                  </Button>
                </ButtonRow>
                {deviceLogin && (
                  <DeviceBox>
                    在浏览器打开登录页面，并输入设备码：
                    {deviceCode && <DeviceCode>{deviceCode}</DeviceCode>}
                    {deviceUrl && (
                      <Button
                        type="button"
                        onClick={() =>
                          window.open(
                            deviceUrl,
                            "_blank",
                            "noopener,noreferrer"
                          )
                        }
                      >
                        <ExternalLink size={14} /> 打开登录页面
                      </Button>
                    )}
                  </DeviceBox>
                )}

                <SafetyBox>
                  <strong>安全边界</strong>
                  <br />
                  只允许配置根目录内的工作区；只开放 read-only 和
                  workspace-write；命令及文件改动由网页逐项确认；没有“关闭沙箱”按钮。
                </SafetyBox>
              </PanelBody>
            </Panel>

            <Panel style={{ marginTop: 16 }}>
              <PanelHeader>
                <PanelTitle>
                  <FolderOpen size={17} /> 会话设置
                </PanelTitle>
              </PanelHeader>
              <PanelBody>
                <Field>
                  本地工作目录
                  <Input
                    value={settings.cwd}
                    onChange={(event) =>
                      updateSetting("cwd", event.target.value)
                    }
                    placeholder={
                      status?.allowedRoots?.[0] || "~/.openfawu/workspaces"
                    }
                  />
                </Field>
                <Field>
                  沙箱
                  <Select
                    value={settings.sandbox}
                    onChange={(event) =>
                      updateSetting(
                        "sandbox",
                        event.target.value as SavedSettings["sandbox"]
                      )
                    }
                  >
                    <option value="read-only">只读：分析与检索</option>
                    <option value="workspace-write">
                      工作区写入：生成和修改文件
                    </option>
                  </Select>
                </Field>
                <Field>
                  审批策略
                  <Select
                    value={settings.approvalPolicy}
                    onChange={(event) =>
                      updateSetting(
                        "approvalPolicy",
                        event.target.value as SavedSettings["approvalPolicy"]
                      )
                    }
                  >
                    <option value="on-request">按需审批</option>
                    <option value="untrusted">不可信命令审批</option>
                  </Select>
                </Field>
                <Field>
                  模型（留空使用 Codex 默认）
                  <Input
                    value={settings.model}
                    onChange={(event) =>
                      updateSetting("model", event.target.value)
                    }
                    placeholder="留空"
                  />
                </Field>
                <Button
                  $primary
                  type="button"
                  disabled={!connected || busy}
                  onClick={() => void startThread()}
                >
                  <TerminalSquare size={15} /> 新建法务会话
                </Button>

                {threads.length > 0 && (
                  <>
                    <Divider />
                    <SmallNote>最近的本地 Codex 会话</SmallNote>
                    <ThreadList>
                      {threads.slice(0, 8).map((thread) => {
                        const id =
                          typeof thread.id === "string" ? thread.id : "";
                        const preview =
                          typeof thread.preview === "string" && thread.preview
                            ? thread.preview
                            : id;
                        return (
                          <ThreadButton
                            key={id}
                            type="button"
                            onClick={() => void resumeThread(id)}
                          >
                            <span>{preview.slice(0, 46)}</span>
                            <ChevronRight size={14} />
                          </ThreadButton>
                        );
                      })}
                    </ThreadList>
                  </>
                )}
              </PanelBody>
            </Panel>
          </div>

          <Panel>
            <WorkspaceHeader>
              <SessionMeta>
                <SessionTitle>
                  <TerminalSquare size={17} />
                  {threadId ? "法务 Agent 会话" : "尚未创建会话"}
                </SessionTitle>
                {threadId && <SessionId>{threadId}</SessionId>}
              </SessionMeta>
              <ButtonRow>
                {activeTurnId && (
                  <Button
                    $danger
                    type="button"
                    onClick={() => void interrupt()}
                  >
                    <CircleStop size={15} /> 中断当前任务
                  </Button>
                )}
                {threadId && (
                  <IconButton
                    type="button"
                    title="复制线程 ID"
                    onClick={() => void navigator.clipboard.writeText(threadId)}
                  >
                    <Clipboard size={15} />
                  </IconButton>
                )}
              </ButtonRow>
            </WorkspaceHeader>

            <ChatBody ref={chatRef}>
              {pendingRequests.length > 0 && (
                <ApprovalStack>
                  {pendingRequests.map((request) => {
                    const command =
                      typeof request.params.command === "string"
                        ? request.params.command
                        : "";
                    const cwd =
                      typeof request.params.cwd === "string"
                        ? request.params.cwd
                        : "";
                    const fileChanges =
                      request.params.fileChanges ?? request.params.changes;
                    const approvalDetail =
                      command ||
                      (fileChanges != null ? jsonPreview(fileChanges) : "");
                    return (
                      <ApprovalCard key={request.requestKey}>
                        <ApprovalTitle>
                          <AlertTriangle size={16} />
                          {request.method.includes("fileChange")
                            ? "Codex 请求修改文件"
                            : "Codex 请求执行命令"}
                        </ApprovalTitle>
                        {cwd && <SmallNote>目录：{cwd}</SmallNote>}
                        {approvalDetail ? <Mono>{approvalDetail}</Mono> : null}
                        {!request.supported && (
                          <SmallNote>
                            该请求类型尚未由安全桥接器支持。
                          </SmallNote>
                        )}
                        <ButtonRow style={{ marginTop: 12 }}>
                          <Button
                            $primary
                            type="button"
                            disabled={!request.supported}
                            onClick={() =>
                              void decide(request.requestKey, "accept")
                            }
                          >
                            <Check size={14} /> 允许一次
                          </Button>
                          {request.method.includes("commandExecution") && (
                            <Button
                              type="button"
                              disabled={!request.supported}
                              onClick={() =>
                                void decide(
                                  request.requestKey,
                                  "acceptForSession"
                                )
                              }
                            >
                              <ShieldCheck size={14} /> 本会话允许
                            </Button>
                          )}
                          <Button
                            $danger
                            type="button"
                            disabled={!request.supported}
                            onClick={() =>
                              void decide(request.requestKey, "decline")
                            }
                          >
                            <X size={14} /> 拒绝
                          </Button>
                        </ButtonRow>
                      </ApprovalCard>
                    );
                  })}
                </ApprovalStack>
              )}

              {transcript.length === 0 ? (
                <EmptyState>
                  <div>
                    <EmptyIcon>
                      <FileCode2 size={27} />
                    </EmptyIcon>
                    {threadId ? (
                      <>
                        输入一个法务任务。Codex
                        可以读取当前工作目录、整理证据、生成报告文件，写入和命令执行仍受沙箱与审批约束。
                      </>
                    ) : (
                      <>先连接桥接器并创建一个会话。</>
                    )}
                  </div>
                </EmptyState>
              ) : (
                transcript.map((entry) =>
                  entry.kind === "activity" ? (
                    <ActivityCard key={entry.id}>
                      <ActivityTitle>
                        <TerminalSquare size={14} /> {entry.title}
                      </ActivityTitle>
                      {entry.text && <Mono>{entry.text}</Mono>}
                    </ActivityCard>
                  ) : (
                    <Message key={entry.id} $user={entry.kind === "user"}>
                      <MessageMeta>
                        {entry.title ||
                          (entry.kind === "user" ? "你" : "Codex")}
                      </MessageMeta>
                      {entry.text}
                    </Message>
                  )
                )
              )}
            </ChatBody>

            <Composer onSubmit={sendPrompt}>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={!threadId || Boolean(activeTurnId)}
                placeholder={
                  threadId
                    ? "例如：读取当前目录中的采购合同，提取付款、责任限制和数据处理条款；每条结论标明来源文件及位置，不确定项单独列出。"
                    : "请先创建或恢复一个 Codex 会话。"
                }
              />
              <ComposerFooter>
                <SmallNote style={{ margin: 0 }}>
                  {activeTurnId
                    ? "Codex 正在执行；可中断或处理上方审批。"
                    : "Enter 换行，点击发送提交任务。"}
                </SmallNote>
                <Button
                  $primary
                  type="submit"
                  disabled={
                    !threadId || !prompt.trim() || Boolean(activeTurnId)
                  }
                >
                  <Send size={15} /> 发送任务
                </Button>
              </ComposerFooter>
            </Composer>
          </Panel>
        </Layout>
      </Shell>
    </Page>
  );
};
