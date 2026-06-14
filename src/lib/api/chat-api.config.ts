/** Local dev only when `NEXT_PUBLIC_CHAT_API_URL` is unset. */
const DEFAULT_CHAT_DEV = 'http://localhost:5002';
/** Production fallback when env var is missing (Render). */
const DEFAULT_CHAT_PROD = 'https://chatservice-backend.onrender.com';

export function resolveChatBaseURL(): string {
  const raw = process.env.NEXT_PUBLIC_CHAT_API_URL?.trim() ?? '';
  const normalized = raw.replace(/\/$/, '');
  if (normalized) {
    if (
      process.env.NODE_ENV === 'production' &&
      /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
    ) {
      console.error(
        `[chat-api] NEXT_PUBLIC_CHAT_API_URL is set to a localhost URL (${normalized}) in production — falling back to ${DEFAULT_CHAT_PROD}. Fix the Production env var and redeploy.`
      );
      return DEFAULT_CHAT_PROD;
    }
    return normalized;
  }

  // Browser prod without build-time env (e.g. Netlify): same-origin `/api/chats/*` → Next rewrites (no CORS).
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return '';
  }

  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_CHAT_PROD;
  }
  return DEFAULT_CHAT_DEV;
}

