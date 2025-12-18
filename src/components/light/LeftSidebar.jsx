import React, { useEffect, useMemo, useState } from "react";
import { IoAdd, IoChevronBack, IoChevronForward, IoMoon, IoSunny } from "react-icons/io5";
import { fetchgraphIdAccordingToCurrentModule, fetchThreads } from "../../services/threadService.js";

const resolveThreadId = (thread) => {
  if (!thread || typeof thread !== "object") {
    return null;
  }
  return (
    thread.id ??
    thread.thread_id ??
    thread?.metadata?.id ??
    thread?.metadata?.thread_id ??
    null
  );
};

const resolveThreadLabel = (thread) => {
  if (!thread || typeof thread !== "object") {
    return "Untitled Thread";
  }
  return (
    thread.name ??
    thread.title ??
    thread?.metadata?.thread_name ??
    thread?.metadata?.name ??
    "Untitled Thread"
  );
};

export default function LeftSidebar({
  activeTab,
  chatHistory,
  isCollapsed,
  isLoading,
  theme = "light",
  onNavigate,
  onStartNewChat,
  onToggleTheme,
  onToggleCollapse,
  refreshKey,
  selectedChatId,
}) {
  const [threads, setThreads] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  let normalizedSelectedId =
    selectedChatId !== undefined && selectedChatId !== null
      ? String(selectedChatId)
      : null;
  let pathName = window.location.pathname;

  useEffect(() => {
    let isMounted = true;
    setCurrentId(window.location.pathname.split("/").pop());
    fetchThreads()
      .then(async (data) => {
        if (!isMounted) {
          return;
        }

        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.threads)
            ? data.threads
            : [];

        let historyRecords = [];
        let currentGraphId = await fetchgraphIdAccordingToCurrentModule();
        for (let i = 0; i < normalized.length; i++) {
          if (normalized[i].metadata.graph_id == currentGraphId) {
            historyRecords.push(normalized[i]);
          }
        }
        setThreads(historyRecords);
      })
      .catch((error) => {
        console.error("Failed to fetch threads for sidebar:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    normalizedSelectedId = selectedChatId;
  }, [selectedChatId]);

  const historyItems = useMemo(() => chatHistory?.[activeTab] ?? [], [chatHistory, activeTab]);
  const showThreads = true;
  const hasThreads = showThreads && threads.length > 0;
  const itemsToRender = hasThreads ? threads : historyItems;
  const isDarkTheme = theme === "dark";

  const handleToggleTheme = () => {
    if (typeof onToggleTheme === "function") {
      onToggleTheme();
    }
  };

  const expandedThemeToggle = onToggleTheme ? (
    <button
      type="button"
      onClick={handleToggleTheme}
      className="group inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500 transition hover:border-[var(--brand-light)] hover:text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)]"
      aria-pressed={isDarkTheme}
    >
      <span className="flex items-center gap-2">
        <span
          className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-all duration-200 ${isDarkTheme
            ? "border-zinc-600 bg-zinc-800"
            : "border-[var(--brand-light)] bg-zinc-100"
            }`}
        >
          <span
            className={`absolute left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-white text-[var(--brand)] shadow transition-transform duration-200 ${isDarkTheme ? "translate-x-6 text-zinc-700" : "translate-x-0"
              }`}
          >
            {isDarkTheme ? <IoMoon size={12} /> : <IoSunny size={12} />}
          </span>
        </span>
        <span>{isDarkTheme ? "Dark" : "Light"}</span>
      </span>
    </button>
  ) : null;

  const collapsedThemeToggle = onToggleTheme ? (
    <button
      type="button"
      onClick={handleToggleTheme}
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow transition hover:border-[var(--brand-light)] hover:text-[var(--brand)]`}
      aria-pressed={isDarkTheme}
    >
      {isDarkTheme ? <IoMoon size={16} /> : <IoSunny size={16} />}
      <span className="sr-only">Toggle theme</span>
    </button>
  ) : null;

  const handleNavigate = (targetId) => {
    if (!targetId || !onNavigate) {
      return;
    }
    if (pathName.startsWith("/chat")) {
      pathName = "chat";
    } else {
      pathName = "training";
    }
    onNavigate(`/${pathName}/${targetId}`);
    setCurrentId(targetId);
  };

  const handleNewChat = () => {
    if (onStartNewChat) {
      onStartNewChat();
    }
    if (onNavigate) {
      let currentPage = window.location.pathname;
      if (pathName.startsWith("/chat")) {
        pathName = "chat";
      } else {
        pathName = "training";
      }
      if (currentPage) {
        onNavigate('/' + currentPage);
        return;
      }
      onNavigate("/");
    }
  };

  const collapsedContent = (
    <>
      <button
        onClick={handleNewChat}
        disabled={isLoading}
        className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] text-white shadow-lg shadow-[0_16px_32px_rgba(242,60,57,0.25)] transition hover:scale-[1.03] hover:shadow-[0_20px_40px_rgba(242,60,57,0.32)] ${isLoading ? "cursor-not-allowed opacity-60" : ""
          }`}
        title="Start a new chat"
        aria-label="Start a new chat"
      >
        <IoAdd size={16} />
      </button>
      {collapsedThemeToggle}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-400">
        <span className="sr-only">History hidden while collapsed</span>
        <div className="h-14 w-px rounded-full bg-zinc-200" />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] text-sm font-semibold text-white shadow-lg shadow-[0_18px_32px_rgba(242,60,57,0.3)]">
          U
        </div>
      </div>
    </>
  );

  const expandedContent = (
    <>
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleNewChat}
          disabled={isLoading}
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] py-2 text-sm font-semibold text-white shadow-lg shadow-[0_16px_32px_rgba(242,60,57,0.25)] transition hover:scale-[1.02] hover:shadow-[0_20px_40px_rgba(242,60,57,0.32)] ${isLoading ? "cursor-not-allowed opacity-60" : ""
            }`}
        >
          <IoAdd size={16} /> New
        </button>
        {expandedThemeToggle}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.4em] text-zinc-500">
          History
        </h2>
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-1 text-sm">
          {itemsToRender.length === 0 ? (
            <p className="text-xs text-zinc-500/90">No conversations yet</p>
          ) : (
            itemsToRender.map((item) => {
              const rawId = hasThreads ? resolveThreadId(item) : item?.id;
              const normalizedId = rawId !== null && rawId !== undefined ? String(rawId) : null;
              const key = normalizedId ?? (hasThreads ? resolveThreadLabel(item) : item?.title);
              const label = hasThreads ? resolveThreadLabel(item) : `${item?.metadata?.thread_name ?? "Untitled"}...`;
              const isSelected =
                normalizedSelectedId !== null && normalizedId === normalizedSelectedId;
              const isNavigable = Boolean(normalizedId);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNavigate(normalizedId)}
                  className={`rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${isSelected || normalizedId === currentId
                    ? "border-[var(--brand)] bg-[var(--brand-lighter)] text-black shadow-[0_6px_18px_rgba(242,60,57,0.16)]"
                    : "border-transparent bg-zinc-50 text-zinc-600 hover:border-[var(--brand-light)] hover:bg-[var(--brand-lighter)] hover:text-black"
                    } ${isNavigable ? "" : "cursor-default opacity-60"}`}
                  disabled={!isNavigable}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand)] via-[var(--brand)] to-[var(--brand-dark)] text-white shadow-[0_18px_32px_rgba(242,60,57,0.3)]">
          U
        </div>
        <div>
          <p className="text-sm font-semibold text-black">You</p>
          <p className="text-xs text-zinc-500">Workspace owner</p>
        </div>
      </div>
    </>
  );

  return (
    <div key={refreshKey}
      className={`relative flex h-full transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-64"
        }`}
    >
      <aside
        className={`flex h-full w-full flex-col rounded-3xl border border-zinc-200 bg-white/85 shadow-[0_16px_40px_rgba(17,17,17,0.08)] backdrop-blur-md transition-all duration-300 ease-in-out ${isCollapsed ? "items-center gap-6 px-3 py-4" : "gap-4 p-5"
          }`}
        aria-hidden={false}
      >
        {isCollapsed ? collapsedContent : expandedContent}
      </aside>

      <button
        onClick={onToggleCollapse}
        className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transform transition duration-300 ease-in-out hover:border-[var(--brand-light)] hover:text-[var(--brand)] ${isCollapsed ? "top-1/2 right-[-18px] -translate-y-1/2" : "top-4 -right-4"}`}
        aria-label={isCollapsed ? "Expand left panel" : "Collapse left panel"}
      >
        {isCollapsed ? <IoChevronForward size={14} /> : <IoChevronBack size={14} />}
      </button>
    </div>
  );
}
