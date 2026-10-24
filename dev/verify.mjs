// トランプコレクション検証パイプライン（引き継ぎ同梱版）
// 単体テスト→ビルド→フック(window.TC)駆動の通しプレイ→スクショ一式→基準画像との差分
// 使い方: リポジトリのルートで `node dev/verify.mjs`
// 要件: Node 20+ / puppeteer-core / Chrome
//   - puppeteer-core の場所は環境変数 VERIFY_TOOLS_DIR（package.json のあるDir）で指定可。未指定なら既定候補を探す
//   - Chrome のパスは環境変数 CHROME_PATH で指定可
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { existsSync as _ex } from 'node:fs';
const _cands = [process.env.VERIFY_TOOLS_DIR, '/home/hatch/workspace/tools', process.cwd()].filter(Boolean);
const _td = _cands.find(d => _ex(d + '/node_modules/puppeteer-core')) || _cands[0];
const require = createRequire(_td.replace(/\/$/, '') + '/package.json');
const puppeteer = require('puppeteer-core');
const REPO = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SHOTS = REPO + '/verify-shots/latest';
const BASE = REPO + '/verify-shots/baseline';
mkdirSync(SHOTS, { recursive: true });
const results = [];
const step = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? '✔' : '✖'} ${name} ${detail || ''}`); };

// 1) 単体テスト
const suites = readdirSync(REPO + '/tests').filter(name => name.endsWith('.test.mjs')).map(name => 'tests/' + name).sort();
const t = spawnSync('node', ['--test', ...suites], { cwd: REPO, encoding: 'utf8' });
const passM = (t.stdout + t.stderr).match(/(?:ℹ|#)\s+pass (\d+)/), failM = (t.stdout + t.stderr).match(/(?:ℹ|#)\s+fail (\d+)/);
step('単体テスト', t.status === 0, `pass=${passM?.[1]} fail=${failM?.[1]}`);

// 2) ビルド
const b = spawnSync('node', ['build-embed.mjs'], { cwd: REPO, encoding: 'utf8' });
step('単体HTMLビルド', b.status === 0, b.stdout.trim());

// 3) フック駆動の通しプレイ
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/opt/meta-chromium/chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 1180, height: 700 });
let errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + REPO + '/dist/trump-collection.html', { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 800));
step('TCフック', await page.evaluate(() => !!window.TC && window.TC.version === '1.5.5'), await page.evaluate(() => window.TC?.version));
await page.screenshot({ path: SHOTS + '/menu.png' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

 // ババ抜き：自分が引いた札の結果を表示。固定配札（seed=1）でジョーカーとペアを検証
for (const [cardIndex, expected] of [[0, 'ペアなし'], [2, 'ペア成立']]) {
  await page.evaluate(index => {
    const random = Math.random;
    Math.random = () => 1 / 1e9;
    window.TC.start('babanuki');
    Math.random = random;
    const fan = document.querySelectorAll('#drawFan .card');
    if (!fan[index]) throw new Error('Old Maid draw fan unavailable');
    fan[index].click();
  }, cardIndex);
  await sleep(420);
  const reveal = await page.evaluate(() => ({
    text: document.querySelector('#babaReveal')?.textContent || '',
    cards: document.querySelectorAll('#babaReveal .card').length,
    drawer: window.TC.state.lastDraw?.by
  }));
  step('ババ抜き引いた札 ' + expected,
    reveal.cards === 1 && reveal.drawer === 0 && reveal.text.includes(expected),
    JSON.stringify(reveal));
  await sleep(1150);
}

for (const g of ['babanuki', 'shichinarabe', 'shinkei', 'daifugo']) {
  errors = [];
  await page.evaluate(gg => { window.TC.setFast(true); window.TC.start(gg); }, g);
  await sleep(600);
  let done = false;
  for (let i = 0; i < 900 && !done; i++) {
    done = await page.evaluate(() => {
      const st = window.TC.state; if (!st) return false;
      if (st.phase === 'end') return true;
      if (st.turn !== 0) return false;
      const legal = window.TC.legal();
      const game = window.TC.game;
      if (game === 'daifugo') { if (legal.length) window.TC.act({ type: 'play', ids: legal[0] }); else window.TC.act({ type: 'pass' }); }
      else if (game === 'shichinarabe') { if (legal.length) window.TC.act({ type: 'play', ids: legal[0] }); else window.TC.act({ type: 'pass' }); }
      else if (game === 'babanuki') { window.TC.act({ type: 'draw', index: 0 }); }
      else if (game === 'shinkei') {
        if (st.flipped.length === 0) { const seen = new Map(); st.board.forEach((b, ix) => { if (!b.taken) { if (!seen.has(b.card.rank)) seen.set(b.card.rank, []); seen.get(b.card.rank).push(ix); } }); window.TC._pair = [...seen.values()].find(v => v.length >= 2); window.TC.act({ type: 'flip', pos: legal.length ? legal[0][0] : 0 }); }
      }
      return false;
    });
    if (g === 'shinkei' && !done) { // 2枚目（ペア優先）
      await page.evaluate(() => { const st = window.TC.state; if (st && st.phase === 'play' && st.turn === 0 && st.flipped.length === 1) { const first = st.board[st.flipped[0]].card; const match = st.board.findIndex((b, ix) => ix !== st.flipped[0] && !b.taken && b.card.rank === first.rank); const legal = window.TC.legal(); window.TC.act({ type: 'flip', pos: match >= 0 ? match : (legal[0] ? legal[0][0] : 0) }); } });
    }
    if (i === 3) await page.screenshot({ path: `${SHOTS}/${g}.png` });
    await sleep(240);
  }
  const modal = await page.evaluate(() => !!document.querySelector('.modalWrap'));
  step(`通しプレイ ${g}`, done && modal && errors.length === 0, `end=${done} modal=${modal} errors=${errors.length}`);
  await page.evaluate(() => document.getElementById('backBtn').click());
  await sleep(300);
}
// 4) スマホ寸法スクショ
await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });
await page.evaluate(() => { window.TC.setFast(false); window.TC.start('daifugo'); });
await sleep(2500);
await page.screenshot({ path: SHOTS + '/phone-land.png' });
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await sleep(700);
await page.screenshot({ path: SHOTS + '/phone-port.png' });
// 4b) 小さいGoogle Sites埋め込み・横向き画面のレイアウト回帰検査
for (const [w, h] of [[844, 390], [700, 320]]) {
  await page.setViewport({ width: w, height: h, isMobile: true, hasTouch: true });
  for (const g of ['babanuki', 'shichinarabe', 'shinkei', 'daifugo']) {
    await page.evaluate(id => { window.TC.setFast(false); window.TC.start(id); }, g);
    await sleep(200);
    const layout = await page.evaluate(() => {
      const fits = sel => { const el = document.querySelector(sel); if (!el) return true;
        const r = el.getBoundingClientRect();
        return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1;
      };
      return { actions: fits('#actions'), handArea: fits('#handArea'), rows: fits('#rows'), grid: fits('#grid') };
    });
    step(`コンパクト画面 ${g} ${w}x${h}`, Object.values(layout).every(Boolean), JSON.stringify(layout));
  }
}
// 4c) 神経衰弱の最後の正解ペアが結果画面で遮られないこと
await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true});
await page.evaluate(() => {
  window.TC.start('shinkei');
  const st = window.TC.state, first = 0;
  const second = st.board.findIndex((b, i) => i !== first && b.card.rank === st.board[first].card.rank);
  st.board.forEach((b, i) => { b.taken = i !== first && i !== second; });
  st.turn = 0; st.scores = [11, 0];
  document.querySelectorAll('#grid .card')[first].click();
  document.querySelectorAll('#grid .card')[second].click();
});
const beforeFinalPairModal = await page.evaluate(() => !!document.querySelector('.modalWrap'));
await sleep(950);
const afterFinalPairModal = await page.evaluate(() => !!document.querySelector('.modalWrap'));
step('神経衰弱最終ペア演出', !beforeFinalPairModal && afterFinalPairModal,
  `immediate=${beforeFinalPairModal} after=${afterFinalPairModal}`);

// 4d) Web Animations API未対応ブラウザでもカード出しがクラッシュしないこと
const priorErrorCount = errors.length;
await page.evaluate(() => {
  Element.prototype.animate = undefined;
  const originalRandom = Math.random;
  Math.random = () => 0.05;
  window.TC.start('daifugo');
  Math.random = originalRandom;
  const st = window.TC.state;
  if (st.turn !== 0) throw new Error('Test seed should let human lead');
  document.querySelector('#hand .card.legal').click();
  const play = [...document.querySelectorAll('#actions button')].find(b => b.textContent === '出す');
  if (!play || play.disabled) throw new Error('No playable card selected');
  play.click();
});
await sleep(500);
step('古いSafariのアニメーション互換', errors.length === priorErrorCount,
  `newErrors=${errors.slice(priorErrorCount).join(' | ')}`);
await browser.close();

// 5) 基準画像との差分（PILで縮小して平均差）
if (!existsSync(BASE)) { mkdirSync(BASE, { recursive: true }); for (const f of readdirSync(SHOTS)) copyFileSync(`${SHOTS}/${f}`, `${BASE}/${f}`); step('基準画像', true, '初回のため今回分を基準に登録'); }
else {
  const py = spawnSync('python3', ['-c', `
from PIL import Image
import os, sys
for f in sorted(os.listdir('${SHOTS}')):
    a = Image.open('${SHOTS}/' + f).convert('L').resize((64, 64))
    bpath = '${BASE}/' + f
    if not os.path.exists(bpath): print(f + ' baseline-missing'); continue
    b = Image.open(bpath).convert('L').resize((64, 64))
    import numpy as np
    d = float(abs(np.asarray(a, dtype=float) - np.asarray(b, dtype=float)).mean())
    print(f'{f} diff={d:.2f}')
`], { encoding: 'utf8' });
  console.log(py.stdout.trim().split('\n').map(l => '  ' + l).join('\n'));
  step('基準画像との差分', true, '上のdiff値を確認（大きい場合は意図した変更か目視確認）');
}
const failed = results.filter(r => !r.ok);
console.log(`\n=== VERIFY ${failed.length ? 'FAILED: ' + failed.map(f => f.name).join(', ') : 'ALL PASS'} ===`);
process.exit(failed.length ? 1 : 0);
