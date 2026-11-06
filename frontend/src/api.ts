import { storage } from "@/src/utils/storage";

const BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
const ACCESS = "auth_token";
const REFRESH = "refresh_token";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onSignedOut: (() => void) | null = null;
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

export async function saveTokens(access: string | null, refresh: string | null) {
  if (access) await storage.secureSet(ACCESS, access);
  else await storage.secureRemove(ACCESS);
  if (refresh) await storage.secureSet(REFRESH, refresh);
  else await storage.secureRemove(REFRESH);
}

export async function getRefreshToken() {
  return (await storage.secureGet(REFRESH, null)) as string | null;
}

let refreshing: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      const rt = await getRefreshToken();
      if (!rt) return false;
      const r = await fetch(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: rt }),
      });
      if (!r.ok) {
        await saveTokens(null, null);
        return false;
      }
      const x = await r.json();
      await saveTokens(x.access_token, x.refresh_token);
      return true;
    })().finally(() => {
      setTimeout(() => (refreshing = null), 0);
    });
  }
  return refreshing;
}

function errMessage(data: any, status: number) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return String(d[0].msg).replace("Value error, ", "");
  return status >= 500 ? "Something went wrong. Please try again." : "Request failed";
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; auth?: boolean } = {}): Promise<T> {
  const { method = "GET", body, auth = true } = opts;
  const send = async () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) {
      const t = (await storage.secureGet(ACCESS, null)) as string | null;
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    return fetch(`${BASE}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  };
  let r: Response;
  try {
    r = await send();
    if (r.status === 401 && auth) {
      if (await refreshTokens()) r = await send();
      else onSignedOut?.();
    }
  } catch {
    throw new ApiError(0, "You're offline. Check your connection and retry.");
  }
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new ApiError(r.status, errMessage(data, r.status));
  return data as T;
}
