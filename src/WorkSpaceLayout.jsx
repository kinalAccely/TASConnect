import React, { useEffect } from "react";
import LeftSidebar from "./components/LeftSidebar.jsx";
import ChatSection from "./components/ChatSection.jsx";
import RightSidebar from "./components/RightSidebar.jsx";
import TopHeader from "./components/TopHeader.jsx";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  resolveAssistantId,
  fetchgraphIdAccordingToCurrentModule,
} from "./services/threadService.js";

const LIVE_DEMO_STEPS = [
  "Load interactive preview",
  "Demonstrate the core workflow",
  "Highlight captured insights",
  "Outline follow-up actions",
];

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const DEFAULT_ASSISTANT_ID = import.meta.env.VITE_ASSISTANT_ID ?? "agent";
const DEFAULT_STREAM_MODES = ["messages-tuple", "values", "modules", "metadata", "custom"];
const TRAINING_STREAM_MODES = ["values", "modules", "metadata", "custom"];
const TEXTUAL_CONTENT_TYPES = new Set([
  "text",
  "output_text",
  "ai",
  "assistant",
  "response",
  "module",
]);

const resolveRole = (message, fallback) => {
  if (message?.role) {
    return message.role;
  }
  if (message?.type === "human" || message?.type === "user") {
    return "user";
  }
  if (message?.type === "system") {
    return "system";
  }
  if (message?.type === "tool" || message?.type === "tool_message") {
    return "tool";
  }
  return fallback;
};

const extractTextFromContent = (content) => {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part) {
          return "";
        }
        if (typeof part === "string") {
          return part;
        }
        if (
          part.type &&
          !TEXTUAL_CONTENT_TYPES.has(part.type) &&
          !part.type.includes("text")
        ) {
          return "";
        }
        if (typeof part.text === "string") {
          return part.text;
        }
        if (Array.isArray(part.text)) {
          return part.text.filter(Boolean).join("");
        }
        if (typeof part.value === "string") {
          return part.value;
        }
        if (typeof part.content === "string") {
          return part.content;
        }
        if (
          typeof part?.data?.content === "string" &&
          part.type?.includes("text")
        ) {
          return part.data.content;
        }
        return "";
      })
      .join("");
  }

  if (typeof content === "object") {
    if (typeof content.text === "string") {
      return content.text;
    }
    if (Array.isArray(content.text)) {
      return content.text.filter(Boolean).join("");
    }
    if (typeof content.value === "string") {
      return content.value;
    }
    if (typeof content.content === "string") {
      return content.content;
    }
  }

  return "";
};

const extractModuleText = (modulePayload) => {
  if (!modulePayload) {
    return "";
  }

  const visited = new WeakSet();

  const traverse = (value) => {
    if (value == null) {
      return "";
    }
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => traverse(item))
        .filter(Boolean)
        .join("\n");
    }
    if (typeof value === "object") {
      if (visited.has(value)) {
        return "";
      }
      visited.add(value);

      if (typeof value.text === "string") {
        return value.text;
      }
      if (Array.isArray(value.text)) {
        return value.text.filter(Boolean).join("");
      }

      if (value.content !== undefined) {
        const contentText =
          typeof value.content === "string"
            ? value.content
            : Array.isArray(value.content)
              ? value.content
                .map((item) =>
                  typeof item === "string" ? item : traverse(item),
                )
                .filter(Boolean)
                .join("")
              : traverse(value.content);
        if (contentText) {
          return contentText;
        }
      }

      if (value.value !== undefined) {
        const valueText = traverse(value.value);
        if (valueText) {
          return valueText;
        }
      }

      if (Array.isArray(value.messages)) {
        const messagesText = value.messages
          .map((message) => {
            if (!message) {
              return "";
            }
            if (typeof message === "string") {
              return message;
            }
            if (typeof message.text === "string") {
              return message.text;
            }
            if (Array.isArray(message.text)) {
              return message.text.filter(Boolean).join("");
            }
            if (message.content) {
              return traverse(message.content);
            }
            return "";
          })
          .filter(Boolean)
          .join("\n");
        if (messagesText) {
          return messagesText;
        }
      }

      const merged = Object.values(value)
        .map((entry) => traverse(entry))
        .filter(Boolean)
        .join("\n");
      return merged;
    }

    return "";
  };

  return traverse(modulePayload).trim();
};

