# ctxprefs

Firefox extension: different settings per container. Firefox's `about:config` is global, so this does not change prefs.
It changes what each container sends and how it connects, which covers most of what people want from per-container prefs.

| setting | effect |
|---|---|
| `userAgent` | replaces the `User-Agent` request header (not `navigator.userAgent` in scripts) |
| `acceptLanguage` | replaces `Accept-Language` |
| `dnt` | sends `DNT: 1` and `Sec-GPC: 1` |
| `referer` | `keep`, `origin` (only `https://site/`) or `none` |
| `proxy` | `socks5://host:port`, `socks4://`, `http://`, `https://` or `direct`; SOCKS also resolves names through the proxy |

Settings are one JSON object keyed by container name; `default` applies to every container (and to tabs outside any), a
container's own entry wins over it:

    { "default": { "dnt": true },
      "Banking": { "referer": "none", "proxy": "direct" },
      "Shopping": { "acceptLanguage": "pl-PL,pl;q=0.9", "referer": "origin" } }

Edit it on the add-on's options page (`about:addons` > ctxprefs > Preferences). Bad values are reported and not saved.

## Build and test

    ./build    # TypeScript -> dist/ with Node's type stripper, no npm; needs Node 23.2 or newer
    ./pack       # dist/ zipped into ctxprefs.xpi (unsigned; load via about:debugging or an unbranded build)
    ./test     # unit tests (node:test)

Load `dist/manifest.json` through `about:debugging` > This Firefox > Load Temporary Add-on.

## Status

The rules code has unit tests. A real headless Firefox with the extension loaded (config baked in) sent a request through a
local proxy with the replaced User-Agent, `DNT`/`Sec-GPC` added and `Referer` removed. Not tested: the lookup from a real
container to its name (`contextualIdentities`), and the options page (Firefox blocks automated opening of extension pages).
Not possible with this approach: real about:config prefs, `navigator.*` values, WebRTC, per-container tracking protection.
