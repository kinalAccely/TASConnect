import React from "react";
import { IoChevronBack, IoChevronForward } from "react-icons/io5";
import { FileText } from "lucide-react";

const resolveToolTitle = (tool, fallbackIndex) => {
  if (!tool || typeof tool !== "object") {
    return `Tool #${fallbackIndex + 1}`;
  }
  return (
    tool.title ??
    tool.name ??
    tool.toolName ??
    tool.tool_id ??
    `Tool #${fallbackIndex + 1}`
  );
};

const resolveToolBody = (tool) => {
  if (!tool || typeof tool !== "object") {
    return "";
  }
  if (typeof tool.content === "string") {
    return tool.content;
  }
  if (Array.isArray(tool.content)) {
    return tool.content.filter(Boolean).join("\n");
  }
  if (Array.isArray(tool.tokens)) {
    return tool.tokens.filter(Boolean).join("");
  }
  if (typeof tool.output === "string") {
    return tool.output;
  }
  if (typeof tool.result === "string") {
    return tool.result;
  }
  if (typeof tool.message === "string") {
    return tool.message;
  }
  return JSON.stringify(tool, null, 2);
};

const sanitizeBody = (body) => {
  if (typeof body !== "string") {
    return "";
  }
  const trimmed = body.trim();
  if (!trimmed) {
    return "";
  }
  const braceCollapsed = trimmed.replace(/\s+/g, "");
  if (/^(?:\{\})+$/.test(braceCollapsed)) {
    return "";
  }
  return body;
};

const resolveSourceTitle = (source, index) => {
  if (!source || typeof source !== "object") {
    return `Source #${index + 1}`;
  }
  return source.title ?? source.name ?? source.id ?? `Source #${index + 1}`;
};

export default function RightSidebar({
  isCollapsed,
  liveDemoSteps,
  onToggleCollapse,
  showDemoSteps,
  sources,
  toolOutputs = [],
  isTransitioning = false,
}) {
  const prevToolKeysRef = React.useRef(new Set());
  const [recentToolKeys, setRecentToolKeys] = React.useState([]);

  React.useEffect(() => {
    const currentKeys = Array.isArray(toolOutputs)
      ? toolOutputs
          .map((tool, index) => tool?.__key ?? tool?.id ?? `tool-${index}`)
          .filter(Boolean)
      : [];

    const prevKeys = prevToolKeysRef.current;
    const addedKeys = currentKeys.filter((key) => !prevKeys.has(key));
    prevToolKeysRef.current = new Set(currentKeys);

    if (addedKeys.length > 0) {
      setRecentToolKeys(addedKeys);
      const timer = setTimeout(() => {
        setRecentToolKeys([]);
      }, 350);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [toolOutputs]);

  const toolCards = React.useMemo(() => {
    if (!Array.isArray(toolOutputs)) {
      return [];
    }
    return toolOutputs.reduce((acc, tool, index) => {
      const key = tool?.__key ?? tool?.id ?? `tool-${index}`;
      const title = resolveToolTitle(tool, index);
      const body = sanitizeBody(resolveToolBody(tool));
      if (!body) {
        return acc;
      }
      acc.push({
        key,
        title,
        body,
      });
      return acc;
    }, []);
  }, [toolOutputs]);

  const hasToolOutputs = toolCards.length > 0;
  const hasSources = Array.isArray(sources) && sources.length > 0;
  const demoStepCount = Array.isArray(liveDemoSteps) ? liveDemoSteps.length : 0;
  const sourceCount = hasSources ? sources.length : 0;
  const summaryLabel = showDemoSteps
    ? "Streaming Steps"
    : hasToolOutputs
      ? "Outputs"
      : hasSources
        ? "Sources"
        : "Empty";
  const summaryCount = showDemoSteps
    ? demoStepCount
    : hasToolOutputs
      ? toolCards.length
      : hasSources
        ? sourceCount
        : 0;
  const shouldRender = showDemoSteps || hasToolOutputs || hasSources;

  if (!shouldRender) {
    return null;
  }

  const collapsedContent = (
    <div className="flex h-full w-full flex-col items-center justify-between py-4">
      <div className="flex flex-col items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.32em] text-zinc-400">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-500 shadow-[0_6px_16px_rgba(15,23,42,0.12)]">
          <FileText size={16} />
        </span>
        <span>{summaryLabel}</span>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-2xl font-semibold text-zinc-800">{summaryCount}</span>
        <span className="text-[9px] uppercase tracking-[0.28em] text-zinc-400">
          {summaryLabel === "Streaming Steps" ? "Total" : "Items"}
        </span>
      </div>
    </div>
  );

  const expandedContent = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-zinc-500">
          {showDemoSteps ? (
            <>
              <FileText size={14} /> Streaming Steps
            </>
          ) : hasToolOutputs ? (
            <>
              <FileText size={14} /> Tool Output
            </>
          ) : (
            <>
              <FileText size={14} /> Sources
            </>
          )}
        </h2>
      </div>

      {showDemoSteps ? (
        <div className="mt-2 flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1 text-[12px]">
          {liveDemoSteps.map((step, index) => (
            <div
              key={step}
              className="flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 shadow-inner shadow-orange-100/40"
            >
              <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-semibold text-orange-600">
                {index + 1}
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      ) : hasToolOutputs ? (
        <div className="mt-2 flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1 text-[11px]">
          {toolCards.map((tool) => {
            const isNew = recentToolKeys.includes(tool.key);
            return (
              <div
                key={tool.key}
                className={`rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 shadow-inner shadow-orange-100/30 transition-all duration-300 ease-out ${isNew ? "fade-slide-in" : ""}`}
              >
                <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                  {tool.title}
                </div>
                <div className="mt-1 font-mono text-[11px] text-zinc-600 whitespace-pre-wrap">
                  {tool.body}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-2 flex max-h-[52vh] flex-col gap-2 overflow-y-auto pr-1 text-[11px]">
          {sources.map((source, index) => (
            <div
              key={source?.__key ?? source?.id ?? `${index}`}
              className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-zinc-600 shadow-inner shadow-orange-100/30"
            >
              <span>{resolveSourceTitle(source, index)}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                #{index + 1}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      className={`relative flex h-full transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      <aside
        className={`flex h-full w-full flex-col gap-4 rounded-3xl border border-zinc-200 bg-white/85 shadow-[0_16px_40px_rgba(17,17,17,0.08)] backdrop-blur-md transition-all duration-300 ease-in-out ${
          isCollapsed
            ? `items-center gap-3 px-2 py-4 ${isTransitioning ? "opacity-70 blur-[0.2px]" : "opacity-95"}`
            : `gap-4 p-5 ${isTransitioning ? "opacity-60 blur-[0.2px]" : "opacity-100"}`
        }`}
      >
        {isCollapsed ? collapsedContent : expandedContent}
      </aside>

      <button
        onClick={onToggleCollapse}
        className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition duration-300 ease-in-out hover:border-orange-300 hover:text-orange-500 ${
          isCollapsed ? "top-1/2 left-[-18px] -translate-y-1/2" : "top-4 -left-4"
        }`}
        aria-label={isCollapsed ? "Expand right panel" : "Collapse right panel"}
      >
        {isCollapsed ? <IoChevronBack size={14} /> : <IoChevronForward size={14} />}
      </button>
    </div>
  );
}
