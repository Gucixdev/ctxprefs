// Per-container settings. Firefox's about:config is global, so this does not change prefs: it changes what a container
// sends (headers) and which proxy it uses, which is what people want from "prefs per container" in practice.

export type Cfg = {
  userAgent?: string;
  acceptLanguage?: string;
  dnt?: boolean;                       // send DNT: 1 and Sec-GPC: 1
  referer?: 'keep' | 'origin' | 'none';
  proxy?: string;                      // socks5://host:port, socks4://, http://, https://, or "direct"
};
export type Config = Record<string, Cfg>;    // keyed by container name, "default" = no container
export type Header = { name: string; value: string };
export type Proxy = { type: 'socks' | 'socks4' | 'http' | 'https'; host: string; port: number } | { type: 'direct' };

export function parseProxy(s: string): Proxy | null {
  if (s.trim().toLowerCase() === 'direct') return { type: 'direct' };
  const m = /^(socks5?|socks4|https?):\/\/(\[[0-9a-f:]+\]|[a-z0-9.-]+):(\d{1,5})\/?$/i.exec(s.trim());
  if (!m) return null;
  const port = Number(m[3]);
  if (port < 1 || port > 65535) return null;
  const scheme = m[1].toLowerCase();
  const type = scheme === 'socks5' || scheme === 'socks' ? 'socks' : (scheme as 'socks4' | 'http' | 'https');
  return { type, host: m[2].replace(/^\[|\]$/g, ''), port };
}

const KEYS = new Set(['userAgent', 'acceptLanguage', 'dnt', 'referer', 'proxy']);

// Returns the cleaned config and a list of problems; a bad value is dropped, never guessed.
export function parseConfig(text: string): { config: Config; errors: string[] } {
  const errors: string[] = [], config: Config = {};
  let raw: unknown;
  try { raw = JSON.parse(text); } catch (e) { return { config, errors: ['not valid JSON: ' + (e as Error).message] }; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { config, errors: ['top level must be an object: {"Container name": {...}}'] };
  for (const [name, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) { errors.push(`${name}: must be an object`); continue; }
    const c: Cfg = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (!KEYS.has(k)) { errors.push(`${name}.${k}: unknown setting`); continue; }
      if (k === 'dnt') { if (typeof val === 'boolean') c.dnt = val; else errors.push(`${name}.dnt: true or false`); continue; }
      if (typeof val !== 'string' || !val.trim()) { errors.push(`${name}.${k}: must be a non-empty string`); continue; }
      if (/[\r\n\0]/.test(val)) { errors.push(`${name}.${k}: no line breaks`); continue; }
      if (k === 'referer') { if (val === 'keep' || val === 'origin' || val === 'none') c.referer = val; else errors.push(`${name}.referer: keep, origin or none`); continue; }
      if (k === 'proxy') { if (parseProxy(val)) c.proxy = val.trim(); else errors.push(`${name}.proxy: use socks5://host:port, http://host:port or direct`); continue; }
      (c as Record<string, string>)[k] = val;
    }
    config[name] = c;
  }
  return { config, errors };
}

const lower = (h: Header) => h.name.toLowerCase();

export function applyHeaders(headers: Header[], c: Cfg | undefined): Header[] {
  if (!c) return headers;
  let out = headers.slice();
  const set = (name: string, value: string) => { out = out.filter((h) => lower(h) !== name.toLowerCase()); out.push({ name, value }); };
  const drop = (name: string) => { out = out.filter((h) => lower(h) !== name.toLowerCase()); };
  if (c.userAgent) set('User-Agent', c.userAgent);
  if (c.acceptLanguage) set('Accept-Language', c.acceptLanguage);
  if (c.dnt) { set('DNT', '1'); set('Sec-GPC', '1'); }
  if (c.referer === 'none') drop('Referer');
  else if (c.referer === 'origin') {
    const r = out.find((h) => lower(h) === 'referer');
    if (r) { try { set('Referer', new URL(r.value).origin + '/'); } catch { drop('Referer'); } }
  }
  return out;
}

// the config for one container: its own entry over "default"
export function forContainer(cfg: Config, name: string | undefined): Cfg | undefined {
  const base = cfg['default'], own = name ? cfg[name] : undefined;
  if (!base && !own) return undefined;
  return { ...base, ...own };
}
