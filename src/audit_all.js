// 전체 점검: 화면 폭마다 모든 탭 · 하위 메뉴 · 창을 열어서 (1) 화면 밖으로 삐져나감 (2) 글자 잘림 (3) 하위 메뉴마다 폭이 바뀜 (4) 스크립트 오류를 찾아요
const { chromium } = (() => { try { return require('playwright'); } catch (e) { return require('/opt/npm-tools/node_modules/playwright'); } })();
const WS = (process.argv[2] || '360,412,768,1024,1280,1600').split(',').map(Number), DARK = process.argv[3] === 'dark';
const MOCK = require('fs').readFileSync(require('path').join(__dirname, 'test', 'mockcrm.txt'), 'utf8').replace(/^ await p\.evaluate\(\(\) => \{/, '').replace(/\}\);\s*$/, '');
(async () => { const b = await chromium.launch(); let total = 0;
 for (const W of WS) {
  const p = await (await b.newContext({ viewport: { width: W, height: 860 } })).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(() => { sessionStorage.setItem('herb5_splash', '1'); window.XLSX = { read: () => ({ SheetNames: ['s'], Sheets: { s: {} } }), utils: { sheet_to_json: () => window.__rows } }; });
  await p.goto('file://' + require('path').join(__dirname, 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(d => { document.body.classList.add('fbmode', 'is-admin'); if (d) document.documentElement.classList.add('dark'); }, DARK);
  await p.evaluate(new Function(MOCK));
  await p.evaluate(() => { document.body.classList.add('fbmode', 'is-admin'); });
  await p.click('.tab[data-t=run]'); await p.evaluate(r => window.__rows = r, require(require('path').join(__dirname, 'test', 'anon.json')).orig); await p.setInputFiles('#file', { name: 'a.csv', buffer: Buffer.from('x') }); await p.waitForTimeout(500);
  const issues = [], widths = {};
  const check = async (name, scope) => { await p.waitForTimeout(220); const r = await p.evaluate(([W, scope]) => { const out = [];
    if (document.documentElement.scrollWidth > W + 1) out.push('PAGE 가로 스크롤 ' + document.documentElement.scrollWidth);
    const root = scope ? document.querySelectorAll(scope) : document.querySelectorAll('section:not(.hidden), header.top, .tabbar, .pagehead, .modal:not(.hidden), .crm-drawer, #acbox');
    root.forEach(R => R.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') return; if (!e.offsetParent && cs.position !== 'fixed') return; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return;
      let sc = false; for (let a = e.parentElement; a; a = a.parentElement) { const c = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(c.overflowX) && a.scrollWidth > a.clientWidth + 1 && a !== document.body && a !== document.documentElement) { sc = true; break; } if (c.position === 'fixed' && a.getBoundingClientRect().right > W + 2) { sc = true; break; } }
      if (!sc && (r.right > W + 1 || r.left < -1)) out.push('OUT ' + e.tagName + '.' + String(e.className).slice(0, 28) + (e.id ? '#' + e.id : '') + ' [' + Math.round(r.left) + '~' + Math.round(r.right) + '] "' + (e.textContent || '').trim().slice(0, 18) + '"');
      if (e.children.length === 0 && (e.textContent || '').trim() && /(hidden|clip)/.test(cs.overflowX) && cs.textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 2 && !/INPUT|TEXTAREA|SELECT|svg|path/i.test(e.tagName)) out.push('CLIP ' + e.tagName + '.' + String(e.className).slice(0, 28) + ' "' + e.textContent.trim().slice(0, 20) + '"');
    }));
    // 겹침: 글자 · 버튼끼리 서로 겹치는지 (지도 · 달력 그림 안은 빼고)
    const L = []; root.forEach(R => R.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < .2) return; if (!e.offsetParent && cs.position !== 'fixed') return;
      if (e.closest('.geo-map,.wmap,svg,.cd-cal,.hm-ring,.crm-chart,.hmdg,.sg-ghost,#acbox,.tabs,.tab,.hmx,.hmsz')) return; const dc = e.closest('details:not([open])'); if (dc && !e.closest('summary')) return;
      const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.tagName)) return;
      if (e.closest('.savebar')) return; let r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return;
      for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const c = getComputedStyle(a); if (/(auto|scroll|hidden)/.test(c.overflowY + c.overflowX)) { const q = a.getBoundingClientRect(); const l = Math.max(r.left, q.left), t = Math.max(r.top, q.top), rr = Math.min(r.right, q.right), bb = Math.min(r.bottom, q.bottom); if (rr - l < 4 || bb - t < 4) return; r = { left: l, top: t, right: rr, bottom: bb, width: rr - l, height: bb - t }; } }
      const cr = cs.display === 'inline' ? [...e.getClientRects()].filter(x => x.width > 3 && x.height > 3) : null;
      L.push([e, r, cr && cr.length > 1 ? cr : null]); }));
    if (L.length < 900) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const [a, ra, ma] = L[i], [c, rc, mc] = L[j]; if (a.contains(c) || c.contains(a)) continue;
      if (ma || mc) { const A = ma || [ra], Cc = mc || [rc]; if (!A.some(x => Cc.some(y => Math.min(x.right, y.right) - Math.max(x.left, y.left) > 4 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 4))) continue; }
      const ix = Math.min(ra.right, rc.right) - Math.max(ra.left, rc.left), iy = Math.min(ra.bottom, rc.bottom) - Math.max(ra.top, rc.top);
      if (ix > 4 && iy > 4 && ix * iy > 0.25 * Math.min(ra.width * ra.height, rc.width * rc.height)) out.push('OVER "' + (a.textContent || a.tagName).trim().slice(0, 14) + '" × "' + (c.textContent || c.tagName).trim().slice(0, 14) + '"'); }
    const sec = document.querySelector('section:not(.hidden)'); return { out: [...new Set(out)].slice(0, 12), w: sec ? Math.round(sec.getBoundingClientRect().width) : 0 }; }, [W, scope || null]);
    if (r.out.length) issues.push([name, r.out]); return r.w; };
  const tab = async t => { await p.click(`.tab[data-t=${t}]`, { force: true }); await p.waitForTimeout(250); };
  for (const t of ['home', 'run', 'sum', 'stock', 'crm', 'issue', 'hist', 'market', 'rules']) {
    await tab(t); if (t === 'rules') await p.evaluate(() => $('v-rules').classList.remove('locked'));
    const subs = await p.$$eval(`#v-${t} .subtabs [data-subgo]`, a => a.filter(x => x.offsetParent).map(x => x.dataset.subgo));
    if (!subs.length) { widths[t] = [await check(t)]; }
    else { widths[t] = []; for (const s of subs) { await p.click(`#v-${t} [data-subgo=${s}]`, { force: true }); widths[t].push(await check(t + '/' + s)); } }
  }
  // 고객 관리 메뉴 · 지도 · 옆 창
  await tab('crm'); widths.crm2 = [];
  for (const k of ['all', 'week', 'call']) { await p.click(`[data-crmp=${k}]`, { force: true }); widths.crm2.push(await check('crm/' + k)); }
  for (const f of ['vip', 'new', 'sleep', 'biz']) { await p.selectOption('#crm-flt', f).catch(() => {}); widths.crm2.push(await check('crm/필터-' + f)); } await p.selectOption('#crm-flt', '').catch(() => {});
  await p.click('[data-crmview=map]', { force: true }); widths.crm2.push(await check('crm/지도'));
  await p.click('[data-crmsido="서울"]', { force: true }).catch(() => {}); widths.crm2.push(await check('crm/지도-서울'));
  await p.evaluate(() => { document.querySelector('[data-crmp=all]').click(); }); await p.waitForTimeout(150); await p.evaluate(() => { const r = document.querySelector('.crm-tr[data-crmc]'); if (r) r.click(); }); await check('crm/옆창', '.crm-drawer'); await p.keyboard.press('Escape');
  // 홈 꾸미기 · 추가 창
  await tab('home'); const ck = sel => p.evaluate(s => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
  console.log('home visible', await p.isVisible('#v-home'), await ck('#hm-edit')); await check('home/꾸미기'); await ck('#hm-add'); await check('home/추가창', '#hmAdd'); for (const a of ['cal','run','wx','stock','ret','issue','claim','hist','crm','market','memo']) { await ck('[data-hmwapp="'+a+'"]'); await check('위젯/'+a, '#hmAdd'); await ck('#hma-back'); } await ck('#hma-close'); await ck('#hm-done'); await p.evaluate(() => { const keep = hmL; hmL = { v: 1, items: Object.keys(HM_W).map((k, i) => ({ id: 'aw' + i, t: 'w', w: k, s: HM_W[k].def })) }; hmBuild(); renderHome(); window.__hmKeep = keep; }); await check('home/모든 위젯'); await p.evaluate(() => { hmL = window.__hmKeep; hmBuild(); renderHome(); });
  // 이슈 창
  await tab('stock'); await ck('#v-stock [data-subgo=ret]'); await p.fill('#ret-n', '로즈마리'); await p.fill('#ret-q', '1'); await ck('#ret-addiss'); await check('이슈 창', '#issModal'); await p.keyboard.press('Escape'); await tab('issue'); await ck('[data-isscat=parcel]'); await check('이슈/택배 반품'); await ck('#iss-addbtn'); await check('택배 반품 창', '#issModal'); await p.keyboard.press('Escape'); await ck('[data-isscat=item]'); await p.evaluate(() => { rules.cafe24 = Object.assign({}, rules.cafe24 || {}, { worker: 'https://x.example' }); window.mallLoad = async () => renderMall(); mallReady = true; const t = new Date(), ym = o => { const d = new Date(t.getFullYear(), t.getMonth() + o, 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }; const R = (m, ch, n, o, q) => [m + '-01', ch, n, o, q, ch]; const c = ym(0), v = ym(-1); mallMem.set(c, { at: Date.now(), v: 5, rows: [R(c,'coupang','식용꽃 혼합','50송이',259), R(c,'smart','식용꽃 혼합','50송이',200), R(c,'self','식용꽃 혼합','100송이',176), R(c,'coupang','식용꽃 비올라','30송이',90), R(c,'smart','식용꽃 팬지','30송이',2), R(c,'npay','나스터튬잎 한련화잎','50g',1233)] }); mallMem.set(v, { at: Date.now(), v: 5, rows: [R(v,'coupang','식용꽃 혼합','50송이',380), R(v,'smart','식용꽃 혼합','50송이',210), R(v,'coupang','식용꽃 비올라','30송이',110), R(v,'smart','식용꽃 팬지','30송이',48), R(v,'coupang','미니장미','1팩',25), R(v,'npay','나스터튬잎 한련화잎','50g',2410)] }); }); await tab('hist'); await ck('[data-subgo=mall]'); await check('쇼핑몰 비교/판매수량'); await ck('[data-mallmode=diff]'); await check('쇼핑몰 비교/증감'); await p.selectOption('#mallsortsel', 'drop'); await p.waitForTimeout(200); await check('쇼핑몰 비교/감소 순'); await ck('#mallzero'); await check('쇼핑몰 비교/판매 0개'); await ck('#mallzero'); await ck('#hmall [data-sbw]'); await check('쇼핑몰 비교/비율 구성'); await ck('#hmall tr.mi'); await check('쇼핑몰 비교/품목 추이 · 메모'); await ck('[data-malltu=week]'); await check('쇼핑몰 비교/주별 추이'); await ck('[data-malltu=day]'); await ck('#hmall tr.mi'); await ck('[data-mallcmp=yoy]'); await check('쇼핑몰 비교/작년 같은 기간'); await ck('[data-mallcmp=prev]'); await ck('.mkpi [data-mallcard=coupang]'); await p.waitForTimeout(700); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); await check('쇼핑몰 비교/쿠팡 카드'); await ck('.msolo [data-mallcard=all]'); await ck('[data-mallmode=qty]'); await p.selectOption('#mallsortsel', 'my');
  // 카톡 주문 넣기 (업체 등록 · 붙여 넣기 · 엑셀에 합치기)
  await tab('run'); await ck('#v-run [data-subgo=order]'); await ck('#ktbizadd'); await check('카톡/업체 등록', '#ktcard');
  await p.evaluate(async () => { $('ktb-name').value = '점검식당'; $('ktb-addr').value = '서울 용산구 이태원로 1'; $('ktbf').requestSubmit(); await new Promise(r => setTimeout(r, 200)); document.querySelector('.ktpaste').open = true; $('ktpt').value = '[점검식당] [오전 10:12] 로즈마리 2팩, 애플민트 100g 3개'; $('ktparse').click(); await $('ktgo').onclick(); document.querySelector('[data-ktin]').click(); await new Promise(r => setTimeout(r, 200)); });
  await check('카톡/합치기', '#ktcard'); await p.evaluate(() => scrollTo(0, 0)); await check('카톡/주문정리 표', '#out');
  // 폭 변화
  const wv = Object.entries(widths).filter(([, a]) => a.length > 1 && Math.max(...a) - Math.min(...a) > 2).map(([k, a]) => k + ' ' + a.join('/'));
  total += issues.length + wv.length + errs.length;
  console.log(`\n== ${W}px${DARK ? ' dark' : ''} · 문제 ${issues.length} · 폭 변화 ${wv.length} · 오류 ${errs.length}`);
  issues.forEach(([n, o]) => console.log('  [' + n + ']\n    ' + o.join('\n    ')));
  wv.forEach(x => console.log('  [폭 변화] ' + x)); errs.forEach(x => console.log('  [오류] ' + x));
  await p.close(); }
 console.log('\n총 ' + total + '건'); await b.close(); })();