const extractMessageText = (message) => {
  if (!message) {
    return "";
  }

  const uniqueSegments = new Set();
  const segments = [];
  const pushSegment = (value) => {
    if (typeof value !== "string") {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }
    if (uniqueSegments.has(trimmed)) {
      return;
    }
    uniqueSegments.add(trimmed);
    segments.push(trimmed);
  };

  if (typeof message.text === "string" && message.text.length > 0) {
    pushSegment(message.text);
  }
  if (typeof message.content === "string") {
    pushSegment(message.content);
  } else {
    const contentText = extractTextFromContent(message.content);
    if (contentText) {
      pushSegment(contentText);
    }
  }

  const moduleCandidates = [
    message.module,
    message.module_output,
    message.moduleOutput,
    message.moduleResult,
  ];
  moduleCandidates.forEach((candidate) => {
    const moduleText = extractModuleText(candidate);
    if (moduleText) {
      pushSegment(moduleText);
    }
  });

  if (typeof message.value === "string") {
    pushSegment(message.value);
  }

  return segments.join("\n\n");
};

const mapMessagesForDisplay = (streamMessages, isLoading) => {
  console.log("Mapping messages for display:", streamMessages, isLoading);
  if (!Array.isArray(streamMessages)) {
    return [];
  }

  const normalized = [];
  let lastAssistantIndex = -1;

  streamMessages.forEach((message, index) => {
    if (!message) {
      return;
    }

    const type = message.type ?? message.role;
    if (
      type === "tool" ||
      type === "tool_calls" ||
      type === "tool_message" ||
      type === "tool_result"
    ) {
      return;
    }

    const role = resolveRole(message, "assistant");
    const rawText = extractMessageText(message);
    const trimmedText = rawText.trim();

    if (!trimmedText && role !== "user") {
      return;
    }

    const normalizedMessage = {
      id: message.id ?? `${role}-${index}`,
      role,
      text: trimmedText || rawText,
      type,
      raw: message,
    };

    normalized.push(normalizedMessage);

    if (role !== "user" && role !== "system") {
      lastAssistantIndex = normalized.length - 1;
    }
  });

  if (isLoading && lastAssistantIndex >= 0) {
    normalized[lastAssistantIndex] = {
      ...normalized[lastAssistantIndex],
      isStreaming: true,
    };
  }

  return normalized;
};

const resolveStageFromValues = (values) => {
  if (!values || typeof values !== "object") {
    return {
      stage: undefined,
      stageProgress: undefined,
    };
  }

  const stage =
    typeof values.stage === "string"
      ? values.stage
      : typeof values.stageName === "string"
        ? values.stageName
        : typeof values.current_stage === "string"
          ? values.current_stage
          : undefined;

  const progressValue =
    typeof values.stageProgress === "number"
      ? values.stageProgress
      : typeof values.stage_progress === "number"
        ? values.stage_progress
        : typeof values.progress === "number"
          ? values.progress
          : undefined;

  const stageProgress =
    typeof progressValue === "number" && Number.isFinite(progressValue)
      ? Math.min(Math.max(progressValue, 0), 100)
      : undefined;

  return { stage, stageProgress };
};

