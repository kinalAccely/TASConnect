import React, { useEffect, useMemo, useState } from "react";
import { IoAdd, IoChevronBack, IoChevronForward, IoMoon, IoSunny } from "react-icons/io5";
import { fetchThreads } from "../../services/threadService.js";

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
  theme = "dark",
  onNavigate,
  onStartNewChat,
  onToggleTheme,
  onToggleCollapse,
  refreshKey,
  selectedChatId,
}) {
  const [threads, setThreads] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const normalizedSelectedId =
    selectedChatId !== undefined && selectedChatId !== null
      ? String(selectedChatId)
      : null;

  useEffect(() => {
    let isMounted = true;
    setCurrentId(window.location.pathname.split("/").pop());
    fetchThreads()
      .then((data) => {
        if (!isMounted) {
          return;
        }

        const normalized = Array.isArray(data)
          ? data
          : Array.isArray(data?.threads)
            ? data.threads
            : [];
        setThreads(normalized);
      })
      .catch((error) => {
        console.error("Failed to fetch threads for sidebar:", error);
      });

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const historyItems = useMemo(() => chatHistory?.[activeTab] ?? [], [chatHistory, activeTab]);
  const showThreads = activeTab === "Chat";
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
      className="group inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.32em] text-slate-400 transition hover:border-sky-500/60 hover:text-sky-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/60"
      aria-pressed={isDarkTheme}
    >
      <span className="flex items-center gap-2">
        <span
          className={`relative inline-flex h-6 w-12 items-center rounded-full border transition-all duration-200 ${
            isDarkTheme ? "border-slate-500 bg-slate-800" : "border-slate-500/60 bg-slate-700/60"
          }`}
        >
          <span
            className={`absolute left-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-950 text-slate-200 shadow transition-transform duration-200 ${
              isDarkTheme ? "translate-x-6" : "translate-x-0 text-sky-300"
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
      className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 text-slate-300 shadow transition hover:border-sky-500/60 hover:text-sky-200"
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
    onNavigate(`/chat/${targetId}`);
    setCurrentId(targetId);
  };

  const handleNewChat = () => {
    if (onStartNewChat) {
      onStartNewChat();
    }
    if (onNavigate) {
      onNavigate("/");
    }
  };

  const collapsedContent = (
    <>
      <button
        onClick={handleNewChat}
        disabled={isLoading}
        className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-800 via-sky-600 to-indigo-500 text-white shadow-lg shadow-sky-900/40 transition hover:scale-[1.02] ${isLoading ? "cursor-not-allowed opacity-60" : ""}`}
        title="Start a new chat"
        aria-label="Start a new chat"
      >
        <IoAdd size={16} />
      </button>
      {collapsedThemeToggle}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-[10px] font-medium uppercase tracking-[0.32em] text-slate-500">
        <span className="sr-only">History hidden while collapsed</span>
        <div className="h-14 w-px rounded-full bg-slate-800/70" />
      </div>
      <div className="flex items-center justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 via-sky-600 to-indigo-500 text-sm font-semibold text-white shadow-inner shadow-sky-900/40">
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
          className={`flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-800 via-sky-600 to-indigo-500 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-900/40 transition hover:scale-[1.02] ${isLoading ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <IoAdd size={16} /> New
        </button>
        {expandedThemeToggle}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.4em] text-slate-500">
          History
        </h2>
        <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto pr-1 text-sm">
          {itemsToRender.length === 0 ? (
            <p className="text-xs text-slate-500/80">No conversations yet</p>
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
                      ? "border-sky-500/70 bg-slate-900 text-sky-200 shadow-lg shadow-sky-900/40"
                      : "border border-transparent bg-slate-900/70 text-slate-300 hover:border-sky-500/60 hover:text-slate-100"
                    } ${isNavigable ? "" : "cursor-default opacity-70"}`}
                  disabled={!isNavigable}
                >
                  {label}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-auto flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 via-sky-600 to-indigo-500 text-white shadow-inner shadow-sky-900/40">
          U
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-200">You</p>
          <p className="text-xs text-slate-500">Workspace owner</p>
        </div>
      </div>
    </>
  );

  return (
    <div
      className={`relative flex h-full transition-all duration-300 ease-in-out ${isCollapsed ? "w-16" : "w-64"}`}
    >
      <aside
        className={`flex h-full w-full flex-col rounded-3xl border border-slate-800 bg-slate-950/70 shadow-[0_12px_30px_rgba(8,47,73,0.25)] backdrop-blur transition-all duration-300 ease-in-out ${isCollapsed ? "items-center gap-6 px-3 py-4" : "gap-4 p-5"}`}
      >
        {isCollapsed ? collapsedContent : expandedContent}
      </aside>

      <button
        onClick={onToggleCollapse}
        className={`absolute z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-300 shadow-sm transition duration-300 ease-in-out hover:border-sky-500/60 hover:text-sky-200 ${isCollapsed ? "top-1/2 right-[-18px] -translate-y-1/2" : "top-4 -right-4"}`}
        aria-label={isCollapsed ? "Expand left panel" : "Collapse left panel"}
      >
        {isCollapsed ? <IoChevronForward size={14} /> : <IoChevronBack size={14} />}
      </button>
    </div>
  );
}
