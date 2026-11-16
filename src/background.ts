// Background script: looks up which container a request belongs to and applies that container's headers and proxy.
import { parseConfig, applyHeaders, forContainer, parseProxy, type Config } from './rules.ts';

declare const browser: any;

let config: Config = {};
let names = new Map<string, string>();      // cookieStoreId -> container name

async function reload() {
  const st = await browser.storage.local.get('config');
  config = parseConfig(typeof st.config === 'string' ? st.config : '{}').config;
  try {
    const ids: { cookieStoreId: string; name: string }[] = await browser.contextualIdentities.query({});
    names = new Map(ids.map((i) => [i.cookieStoreId, i.name]));
  } catch { names = new Map(); }       // containers are switched off in this Firefox
}

const cfgFor = (cookieStoreId?: string) => forContainer(config, cookieStoreId ? names.get(cookieStoreId) : undefined);

browser.webRequest.onBeforeSendHeaders.addListener(
  (d: { requestHeaders?: { name: string; value?: string }[]; cookieStoreId?: string }) => {
    const c = cfgFor(d.cookieStoreId);
    if (!c || !d.requestHeaders) return {};
    const hs = d.requestHeaders.map((h) => ({ name: h.name, value: h.value ?? '' }));
    return { requestHeaders: applyHeaders(hs, c) };
  },
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders'],
);

browser.proxy.onRequest.addListener(
  (d: { cookieStoreId?: string }) => {
    const c = cfgFor(d.cookieStoreId);
    const p = c?.proxy ? parseProxy(c.proxy) : null;
    if (!p || p.type === 'direct') return { type: 'direct' };
    // the proxy also resolves the names, so a SOCKS container does not leak its lookups
    return { type: p.type, host: p.host, port: p.port, proxyDNS: p.type !== 'http' && p.type !== 'https' };
  },
  { urls: ['<all_urls>'] },
);

browser.storage.onChanged.addListener(() => { reload(); });
browser.contextualIdentities?.onCreated?.addListener(() => { reload(); });
browser.contextualIdentities?.onUpdated?.addListener(() => { reload(); });
reload();
