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
  const shouldRender = showDemoSteps || hasToolOutputs || hasSources;

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={`relative flex h-full transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      <aside
        className={`flex h-full w-full flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950/70 shadow-[0_12px_30px_rgba(8,47,73,0.25)] backdrop-blur transition-all duration-300 ease-in-out ${
          isCollapsed
            ? "pointer-events-none scale-95 opacity-0 p-0"
            : `scale-100 p-5 ${isTransitioning ? "opacity-60 blur-[0.2px]" : "opacity-100"}`
        }`}
        aria-hidden={isCollapsed}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">
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
                className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-300 shadow-inner shadow-slate-950/40"
              >
                <span className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-[11px] font-semibold text-sky-200">
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
                  className={`rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-300 shadow-inner shadow-slate-950/40 transition-all duration-300 ease-out ${isNew ? "fade-slide-in" : ""}`}
                >
                  <div className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                    {tool.title}
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-slate-200 whitespace-pre-wrap">
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
                className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-slate-300 shadow-inner shadow-slate-950/40"
              >
                <span>{resolveSourceTitle(source, index)}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  #{index + 1}
                </span>
              </div>
            ))}
          </div>
        )}
      </aside>

      <button
        onClick={onToggleCollapse}
        className={`absolute top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition duration-300 ease-in-out hover:border-sky-500/60 hover:text-sky-200 ${
          isCollapsed ? "left-3" : "-left-4"
        }`}
        aria-label={isCollapsed ? "Expand right panel" : "Collapse right panel"}
      >
        {isCollapsed ? <IoChevronBack size={14} /> : <IoChevronForward size={14} />}
      </button>
    </div>
  );
}
