import { parseConfig } from './rules.ts';
declare const browser: any;

const EXAMPLE = JSON.stringify({
  default: { dnt: true },
  Banking: { referer: 'none', proxy: 'direct' },
  Shopping: { acceptLanguage: 'pl-PL,pl;q=0.9', referer: 'origin' },
}, null, 2);

const ta = document.getElementById('cfg') as HTMLTextAreaElement;
const msg = document.getElementById('msg') as HTMLElement;

async function show() {
  const st = await browser.storage.local.get('config');
  ta.value = typeof st.config === 'string' && st.config.trim() ? st.config : EXAMPLE;
  try {
    const ids: { name: string }[] = await browser.contextualIdentities.query({});
    document.getElementById('names')!.textContent = ids.length ? 'Your containers: ' + ids.map((i) => i.name).join(', ') : 'No containers yet.';
  } catch { document.getElementById('names')!.textContent = 'Containers are off in this Firefox.'; }
}

document.getElementById('save')!.addEventListener('click', async () => {
  const { errors } = parseConfig(ta.value);
  msg.textContent = errors.length ? 'Not saved, fix these first: ' + errors.join(' | ') : 'Saved.';
  if (!errors.length) await browser.storage.local.set({ config: ta.value });
});

show();
