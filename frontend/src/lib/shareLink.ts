export type ShareLinkResult = { ok: true; url: string } | { ok: false; message: string };

const CHATGPT_HOSTS = ['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'];

export const SHARE_MESSAGES = {
  notUrl: 'Paste a link that starts with https://chatgpt.com/share/',
  claude: 'Claude share links are not supported yet. Upload your Claude data export (conversations.json) instead',
  privateLink: 'That is a private conversation link. In ChatGPT use Share, then Copy link',
  unsupported: 'Only public ChatGPT share links can be imported',
};

/** Mirrors the backend allowlist in backend/app/parsers/url_fetcher.py. */
export function parseShareLink(input: string): ShareLinkResult {
  const raw = input.trim();
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, message: SHARE_MESSAGES.notUrl };
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'claude.ai' || host === 'www.claude.ai') return { ok: false, message: SHARE_MESSAGES.claude };
  if (u.protocol !== 'https:') return { ok: false, message: SHARE_MESSAGES.notUrl };
  if (!CHATGPT_HOSTS.includes(host)) return { ok: false, message: SHARE_MESSAGES.unsupported };
  const path = u.pathname;
  if (path.startsWith('/c/')) return { ok: false, message: SHARE_MESSAGES.privateLink };
  for (const prefix of ['/share/', '/s/']) {
    if (!path.startsWith(prefix)) continue;
    const id = path.slice(prefix.length).replace(/^\/+|\/+$/g, '');
    if (id && !id.includes('/')) return { ok: true, url: raw };
  }
  return { ok: false, message: SHARE_MESSAGES.unsupported };
}
