/* テスト共通ヘルパー。
   本体HTMLを探し、最後の<script>ブロックを取り出して、
   Engine / Game / Game3D / FOLD / Solver / Score を eval で得る。

   本体HTMLは 'index.html' でも 'dimension-puzzle-game.html' でもよい。
   リポジトリルート・dev-tests/ のどちらから実行しても動く。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = ['index.html', 'dimension-puzzle-game.html'];

function findFile(names, dirs) {
  for (const d of dirs) for (const n of names) {
    const p = path.join(d, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** 本体HTMLの絶対パス */
function htmlPath() {
  const p = findFile(CANDIDATES, [ROOT, process.cwd()]);
  if (!p) throw new Error('本体HTMLが見つかりません（index.html / dimension-puzzle-game.html）');
  return p;
}

/** stages.js の絶対パス */
function stagesJsPath() {
  const p = findFile(['stages.js'], [ROOT, process.cwd()]);
  if (!p) throw new Error('stages.js が見つかりません（build_stages.py を実行してください）');
  return p;
}

/** stages/ ディレクトリの絶対パス */
function stagesDir() {
  for (const d of [ROOT, process.cwd()]) {
    const p = path.join(d, 'stages');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('stages/ が見つかりません');
}

/** 本体HTMLから最後の<script>ブロックの中身を返す */
function extractScript() {
  const html = fs.readFileSync(htmlPath(), 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (!blocks.length) throw new Error('<script>ブロックが見つかりません');
  return blocks[blocks.length - 1];
}

/**
 * ロジック層のモジュールを取り出す。
 * 'const Engine=' から '/* ===== APP' までを eval する（この2つの目印に依存）。
 */
function loadModules() {
  const js = extractScript();
  const s = js.indexOf('const Engine=');
  const e = js.indexOf('/* ===== APP');
  if (s < 0 || e < 0 || e <= s) {
    throw new Error('ロジック層の目印が見つかりません（"const Engine=" / "/* ===== APP" を消さないこと）');
  }
  const sandbox = {};
  const fn = new Function(js.slice(s, e) + '\nreturn {Engine,Game,Game3D,FOLD,Solver,Score};');
  return fn.call(sandbox);
}

/** ステージJSONを1件読む（例: loadStage('stage0902')） */
function loadStage(id) {
  const f = id.endsWith('.json') ? id : id + '.json';
  return JSON.parse(fs.readFileSync(path.join(stagesDir(), f), 'utf8'));
}

/** 全ステージJSONのファイル名（ソート済み） */
function allStageFiles() {
  return fs.readdirSync(stagesDir()).filter(f => /^stage\d+\.json$/.test(f)).sort();
}

/** ステージJSONから3Dワールドを構築（assignIds→gravitySettle3D の順を厳守） */
function worldFromStage(Engine, st) {
  const d = st.dims;
  const w = Engine.makeWorld(d.W, d.H, d.D, st.walls === false);
  for (const v of st.voxels) {
    const [x, y, z, t, g, grp] = v;
    Engine.setVox(w, x, y, z, t, !!g, 0, (t === 'push' && grp != null) ? grp : null);
  }
  Engine.assignIds(w);
  Engine.gravitySettle3D(w);
  return w;
}

/** ステージJSONからルールを構築 */
function rulesFromStage(st) {
  const fa = st && st.foldAllow;
  const out = { '+x': true, '-x': true, '+z': true, '-z': true };
  if (fa) for (const k in out) out[k] = fa[k] !== false;
  return { foldAllow: out, swapAllow: !st || st.swapAllow !== false };
}

/** 簡易テストランナー */
function runner(title) {
  const T = [];
  return {
    add: (name, pass) => T.push({ name, pass }),
    log: (...a) => console.log('  ', ...a),
    done() {
      let ok = true;
      console.log('=== ' + title + ' ===');
      for (const t of T) { console.log((t.pass ? 'PASS' : 'FAIL') + ' : ' + t.name); if (!t.pass) ok = false; }
      console.log('=== ' + (ok ? 'ALL PASS' : 'FAILED') + ' (' + T.filter(t => t.pass).length + '/' + T.length + ') ===');
      process.exit(ok ? 0 : 1);
    }
  };
}

module.exports = { ROOT, htmlPath, stagesJsPath, stagesDir, extractScript, loadModules,
                   loadStage, allStageFiles, worldFromStage, rulesFromStage, runner };