export default function workSpaceLayout({ onNavigate, chatId, initialTab = "Chat" }) {
  const chatBodyRef = React.useRef(null);

  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [isLeftCollapsed, setIsLeftCollapsed] = React.useState(false);
  const [isRightCollapsed, setIsRightCollapsed] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [activeThreadId, setActiveThreadId] = React.useState(null);
  const [toolOutputs, setToolOutputs] = React.useState([]);
  const [sources, setSources] = React.useState([]);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [toolScanVersion, setToolScanVersion] = React.useState(0);
  const [assistantSelectionKey, setAssistantSelectionKey] = React.useState(null);
  const [theme, setTheme] = React.useState(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = window.localStorage.getItem("tas-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [liveDemoSteps, setLiveDemoSteps] = React.useState(LIVE_DEMO_STEPS);
  const seenToolIdsRef = React.useRef(new Set());
  const toolChunkAccumulatorRef = React.useRef(new Map());
  const sourcesCacheRef = React.useRef(new Map());
  const activeRunRef = React.useRef(null);
  const cancelActiveRunRef = React.useRef(null);
  const previousToolCountRef = React.useRef(0);
  const transitionTimeoutRef = React.useRef(null);
  const [isThreadTransitioning, setIsThreadTransitioning] = React.useState(false);
  const assistantQuickOptions = React.useMemo(
    () => [
      {
        id: "Chat",
        label: "Chat",
        description: "General workspace assistant",
        assistantId: resolveAssistantId("Chat"),
      },
      {
        id: "Training",
        label: "Training",
        description: "Training module assistant",
        assistantId: resolveAssistantId("Training"),
      },
      {
        id: "Live Demo",
        label: "Live Demo",
        description: "Live demo assistant",
        assistantId: resolveAssistantId("Live Demo"),
      },
    ],
    [],
  );

  const selectedAssistantOption = React.useMemo(() => {
    if (!assistantSelectionKey) {
      return null;
    }
    const normalizedKey = assistantSelectionKey.toLowerCase();
    return (
      assistantQuickOptions.find(
        (option) => option.id.toLowerCase() === normalizedKey,
      ) ?? null
    );
  }, [assistantSelectionKey, assistantQuickOptions]);

  const resolvedAssistantId = React.useMemo(
    () =>
      selectedAssistantOption?.assistantId ??
      resolveAssistantId(activeTab) ??
      DEFAULT_ASSISTANT_ID,
    [selectedAssistantOption, activeTab],
  );
  const selectedAssistantKey = selectedAssistantOption?.id ?? null;
  const [resolvedGraphId, setResolvedGraphId] = React.useState(
    DEFAULT_ASSISTANT_ID,
  );
  const resolvedStreamModes = React.useMemo(() => {
    const comparisonKey = selectedAssistantKey ?? activeTab;
    return comparisonKey === "Training"
      ? TRAINING_STREAM_MODES
      : DEFAULT_STREAM_MODES;
  }, [selectedAssistantKey, activeTab]);

  const storeActiveRunMeta = React.useCallback(
    (runMeta) => {
      if (!runMeta || typeof runMeta !== "object" || !runMeta.run_id) {
        return;
      }

      const fallbackThreadId =
        typeof activeThreadId === "string" && activeThreadId.trim().length > 0
          ? activeThreadId
          : undefined;

      const normalizedMeta = {
        ...runMeta,
        thread_id: runMeta.thread_id ?? fallbackThreadId,
      };

      activeRunRef.current = normalizedMeta;

      if (
        normalizedMeta.thread_id &&
        typeof window !== "undefined" &&
        window.sessionStorage
      ) {
        try {
          window.sessionStorage.setItem(
            `lg:stream:${normalizedMeta.thread_id}`,
            normalizedMeta.run_id,
          );
        } catch (storageError) {
          console.warn("Unable to persist run metadata:", storageError);
        }
      }
    },
    [activeThreadId],
  );

  React.useEffect(() => {
    if (activeTab !== "Live Demo") {
      setLiveDemoSteps(LIVE_DEMO_STEPS);
    }
  }, [activeTab]);

  React.useEffect(() => {
    setAssistantSelectionKey((prev) => (prev ? null : prev));
  }, [activeTab]);

  React.useEffect(() => {
    let isMounted = true;

    const updateGraphId = async () => {
      try {
        const graphId =
          (await fetchgraphIdAccordingToCurrentModule()) ??
          DEFAULT_ASSISTANT_ID;
        if (isMounted) {
          setResolvedGraphId(graphId);
        }
      } catch (graphError) {
        console.warn("Unable to resolve graph id:", graphError);
        if (isMounted) {
          setResolvedGraphId(DEFAULT_ASSISTANT_ID);
        }
      }
    };

    updateGraphId();

    return () => {
      isMounted = false;
    };
  }, [activeTab, chatId]);

  const resetToolTracking = React.useCallback(() => {
    setToolOutputs([]);
    setSources([]);
    seenToolIdsRef.current.clear();
    toolChunkAccumulatorRef.current.clear();
    setToolScanVersion((prev) => prev + 1);
  }, []);

  const triggerThreadTransition = React.useCallback(() => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
    setIsThreadTransitioning(true);
    transitionTimeoutRef.current = setTimeout(() => {
      setIsThreadTransitioning(false);
      transitionTimeoutRef.current = null;
    }, 280);
  }, []);

  React.useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, activeTab]);

  React.useEffect(() => {
    const normalizedId =
      typeof chatId === "string" && chatId.trim().length > 0 ? chatId.trim() : null;

    if (normalizedId === activeThreadId) {
      return;
    }

    triggerThreadTransition();
    setActiveThreadId(normalizedId);
  }, [chatId, activeThreadId, triggerThreadTransition]);

  const handleThreadId = React.useCallback(
    (threadId) => {
      if (threadId !== activeThreadId) {
        triggerThreadTransition();
      }
      setActiveThreadId(threadId);
      setRefreshKey((prev) => prev + 1);
      if (typeof onNavigate === "function") {
        if (activeTab === "Chat") {
          onNavigate(`/chat/${threadId}`);
        } else if (activeTab === "Training") {
          onNavigate(`/training/${threadId}`);
        } else if (activeTab === "Live Demo") {
          onNavigate(`/livedemo/${threadId}`);
        }
      }
    },
    [onNavigate, activeTab, activeThreadId, triggerThreadTransition],
  );

  const upsertEntries = React.useCallback((setter) => {
    return (payload) => {
      const entries = Array.isArray(payload) ? payload : [payload];
      setter((prev) => {
        const next = [...prev];
        entries.forEach((entry) => {
          if (!entry || typeof entry !== "object") {
            return;
          }
          const key =
            entry.id ??
            entry.tool_call_id ??
            entry.toolName ??
            entry.name ??
            `event-${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const existingIndex = next.findIndex(
            (item) => (item.__key ?? item.id ?? item.tool_call_id) === key,
          );
          const normalized = { ...entry, __key: key };
          if (existingIndex >= 0) {
            next[existingIndex] = { ...next[existingIndex], ...normalized };
          } else {
            next.push(normalized);
          }
        });
        return next;
      });
    };
  }, []);

  const appendToolOutputs = React.useMemo(
    () => upsertEntries(setToolOutputs),
    [upsertEntries],
  );
  const appendSources = React.useMemo(
    () => upsertEntries(setSources),
    [upsertEntries],
  );

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("tas-theme", next);
      }
      return next;
    });
  }, []);

  const containerClassName = React.useMemo(
    () =>
      theme === "dark"
        ? "flex h-full min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-8 text-slate-100"
        : "flex h-full min-h-0 flex-1 overflow-hidden bg-gradient-to-br from-[var(--brand-lighter)] via-zinc-50 to-white px-6 py-8 text-zinc-700",
    [theme],
  );

  const handleCustomEvent = React.useCallback(
    (event) => {
      if (!event || typeof event !== "object") {
        return;
      }
      if (event.tool) {
        appendToolOutputs(event.tool);
      }
      if (event.source) {
        appendSources(event.source);
      }
    },
    [appendSources, appendToolOutputs],
  );

  const handleMetadataEvent = React.useCallback(
    (metadata) => {
      if (!metadata || typeof metadata !== "object") {
        return;
      }

      const directRunId =
        typeof metadata.run_id === "string" ? metadata.run_id : undefined;
      const nestedRunId =
        typeof metadata?.run?.run_id === "string"
          ? metadata.run.run_id
          : undefined;

      const resolvedRunMeta =
        directRunId || nestedRunId
          ? {
              run_id: directRunId ?? nestedRunId,
              thread_id:
                typeof metadata.thread_id === "string"
                  ? metadata.thread_id
                  : typeof metadata?.run?.thread_id === "string"
                    ? metadata.run.thread_id
                    : undefined,
            }
          : undefined;

      if (resolvedRunMeta) {
        storeActiveRunMeta(resolvedRunMeta);
      }

      const metadataEventType =
        typeof metadata.type === "string"
          ? metadata.type
          : typeof metadata.event === "string"
            ? metadata.event
            : undefined;

      if (
        metadataEventType === "response.failed" &&
        resolvedRunMeta &&
        typeof cancelActiveRunRef.current === "function"
      ) {
        void cancelActiveRunRef.current(resolvedRunMeta);
      }

      if (metadata.tool || metadata.tools) {
        appendToolOutputs(metadata.tool ?? metadata.tools);
      }
      if (metadata.source || metadata.sources) {
        appendSources(metadata.source ?? metadata.sources);
      }
    },
    [appendSources, appendToolOutputs, storeActiveRunMeta, cancelActiveRunRef],
  );

  const {
    client,
    messages: streamMessages,
    submit,
    isLoading,
    stop,
    values: streamValues,
  } = useStream({
    assistantId: resolvedAssistantId,
    graphId: resolvedGraphId,
    apiUrl: API_BASE_URL || undefined,
    threadId: activeThreadId,
    streamMode: resolvedStreamModes,
    onThreadId: handleThreadId,
    fetchStateHistory: true,
    reconnectOnMount: true,
    onCreated: (runMeta) => {
      console.log("Stream created with run metadata:", runMeta);
      storeActiveRunMeta(runMeta);
    },
    onFinish: (_state, runMeta) => {
      if (runMeta?.run_id && activeRunRef.current?.run_id === runMeta.run_id) {
        activeRunRef.current = null;
      }
      const threadForMeta =
        runMeta?.thread_id ??
        (typeof activeThreadId === "string" && activeThreadId.trim().length > 0
          ? activeThreadId
          : undefined);
      if (threadForMeta && typeof window !== "undefined") {
        try {
          window.sessionStorage?.removeItem(`lg:stream:${threadForMeta}`);
        } catch (storageError) {
          console.warn("Unable to clear run metadata after completion:", storageError);
        }
      }
    },
    onCustomEvent: (event) => {
      handleCustomEvent(event);
    },
    onMetadataEvent: (metadata) => {
      handleMetadataEvent(metadata);
    },
    onError: (streamError, runMeta) => {
      console.error("LangGraph stream error:", streamError);
      const cancelFn = cancelActiveRunRef.current;
      if (typeof cancelFn === "function") {
        void cancelFn(runMeta);
      }
    },
  });

  const cancelActiveRun = React.useCallback(
    async (runMeta) => {
      if (!client) {
        return;
      }

      const fallbackThreadId =
        typeof activeThreadId === "string" && activeThreadId.trim().length > 0
          ? activeThreadId
          : null;
      const effectiveMeta = runMeta ?? activeRunRef.current;
      const runThreadId = effectiveMeta?.thread_id ?? fallbackThreadId;
      if (!runThreadId) {
        return;
      }

      const storageKey = `lg:stream:${runThreadId}`;
      let runId = effectiveMeta?.run_id ?? null;

      if (!runId && typeof window !== "undefined") {
        try {
          runId = window.sessionStorage?.getItem(storageKey) ?? null;
        } catch (storageError) {
          console.warn("Unable to read run metadata from session storage:", storageError);
        }
      }

      if (!runId) {
        return;
      }

      const normalizedBaseUrl =
        typeof API_BASE_URL === "string" && API_BASE_URL.length > 0
          ? API_BASE_URL.endsWith("/")
            ? API_BASE_URL.slice(0, -1)
            : API_BASE_URL
          : null;

      try {
        if (normalizedBaseUrl) {
          const cancelUrl = `${normalizedBaseUrl}/threads/${encodeURIComponent(runThreadId)}/runs/${encodeURIComponent(runId)}/cancel?wait=0&action=cancel`;
          const response = await fetch(cancelUrl, { method: "POST" });
          if (!response.ok && response.status !== 404) {
            throw new Error(`Cancel request failed: ${response.status} ${response.statusText}`);
          }
        } else {
          await client.runs.cancel(runThreadId, runId);
        }
      } catch (cancelError) {
        console.warn("Unable to cancel active run:", cancelError);
      } finally {
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage?.removeItem(storageKey);
          } catch (storageError) {
            console.warn("Unable to clear run metadata after cancellation:", storageError);
          }
        }
        if (activeRunRef.current?.run_id === runId) {
          activeRunRef.current = null;
        }
      }
    },
    [client, activeThreadId],
  );

  cancelActiveRunRef.current = cancelActiveRun;

  const activeTabMessages = React.useMemo(() => {
    if (activeTab === "Chat" || activeTab === "Training" || activeTab === "Live Demo") {
      return streamMessages;
    }
    return [];
  }, [activeTab, streamMessages]);

  const normalizedMessages = React.useMemo(() => {
    const baseMessages = mapMessagesForDisplay(activeTabMessages, isLoading);
    console.log(streamValues , baseMessages);
    const modulePayload =
      streamValues && typeof streamValues === "object"
        ? streamValues.module ?? streamValues.modules ?? undefined
        : undefined;

    if (!modulePayload) {
      return baseMessages;
    }

    let moduleText;
    if (typeof modulePayload === "string") {
      moduleText = modulePayload;
    } else {
      try {
        moduleText = JSON.stringify(modulePayload, null, 2);
        if (moduleText && moduleText.trim().length > 0) {
          moduleText = `\`\`\`json\n${moduleText}\n\`\`\``;
        }
      } catch {
        moduleText = String(modulePayload);
      }
    }

    if (!moduleText || moduleText.trim().length === 0) {
      return baseMessages;
    }

    const alreadyPresent = baseMessages.some(
      (msg) =>
        msg?.__source === "values-module" ||
        (msg?.raw?.module && msg.text === moduleText),
    );

    if (alreadyPresent) {
      return baseMessages;
    }

    return [
      ...baseMessages,
      {
        id: "values-module",
        role: "assistant",
        text: moduleText,
        type: "module",
        raw: { module: modulePayload, generate_module: true },
        generate_module: true,
        __source: "values-module",
      },
    ];
  }, [activeTabMessages, isLoading, streamValues]);

  const hasUserMessages = React.useMemo(
    () => normalizedMessages.some((message) => message?.role === "user"),
    [normalizedMessages],
  );

  const shouldShowAssistantQuickOptions = React.useMemo(() => {
    if (activeThreadId) {
      return false;
    }
    if (hasUserMessages) {
      return false;
    }
    if (typeof input !== "string" || input.length === 0) {
      return false;
    }

    const normalizedInput = input.trimStart();
    if (normalizedInput.startsWith("/")) {
      return true;
    }

    const trimmedInput = input.trim();
    if (!trimmedInput) {
      return false;
    }

    return /\s\/$/.test(trimmedInput);
  }, [activeThreadId, hasUserMessages, input]);

  const { stage, stageProgress } = React.useMemo(
    () => resolveStageFromValues(streamValues),
    [streamValues],
  );

  React.useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [normalizedMessages]);

  const startNewChat = React.useCallback(() => {
    if (isLoading && typeof stop === "function") {
      stop().catch((stopError) => {
        console.warn("Unable to stop active stream before reset:", stopError);
      });
    }
    triggerThreadTransition();
    setActiveThreadId(null);
    setInput("");
    setSources([]);
    setRefreshKey((prev) => prev + 1);
    setAssistantSelectionKey(null);
    setResolvedGraphId(resolveAssistantId(activeTab) ?? DEFAULT_ASSISTANT_ID);
    resetToolTracking();
    if (typeof onNavigate === "function") {
      const basePath =
        activeTab === "Training"
          ? "/training"
          : activeTab === "Live Demo"
            ? "/livedemo"
            : "/chat";
      onNavigate(basePath);
    }
  }, [
    activeTab,
    isLoading,
    stop,
    resetToolTracking,
    onNavigate,
    triggerThreadTransition,
    setAssistantSelectionKey,
    setResolvedGraphId,
    resolveAssistantId,
  ]);

  React.useEffect(() => {
    if (
      toolOutputs.length > 0 &&
      previousToolCountRef.current === 0 &&
      isRightCollapsed
    ) {
      setIsRightCollapsed(false);
    }
    previousToolCountRef.current = toolOutputs.length;
  }, [toolOutputs.length, isRightCollapsed, setIsRightCollapsed]);

  React.useEffect(() => {
    if (activeThreadId) {
      sourcesCacheRef.current.set(activeThreadId, sources);
    }
  }, [sources, activeThreadId]);

  React.useEffect(() => {
    seenToolIdsRef.current.clear();
    toolChunkAccumulatorRef.current.clear();

    if (activeThreadId) {
      const cachedSources =
        sourcesCacheRef.current.get(activeThreadId) ?? [];

      setToolOutputs([]);
      setSources(Array.isArray(cachedSources) ? [...cachedSources] : []);
    } else {
      setToolOutputs([]);
      setSources([]);
    }

    setToolScanVersion((prev) => prev + 1);
  }, [activeThreadId]);

  React.useEffect(() => {
    if (isThreadTransitioning && normalizedMessages.length > 0) {
      setIsThreadTransitioning(false);
    }
  }, [isThreadTransitioning, normalizedMessages.length]);

  React.useEffect(() => () => {
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }
  }, []);

  React.useEffect(() => {
    if (!Array.isArray(streamMessages) || streamMessages.length === 0) {
      return;
    }

    const normalizeArgs = (args) => {
      if (args == null) {
        return "";
      }
      if (typeof args === "string") {
        return args;
      }
      if (typeof args === "object") {
        try {
          return JSON.stringify(args, null, 2);
        } catch (err) {
          return String(args);
        }
      }
      return String(args);
    };

    const processCall = (call, { isChunk = false } = {}) => {
      if (!call || typeof call !== "object") {
        return;
      }
      const callId =
        call.id ??
        call.tool_call_id ??
        call.call_id ??
        call.name ??
        `tool-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const title =
        call.name ??
        call.tool ??
        call.toolName ??
        call.type ??
        "Tool Call";
      let content = normalizeArgs(
        call.args ?? call.arguments ?? call.input ?? call.parameters,
      );

      if (isChunk) {
        const previous = toolChunkAccumulatorRef.current.get(callId) ?? "";
        const nextContent = previous + content;
        toolChunkAccumulatorRef.current.set(callId, nextContent);
        content = nextContent;
      } else {
        if (toolChunkAccumulatorRef.current.has(callId) && !content) {
          content = toolChunkAccumulatorRef.current.get(callId) ?? "";
        }
        if (seenToolIdsRef.current.has(callId)) {
          appendToolOutputs({
            id: callId,
            title,
            content,
            raw: call,
          });
          return;
        }
        seenToolIdsRef.current.add(callId);
      }

      appendToolOutputs({
        id: callId,
        title,
        content,
        raw: call,
      });
    };

    const processMessage = (message) => {
      if (!message || typeof message !== "object") {
        return;
      }
      const directToolCalls = [
        ...(Array.isArray(message.tool_calls) ? message.tool_calls : []),
        ...(Array.isArray(message.additional_kwargs?.tool_calls)
          ? message.additional_kwargs.tool_calls
          : []),
      ];
      directToolCalls.forEach((call) => processCall(call, { isChunk: false }));

      const chunkCalls = [
        ...(Array.isArray(message.tool_call_chunks)
          ? message.tool_call_chunks
          : []),
      ];
      chunkCalls.forEach((call) => processCall(call, { isChunk: true }));

      if (Array.isArray(message.content)) {
        message.content.forEach((block) => {
          if (!block || typeof block !== "object") {
            return;
          }
          if (
            block.type === "tool_use" ||
            block.type === "tool_call" ||
            block.type === "tool"
          ) {
            processCall(
              {
                id: block.id ?? block.tool_call_id,
                name: block.name ?? block.tool,
                args: block.input ?? block.arguments ?? block.args,
                type: block.type,
              },
              { isChunk: false },
            );
          }
        });
      }
    };

    streamMessages.forEach(processMessage);
  }, [streamMessages, appendToolOutputs, toolScanVersion]);

  const handleSend = React.useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !resolvedAssistantId) {
      return;
    }

    const isExistingThread = Boolean(activeThreadId);

    setInput("");
    setSources([]);
    setToolOutputs([]);
    try {
      await submit(
        {
          messages: [
            {
              role: "user",
              content: trimmed,
            },
          ],
        },
        {
          metadata: isExistingThread
            ? undefined
            : { thread_name: trimmed, graph_id: resolvedGraphId },
          streamMode: resolvedStreamModes,
          streamResumable: true,
          streamSubgraphs: true,
          threadId: activeThreadId ?? undefined,
          config : {}
        },
      );
      setRefreshKey((prev) => prev + 1);
    } catch (submitError) {
      console.error("Failed to submit message:", submitError);
      setInput(trimmed);
    }
  }, [
    input,
    isLoading,
    submit,
    activeThreadId,
    resolvedAssistantId,
    resolvedGraphId,
    resolvedStreamModes,
  ]);

  const handleCopy = React.useCallback((idx) => {
    const node = document.getElementById(`canvas_${idx}`);
    const text = node?.innerText ?? "";
    if (!text) {
      return;
    }
    navigator.clipboard.writeText(text).catch((err) => {
      console.error("Unable to copy message:", err);
    });
  }, []);

  const handleDownload = React.useCallback((idx) => {
    const node = document.getElementById(`canvas_${idx}`);
    const text = node?.innerText ?? "";
    if (!text) {
      return;
    }

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "analysis.txt";
    anchor.click();

    URL.revokeObjectURL(url);
  }, []);

  const toggleLeftCollapse = React.useCallback(
    () => setIsLeftCollapsed((prev) => !prev),
    [],
  );

  const handleStop = React.useCallback(() => {
    if (!isLoading) {
      return;
    }
    if (typeof stop === "function") {
      stop().catch((stopError) => {
        console.warn("Unable to stop active stream:", stopError);
      });
    }
    void cancelActiveRun();
  }, [isLoading, stop, cancelActiveRun]);

  const toggleRightCollapse = React.useCallback(
    () => setIsRightCollapsed((prev) => !prev),
    [],
  );

  const selectedChatId = activeThreadId;
  const handleTabNavigate = React.useCallback(
    (nextTab) => {
      const currentPath = window.location.pathname ?? "/chat";
      const [, segment = "chat"] = currentPath.split("/");
      if (typeof onNavigate !== "function") {
        return;
      }
      if (["Training"].includes(nextTab)) {
        setRefreshKey((prev) => prev + 1);
        onNavigate("/training");
        return;
      }
      if (nextTab === "Live Demo") {
        setRefreshKey((prev) => prev + 1);
        onNavigate("/livedemo");
        return;
      }
      // if (selectedChatId) {
      //   setRefreshKey((prev) => prev + 1);
      //   onNavigate(`/${segment}/${selectedChatId}`);
      //   return;
      // }
      onNavigate("/chat");
      setRefreshKey((prev) => prev + 1);
    },
    [onNavigate, selectedChatId],
  );

  const handleAssistantQuickOptionSelect = React.useCallback(
    (optionId) => {
      if (isLoading) {
        return;
      }
      if (typeof optionId !== "string") {
        return;
      }
      const normalizedKey = optionId.trim();
      if (!normalizedKey) {
        return;
      }

      const selection =
        assistantQuickOptions.find(
          (option) => option.id.toLowerCase() === normalizedKey.toLowerCase(),
        ) ?? null;

      setAssistantSelectionKey(selection?.id ?? null);
      setInput("");
      resetToolTracking();
      setActiveThreadId(null);
      if (selection?.assistantId) {
        setResolvedGraphId(selection.assistantId);
      } else {
        setResolvedGraphId(resolveAssistantId(activeTab) ?? DEFAULT_ASSISTANT_ID);
      }
    },
    [
      activeTab,
      assistantQuickOptions,
      isLoading,
      resetToolTracking,
      setAssistantSelectionKey,
      setActiveThreadId,
      setInput,
      setResolvedGraphId,
      resolveAssistantId,
    ],
  );

  return (
    <div className={containerClassName}>
      <div className="flex h-full w-full min-h-0 max-w-8xl flex-col gap-4">
        <TopHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isLoading={isLoading}
          setInput={setInput}
          onResetToolOutputs={resetToolTracking}
          setActiveThreadId={setActiveThreadId}
          onTabNavigate={handleTabNavigate}
          theme={theme}
        />

        <div className="flex min-h-0 flex-1 gap-3 overflow-hidden">
          <LeftSidebar
            activeTab={activeTab}
            theme={theme}
            isCollapsed={isLeftCollapsed}
            isLoading={isLoading}
            onNavigate={onNavigate}
            onStartNewChat={startNewChat}
            onToggleTheme={toggleTheme}
            onToggleCollapse={toggleLeftCollapse}
            refreshKey={refreshKey}
            selectedChatId={selectedChatId}
          />

          <ChatSection
            activeTab={activeTab}
            theme={theme}
            chatBodyRef={chatBodyRef}
            input={input}
            isLoading={isLoading}
            messages={normalizedMessages}
            onCopy={handleCopy}
            onDownload={handleDownload}
            onInputChange={setInput}
            onSend={handleSend}
            onStop={handleStop}
            onLiveDemoStepsChange={setLiveDemoSteps}
            stage={stage}
            stageProgress={stageProgress ?? 0}
            isTransitioning={isThreadTransitioning}
            showAssistantOptions={shouldShowAssistantQuickOptions}
            assistantOptions={assistantQuickOptions}
            selectedAssistantId={selectedAssistantKey}
            onAssistantOptionSelect={handleAssistantQuickOptionSelect}
          />

          <RightSidebar
            isCollapsed={isRightCollapsed}
            theme={theme}
            liveDemoSteps={liveDemoSteps}
            onToggleCollapse={toggleRightCollapse}
            showDemoSteps={activeTab === "Live Demo"}
            toolOutputs={toolOutputs}
            sources={sources}
            isTransitioning={isThreadTransitioning}
          />
        </div>
      </div>
    </div>
  );
}
