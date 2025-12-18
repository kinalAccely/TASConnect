const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const DEFAULT_ASSISTANT_ID = import.meta.env.VITE_ASSISTANT_ID ?? "agent";
const TRAINING_ASSISTANT_ID = import.meta.env.VITE_TRAINING_ASSISTANT_ID ?? "training_module_graph";
const DEFAULT_STREAM_MODE = ["messages-tuple", "values", "modules", "metadata", "custom"];
const TRAINING_STREAM_MODE = ["values", "modules", "metadata", "custom"];

const normalizeBaseUrl = (url) => {
  if (!url) {
    return "";
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

export const resolveAssistantId = (moduleKey, overrideId) => {
  if (typeof overrideId === "string" && overrideId.trim().length > 0) {
    return overrideId.trim();
  }

  if (typeof moduleKey === "string" && moduleKey.toLowerCase() === "training") {
    return TRAINING_ASSISTANT_ID;
  }

  return DEFAULT_ASSISTANT_ID;
};

export async function fetchThreads() {
  if (!API_BASE_URL) {
    console.warn("VITE_API_BASE_URL is not defined.");
    return [];
  }

  const response = await fetch(`${normalizeBaseUrl(API_BASE_URL)}/threads`);

  if (!response.ok) {
    throw new Error(`Failed to fetch threads: ${response.status} ${response.statusText}`);
  }

  const threads = await response.json();
  return threads;
}

const graphObject = {
  training: TRAINING_ASSISTANT_ID,
  livedemo: "live_demo_module_graph",
  chat: DEFAULT_ASSISTANT_ID,
};

export async function fetchgraphIdAccordingToCurrentModule() {
  if (typeof window === "undefined") {
    return graphObject.chat;
  }

  const currentPath = window.location.pathname ?? "/chat";
  const [, segment = "chat"] = currentPath.split("/");
  const normalized = typeof segment === "string" ? segment.toLowerCase() : "chat";
  return graphObject[normalized] ?? graphObject.chat;
}
