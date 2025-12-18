import React from "react";
import ReactMarkdown from "react-markdown";
import {
  IoSend,
  IoCopyOutline,
  IoDownloadOutline,
  IoCheckmark,
  IoCreateOutline,
  IoArrowDownCircleOutline,
  IoStopCircleOutline,
} from "react-icons/io5";
import { FileText } from "lucide-react";

const TEXTUAL_CONTENT_TYPES = new Set([
  "text",
  "output_text",
  "ai",
  "assistant",
  "response",
  "module",
]);

const DEFAULT_LIVE_DEMO_STEPS = [
  "Preparing environment",
  "Launching preview",
  "Streaming workflow",
  "Summarising next steps",
];

const resolveRole = (message) => {
  if (!message) {
    return "assistant";
  }
  if (message.role) {
    return message.role;
  }
  if (message.type === "human" || message.type === "user") {
    return "user";
  }
  if (message.type === "system") {
    return "system";
  }
  if (message.type === "tool" || message.type === "tool_message") {
    return "tool";
  }
  return "assistant";
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

const resolveMessageText = (message) => {
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
    message.modules,
    message.raw?.module,
    message.raw?.module_output,
    message.raw?.moduleResult,
    message.raw?.modules,
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

  if (segments.length === 0) {
    const fallbackModule = moduleCandidates.find(Boolean);
    if (fallbackModule) {
      try {
        pushSegment(
          `\`\`\`json\n${JSON.stringify(fallbackModule, null, 2)}\n\`\`\``,
        );
      } catch (err) {
        pushSegment(String(fallbackModule));
      }
    }
  }

  return segments.join("\n\n");
};

export default function ChatSection({
  activeTab,
  chatBodyRef,
  copyClicked,
  input,
  isLoading,
  messages,
  stage,
  stageProgress,
  onCopy,
  onDownload,
  onInputChange,
  onSend,
  onStop,
  onLiveDemoStepsChange,
  isTransitioning = false,
}) {
  const [stageHistory, setStageHistory] = React.useState([]);
  const prevStageRef = React.useRef();
  const [isAtBottom, setIsAtBottom] = React.useState(true);
  const [copiedMessageKey, setCopiedMessageKey] = React.useState(null);
  const copyTimeoutRef = React.useRef();
  const isLiveDemo = activeTab === "Live Demo";

  const markdownComponents = React.useMemo(
    () => ({
      a: ({ node, ...props }) => (
        <a
          {...props}
          className="font-semibold text-[var(--brand)] underline decoration-[var(--brand)] decoration-2 underline-offset-2"
          target="_blank"
          rel="noreferrer"
        />
      ),
      code({
        node,
        inline,
        className,
        children,
        ...props
      }) {
        if (inline) {
          return (
            <code
              className={`rounded bg-black/10 px-1 py-[0.1rem] font-mono text-[0.9em] ${className ?? ""}`}
              {...props}
            >
              {children}
            </code>
          );
        }
        return (
          <pre className="overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-950/95 p-3 text-zinc-100 shadow-inner">
            <code className="font-mono text-[0.9em]" {...props}>
              {children}
            </code>
          </pre>
        );
      },
      ul: ({ node, ...props }) => (
        <ul className="ml-4 list-disc" {...props} />
      ),
      ol: ({ node, ...props }) => (
        <ol className="ml-4 list-decimal" {...props} />
      ),
      h1: ({ node, ...props }) => (
        <h1 className="text-lg font-bold text-zinc-800" {...props} />
      ),
      h2: ({ node, ...props }) => (
        <h2 className="text-base font-bold text-zinc-800" {...props} />
      ),
      h3: ({ node, ...props }) => (
        <h3 className="text-sm font-semibold text-zinc-800" {...props} />
      ),
      blockquote: ({ node, ...props }) => (
        <blockquote
          className="border-l-4 border-zinc-200 pl-3 italic text-inherit"
          {...props}
        />
      ),
    }),
    [],
  );

  const scrollToBottom = React.useCallback(() => {
    const container = chatBodyRef?.current;
    if (!container) {
      return;
    }
    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [chatBodyRef]);

  const handleSend = () => {
    if (!isLoading) {
      onSend();
    }
  };

  const handleStop = React.useCallback(() => {
    if (typeof onStop === "function") {
      onStop();
    }
  }, [onStop]);

  const handleCopyMessage = React.useCallback((text, key) => {
    if (!text) {
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedMessageKey(key);
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopiedMessageKey(null);
          copyTimeoutRef.current = null;
        }, 5000);
      })
      .catch((err) => {
        console.error("Failed to copy message:", err);
      });
  }, []);

  const handleCanvasCopy = React.useCallback(
    (index) => {
      if (typeof onCopy !== "function") {
        return;
      }
      onCopy(index);
      setCopiedMessageKey(`canvas-${index}`);
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedMessageKey(null);
        copyTimeoutRef.current = null;
      }, 5000);
    },
    [onCopy],
  );

  React.useEffect(() => {
    if (isTransitioning) {
      setStageHistory([]);
      prevStageRef.current = undefined;
      scrollToBottom();
    }
  }, [isTransitioning, scrollToBottom]);

  React.useEffect(() => {
    if (!stage || stage.trim().length === 0) {
      return;
    }
    const normalizedStage = stage.trim();
    setStageHistory((prev) => {
      if (prev.length > 0 && prev[prev.length - 1] === normalizedStage) {
        return prev;
      }
      if (prev.includes(normalizedStage)) {
        return prev;
      }
      return [...prev, normalizedStage];
    });
    prevStageRef.current = normalizedStage;
  }, [stage]);

  const normalizedStageProgress = React.useMemo(() => {
    if (typeof stageProgress === "number" && Number.isFinite(stageProgress)) {
      return Math.min(Math.max(stageProgress, 0), 100);
    }
    if (stageHistory.length === 0) {
      return 0;
    }
    const fallbackProgress =
      (stageHistory.length - 1) / Math.max(stageHistory.length, 1);
    return Math.round(fallbackProgress * 100);
  }, [stageProgress, stageHistory.length]);

  const displayedMessages = React.useMemo(() => {
    const baseMessages = Array.isArray(messages)
      ? messages
          .map((msg) => {
            if (!msg) {
              return null;
            }
            const role = resolveRole(msg);
            const msgType = msg.type ?? msg.role;
            const text = resolveMessageText(msg);
            if (msgType === "tool" || msgType === "tool_calls") {
              return null;
            }
            if (
              text.trim().toLowerCase() === "tool_calls" ||
              (role !== "user" && !text.trim())
            ) {
              return null;
            }
            return { ...msg, role, text };
          })
          .filter(Boolean)
      : [];

    return baseMessages;
  }, [messages]);

  const latestDemoMessage = React.useMemo(() => {
    if (!isLiveDemo) {
      return undefined;
    }
    const candidates = Array.isArray(displayedMessages)
      ? [...displayedMessages].reverse()
      : [];
    return candidates.find(
      (msg) =>
        msg?.metadata?.demo_video_url ||
        msg?.raw?.metadata?.demo_video_url,
    );
  }, [displayedMessages, isLiveDemo]);

  const liveDemoVideoUrl =
    latestDemoMessage?.metadata?.demo_video_url ??
    latestDemoMessage?.raw?.metadata?.demo_video_url ??
    "https://videos.pexels.com/video-files/6536658/6536658-uhd_2560_1440_25fps.mp4";

  const liveDemoSteps = React.useMemo(() => {
    if (stageHistory.length > 0) {
      return stageHistory;
    }
    return DEFAULT_LIVE_DEMO_STEPS;
  }, [stageHistory]);

  React.useEffect(() => {
    if (typeof onLiveDemoStepsChange !== "function") {
      return;
    }
    if (isLiveDemo) {
      onLiveDemoStepsChange(liveDemoSteps);
    } else {
      onLiveDemoStepsChange([]);
    }
  }, [isLiveDemo, liveDemoSteps, onLiveDemoStepsChange]);

  React.useEffect(() => {
    const container = chatBodyRef?.current;
    if (!container) {
      return;
    }

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - clientHeight - scrollTop;
      setIsAtBottom(distanceFromBottom < 40);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => container.removeEventListener("scroll", handleScroll);
  }, [chatBodyRef]);

  React.useEffect(() => {
    const container = chatBodyRef?.current;
    if (!container) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = container;
    const nearBottom = scrollHeight - clientHeight - scrollTop < 80;
    if (nearBottom) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  React.useEffect(
    () => () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    },
    [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-[0_22px_48px_rgba(17,17,17,0.08)] backdrop-blur-md">
        <div
          ref={chatBodyRef}
          className={`flex-1 space-y-2 overflow-y-auto px-4 py-4 text-[11px] text-zinc-500 transition-all duration-300 ease-out ${isTransitioning ? "opacity-60 blur-[0.3px]" : "opacity-100"} min-h-0`}
        >
          {false ? (
            <div className="relative min-h-[22rem] overflow-hidden rounded-3xl border border-zinc-200 bg-black shadow-[0_18px_40px_rgba(17,17,17,0.16)]">
              <video
                key={liveDemoVideoUrl}
                src={liveDemoVideoUrl}
                autoPlay
                loop
                muted
                controls
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between rounded-2xl bg-black/60 px-4 py-3 text-[12px] text-white backdrop-blur">
                <span className="font-semibold uppercase tracking-[0.24em]">Live Demo</span>
                <span className="text-[11px] font-medium text-lime-300">Running</span>
              </div>
            </div>
          ) : (
            <>
              {displayedMessages.length === 0 && (
                <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-6 text-center text-[11px] text-zinc-500">
                  Start by asking a question or switch modules to explore different stages of your flow.
                </div>
              )}

              {displayedMessages.map((msg, idx) => {
                const isUser = msg.role === "user";
                const isStreaming = Boolean(msg.isStreaming);
                const moduleCandidates = [
                  msg.module,
                  msg.module_output,
                  msg.moduleOutput,
                  msg.moduleResult,
                  msg.modules,
                  msg.raw?.module,
                  msg.raw?.module_output,
                  msg.raw?.moduleResult,
                  msg.raw?.modules,
                ];
                const hasModuleData = moduleCandidates.some((candidate) => {
                  if (!candidate) {
                    return false;
                  }
                  if (typeof candidate === "string") {
                    return candidate.trim().length > 0;
                  }
                  if (Array.isArray(candidate)) {
                    return candidate.length > 0;
                  }
                  if (typeof candidate === "object") {
                    return Object.keys(candidate).length > 0;
                  }
                  return true;
                });
                const forceModuleCanvas = Boolean(
                  msg.generate_module ??
                    msg.metadata?.generate_module ??
                    msg.raw?.generate_module ??
                    msg.raw?.metadata?.generate_module,
                );
                const showModuleCanvas =
                  !isUser && (hasModuleData || forceModuleCanvas);
                const messageText =
                  typeof msg.text === "string" ? msg.text : "";
                const hasText = messageText.trim().length > 0;
                const messageKey =
                  typeof msg.id === "string" || typeof msg.id === "number"
                    ? msg.id
                    : `${msg.role ?? "message"}-${idx}`;

                if (showModuleCanvas) {
                  return (
                    <div style={{display : 'flex', justifyContent : 'center'}}
                      key={idx}
                    >
                      <div
                        id={`canvas_${idx}`} style={{width : '700px'}}
                        className="relative max-h-[400px] overflow-auto rounded-xl bg-zinc-50 z px-4 py-4 text-[11.5px] leading-relaxed text-zinc-600 shadow-[inset_0_2px_12px_rgba(242,60,57,0.12)]"
                      >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(242,60,57,0.12),transparent_60%)]" />
                        <div className="sticky top-0 z-20 ml-auto flex w-fit justify-end gap-2">
                          <button
                            onClick={() => handleCanvasCopy(idx)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]"
                            title="Copy to clipboard"
                            aria-label="Copy"
                          >
                            {copyClicked === idx || copiedMessageKey === `canvas-${idx}` ? (
                              <IoCheckmark size={15} />
                            ) : (
                              <IoCopyOutline size={15} />
                            )}
                          </button>
                          <button
                            onClick={() => onDownload(idx)}
                            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]"
                            title="Download"
                            aria-label="Download"
                          >
                            <IoDownloadOutline size={15} />
                          </button>
                        </div>
                        <ReactMarkdown
                          className="relative z-10 space-y-1 break-words"
                          components={markdownComponents}
                        >
                          {messageText || ""}
                        </ReactMarkdown>
                      </div>
                    </div>
                  );
                }

                const bubbleBase =
                  "max-w-[100%] whitespace-pre-wrap text-[12.5px] leading-sung pt-3 pb-3";
                const bubbleClass = `rounded-xl border border-zinc-200 px-3 py-2 ${
                  isUser
                    ? "bg-[var(--brand-lighter)] text-[var(--brand-dark)] font-medium"
                    : "bg-white text-zinc-700"
                }`;
                const alignmentClass = isUser ? "justify-end" : "justify-start";
                const canEdit = isUser && hasText;

                return (
                  <div
                    key={messageKey}
                    className={`flex w-full ${alignmentClass}`}
                  >
                    <div
                      className={`group flex max-w-[80%] flex-col gap-1 ${isUser ? "items-start" : "items-end"}`}
                    >
                      <div className={`relative ${bubbleBase} ${bubbleClass} text-[11.5px]`}>
                        <div className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 flex gap-2 opacity-0 transition group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(messageText, messageKey)}
                            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-500 shadow-sm transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]"
                            aria-label="Copy message"
                            title="Copy message"
                          >
                            {copiedMessageKey === messageKey ? (
                              <IoCheckmark size={12} />
                            ) : (
                              <IoCopyOutline size={12} />
                            )}
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => onInputChange(messageText)}
                              className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white/95 text-zinc-500 shadow-sm transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]"
                              aria-label="Edit message"
                              title="Edit message"
                              disabled={isLoading}
                            >
                              <IoCreateOutline size={12} />
                            </button>
                          )}
                        </div>
                        <ReactMarkdown
                          className="markdown-body space-y-2 break-words"
                          components={markdownComponents}
                        >
                          {messageText || ""}
                        </ReactMarkdown>
                        {isStreaming && (
                          <span className="ml-2 inline-block animate-pulse text-[rgba(242,60,57,0.6)]">...</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex w-full justify-start">
                  <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[11.5px] text-zinc-600 shadow-lg shadow-[0_16px_32px_rgba(242,60,57,0.14)]">
                    <span className="h-2 w-2 animate-ping rounded-full bg-[var(--brand)]" />
                    <span className="animate-pulse">Thinking???</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        {!isAtBottom && (
          <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 transform">
            <button
              type="button"
              onClick={scrollToBottom}
              className="pointer-events-auto flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] text-zinc-600 shadow-lg shadow-[0_16px_32px_rgba(242,60,57,0.14)] transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]"
            >
              <IoArrowDownCircleOutline size={16} />
              <span>Jump to latest</span>
            </button>
          </div>
        )}

        {(stageHistory.length > 0 || stage) && (
          <div className="border-t border-zinc-200 bg-zinc-50/80 px-6 py-3">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              <span>{stageHistory[stageHistory.length - 1] ?? stage ?? "Progress"}</span>
              <span>{normalizedStageProgress}%</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] transition-all duration-500"
                style={{ width: `${normalizedStageProgress}%` }}
              />
            </div>
            {stageHistory.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                {stageHistory.map((label, index) => {
                  const isCompleted = index < stageHistory.length - 1;
                  const isCurrent = index === stageHistory.length - 1;
                  const baseBadge =
                    "flex items-center gap-1 rounded-full border px-2 py-1 transition-all duration-300";
                  const stateClass = isCompleted
                    ? "border-[var(--brand-light)] bg-[var(--brand-lighter)] text-[var(--brand-dark)]"
                    : isCurrent
                      ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-dark)] shadow-[0_12px_24px_rgba(242,60,57,0.18)]"
                      : "border-zinc-200 bg-white text-zinc-400";
                  return (
                    <span key={`${label}-${index}`} className={`${baseBadge} ${stateClass}`}>
                      {isCompleted && <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />}
                      {isCurrent && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--brand)]" />}
                      <span>{label}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-zinc-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <input
              value={input}
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) =>
                event.key === "Enter" && !isLoading && handleSend()
              }
              disabled={isLoading}
              placeholder={`Ask something in ${activeTab}...`}
              className={`flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-[12px] text-zinc-700 shadow-[0_8px_32px_rgba(15,23,42,0.08)] transition placeholder:text-zinc-400 focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-light)] hover:border-[var(--brand-light)] hover:shadow-[0_12px_36px_rgba(242,60,57,0.12)] ${isLoading ? "cursor-not-allowed opacity-60" : ""
                }`}
            />

            {isLoading ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 via-red-500 to-red-600 text-white shadow-lg shadow-[0_18px_32px_rgba(220,38,38,0.3)] transition hover:scale-[1.02] hover:shadow-[0_22px_44px_rgba(220,38,38,0.35)]"
                aria-label="Stop response"
              >
                <IoStopCircleOutline size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] text-white shadow-lg shadow-[0_18px_32px_rgba(242,60,57,0.3)] transition hover:scale-[1.02] hover:shadow-[0_22px_44px_rgba(242,60,57,0.4)]"
                aria-label="Send"
              >
                <IoSend size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
