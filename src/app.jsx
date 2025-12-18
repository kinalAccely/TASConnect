import React, { useCallback, useEffect, useRef, useState } from "react";
import routes from "./route.js";
import { fetchThreads } from "./services/threadService.js";

/* ----------------------------- Utility Helpers ----------------------------- */

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizePath = (value) => {
  if (!value) {
    return "/";
  }
  let normalized = value.trim();
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  normalized = normalized.replace(/\/{2,}/g, "/");
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.replace(/\/+$/, "");
    if (normalized === "") {
      normalized = "/";
    }
  }
  return normalized || "/";
};

/**
 * Matches a path such as "/chat/123" to route "/chat/:chatId"
 */
const matchRoutePath = (pathname) => {
  for (const route of routes) {
    const paramNames = [];
    const regexPattern = route.path
      .split("/")
      .map((segment) => {
        if (segment.startsWith(":") && segment.length > 1) {
          paramNames.push(segment.slice(1));
          return "([^/]+)";
        }
        return escapeRegExp(segment);
      })
      .join("/");

    const regex = new RegExp(`^${regexPattern}$`);
    const match = pathname.match(regex);

    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });
      return { route, params };
    }
  }
  return null;
};

const resolveThreadId = (thread) => {
  if (!thread || typeof thread !== "object") {
    return null;
  }
  return (
    thread.id ??
    thread.thread_id ??
    thread?.metadata?.thread_id ??
    thread?.metadata?.id ??
    null
  );
};

const extractThreadIds = (payload) => {
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.threads)
      ? payload.threads
      : [];

  return list
    .map(resolveThreadId)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));
};

const baseRouteForPath = (path) => {
  if (path.startsWith("/training")) {
    return "/training";
  }
  if (path.startsWith("/livedemo")) {
    return "/livedemo";
  }
  return "/chat";
};

/* ---------------------------------- App ----------------------------------- */

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/chat";
    }
    const initial = normalizePath(window.location.pathname);
    return initial === "/" ? "/chat" : initial;
  });
  const threadIdsRef = useRef(new Set());

  /**
   * Load all threads on startup
   * Ensures fetchThreads() uses correct baseUrl (from your service)
   */
  useEffect(() => {
    let isMounted = true;

    fetchThreads()
      .then((data) => {
        if (!isMounted) {
          return;
        }
        threadIdsRef.current = new Set(extractThreadIds(data));
      })
      .catch((error) => {
        console.error("Failed to load threads:", error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Listen for browser back/forward navigation
   */
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath((prev) => {
        const next = normalizePath(window.location.pathname);
        return next === "/" ? "/chat" : next;
      });
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  /**
   * Custom navigation
   */
  const navigate = useCallback((path) => {
    if (typeof window === "undefined") return;

    let target = normalizePath(path);
    if (target === "/") {
      target = "/chat";
    }

    if (window.location.pathname !== target) {
      window.history.pushState({}, "", target);
    }
    setCurrentPath(target);
  }, []);

  useEffect(() => {
    if (currentPath === "/") {
      navigate("/chat");
    }
  }, [currentPath, navigate]);

  /**
   * Match the route
   */
  const match = matchRoutePath(currentPath);
  const RouteComponent = match?.route?.component ?? null;
  const chatId = match?.params?.chatId ?? null;
  const initialTab = match?.route?.tab ?? "Chat";

  /**
   * Verify that a provided chatId exists on the server.
   * If not, redirect user back to the base route for the current section.
   */
  useEffect(() => {
    if (!chatId) {
      return;
    }

    const normalizedChatId = String(chatId);
    if (threadIdsRef.current.has(normalizedChatId)) {
      return;
    }

    let isActive = true;

    const ensureThreadExists = async () => {
      try {
        const data = await fetchThreads();
        if (!isActive) {
          return;
        }

        const ids = extractThreadIds(data);
        const idsSet = new Set(ids);
        threadIdsRef.current = idsSet;

        if (!idsSet.has(normalizedChatId)) {
          navigate(baseRouteForPath(currentPath));
        }
      } catch (error) {
        console.error("Failed to validate thread id:", error);
      }
    };

    ensureThreadExists();

    return () => {
      isActive = false;
    };
  }, [chatId, currentPath, navigate]);

  return (
    <div className="flex h-full min-h-screen flex-col bg-transparent">
      <div className="flex flex-1 flex-col min-h-0">
        {RouteComponent ? (
          <RouteComponent
            chatId={chatId}
            initialTab={initialTab}
            onNavigate={navigate}
          />
        ) : null}
      </div>
    </div>
  );
}
