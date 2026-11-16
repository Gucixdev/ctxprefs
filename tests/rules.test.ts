import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProxy, parseConfig, applyHeaders, forContainer } from '../src/rules.ts';

test('parseProxy', () => {
  assert.deepEqual(parseProxy('socks5://127.0.0.1:9050'), { type: 'socks', host: '127.0.0.1', port: 9050 });
  assert.deepEqual(parseProxy('http://proxy.example:8080/'), { type: 'http', host: 'proxy.example', port: 8080 });
  assert.deepEqual(parseProxy('socks4://[::1]:1080'), { type: 'socks4', host: '::1', port: 1080 });
  assert.deepEqual(parseProxy(' DIRECT '), { type: 'direct' });
  for (const bad of ['', 'socks5://host', 'socks5://host:0', 'socks5://host:70000', 'ftp://h:1', 'host:80', 'http://a b:80']) assert.equal(parseProxy(bad), null, bad);
});

test('parseConfig keeps good values, reports and drops bad ones', () => {
  const { config, errors } = parseConfig(JSON.stringify({
    Banking: { referer: 'none', dnt: true, proxy: 'direct' },
    Shopping: { userAgent: 'UA', acceptLanguage: 'pl-PL,pl;q=0.9', color: 'red', referer: 'sometimes', proxy: 'nope', dnt: 'yes' },
    Bad: 5,
  }));
  assert.deepEqual(config.Banking, { referer: 'none', dnt: true, proxy: 'direct' });
  assert.deepEqual(config.Shopping, { userAgent: 'UA', acceptLanguage: 'pl-PL,pl;q=0.9' });
  assert.equal(config.Bad, undefined);
  assert.equal(errors.length, 5);
});
test('parseConfig refuses non-objects, broken JSON and header injection', () => {
  assert.equal(parseConfig('[]').errors.length, 1);
  assert.equal(parseConfig('{').errors.length, 1);
  assert.equal(parseConfig('null').errors.length, 1);
  const r = parseConfig(JSON.stringify({ A: { userAgent: 'x\r\nX-Evil: 1' } }));
  assert.deepEqual(r.config.A, {});
  assert.equal(r.errors.length, 1);
});

const H = [{ name: 'user-agent', value: 'orig' }, { name: 'Accept-Language', value: 'en' }, { name: 'Referer', value: 'https://a.example/path?q=1' }, { name: 'Accept', value: '*/*' }];
test('applyHeaders replaces case-insensitively and leaves the rest', () => {
  const o = applyHeaders(H, { userAgent: 'UA2', acceptLanguage: 'de' });
  assert.equal(o.filter((h) => h.name.toLowerCase() === 'user-agent').length, 1);
  assert.equal(o.find((h) => h.name.toLowerCase() === 'user-agent')!.value, 'UA2');
  assert.equal(o.find((h) => h.name === 'Accept-Language')!.value, 'de');
  assert.equal(o.find((h) => h.name === 'Accept')!.value, '*/*');
  assert.equal(H[0].value, 'orig', 'input untouched');
});
test('applyHeaders: referer modes and dnt', () => {
  assert.equal(applyHeaders(H, { referer: 'none' }).some((h) => h.name === 'Referer'), false);
  assert.equal(applyHeaders(H, { referer: 'origin' }).find((h) => h.name === 'Referer')!.value, 'https://a.example/');
  assert.equal(applyHeaders(H, { referer: 'keep' }).find((h) => h.name === 'Referer')!.value, 'https://a.example/path?q=1');
  const d = applyHeaders([], { dnt: true });
  assert.deepEqual(d.map((h) => h.name + '=' + h.value), ['DNT=1', 'Sec-GPC=1']);
  assert.deepEqual(applyHeaders([{ name: 'Referer', value: 'garbage' }], { referer: 'origin' }), []);
  assert.equal(applyHeaders(H, undefined), H);
});
test('forContainer: own settings over default', () => {
  const cfg = { default: { dnt: true, referer: 'origin' as const }, Work: { referer: 'none' as const } };
  assert.deepEqual(forContainer(cfg, 'Work'), { dnt: true, referer: 'none' });
  assert.deepEqual(forContainer(cfg, undefined), { dnt: true, referer: 'origin' });
  assert.equal(forContainer({}, 'X'), undefined);
});
