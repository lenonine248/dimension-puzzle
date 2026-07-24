/* ページ全体の起動スモークテスト（jsdom使用）。
   Engine/Game/Game3D単体テストでは検出できない「スクリプト初期化失敗」「ボタン未配線」
   といった不具合（TDZ由来のReferenceError等）を検出する。
   使い方: npm i jsdom (未インストールなら) → node dev-tests/page_smoke_test.js
   （リポジトリルートで実行。dimension-puzzle-game.html と stages.js を読む） */
let JSDOM;
try{ JSDOM=require('jsdom').JSDOM; }catch(e){
  console.error('jsdomが見つかりません。 npm i jsdom で導入してから実行してください。'); process.exit(1); }
const fs=require('fs');
const path=require('path');
const H=require(path.join(__dirname,'_helper.js'));
let html=fs.readFileSync(H.htmlPath(),'utf8');
const stagesJs=fs.readFileSync(H.stagesJsPath(),'utf8');
html=html.replace('<script src="stages.js"></script>','<script>'+stagesJs+'</script>');

const noop=()=>{};
const dom=new JSDOM(html,{runScripts:'dangerously',resources:'usable',url:'http://localhost/',pretendToBeVisual:true,
  beforeParse(window){
    window.HTMLCanvasElement.prototype.getContext=()=>({
      clearRect:noop,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,fill:noop,
      arc:noop,closePath:noop,save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,rect:noop,clip:noop,
      quadraticCurveTo:noop,bezierCurveTo:noop,ellipse:noop,setTransform:noop,setLineDash:noop,drawImage:noop,
      createRadialGradient(){return{addColorStop:noop};},createLinearGradient(){return{addColorStop:noop};},
      measureText(){return{width:10};},fillText:noop,strokeText:noop,getImageData(){return{data:[]};},putImageData:noop,
      lineWidth:1,strokeStyle:'',fillStyle:'',font:'',textAlign:'',textBaseline:'',globalAlpha:1 });
    window.AudioContext=function(){return{createGain:()=>({connect:noop,gain:{value:0,setValueAtTime:noop,linearRampToValueAtTime:noop,exponentialRampToValueAtTime:noop,cancelScheduledValues:noop}}),
      createOscillator:()=>({connect:noop,start:noop,stop:noop,frequency:{value:0,setValueAtTime:noop},type:'',detune:{value:0,setValueAtTime:noop}}),
      destination:{},currentTime:0,resume(){return Promise.resolve();},state:'running'};};
    window.webkitAudioContext=window.AudioContext;
  }});
const win=dom.window;
const T=[],add=(n,p)=>T.push({n,p});
let scriptErrors=[];
win.addEventListener('error',e=>scriptErrors.push(e.error?(e.error.message):e.message));

setTimeout(()=>{
  const D=win.document, click=el=>el.dispatchEvent(new win.Event('click',{bubbles:true}));

  add('スクリプト初期化エラーが出ない', scriptErrors.length===0);
  if(scriptErrors.length)console.log('   [エラー]',scriptErrors.join(' / '));

  add('STAGESが読み込まれる(47件)', win.STAGES&&Object.keys(win.STAGES).length===47);

  click(D.getElementById('mStage'));
  const sl=D.getElementById('stageList');
  add('ステージ選択: 一覧が描画される(章見出し+本体で28要素)', sl.children.length===28);
  add('ステージ選択: 選択可能なステージが1件以上ある', !!D.querySelector('.sItem:not(.locked)'));

  click(D.getElementById('mOpt'));
  add('オプション: 開くとdisplay=flex', D.getElementById('optOverlay').style.display==='flex');
  click(D.getElementById('optClose'));
  add('オプション: 閉じるボタンでdisplay=none', D.getElementById('optOverlay').style.display==='none');

  click(D.getElementById('mStats'));
  add('記録: 開くとdisplay=flex', D.getElementById('statsOverlay').style.display==='flex');
  add('記録: 内容が描画される', D.getElementById('statsBody').innerHTML.includes('クリア'));
  click(D.getElementById('statsClose'));
  add('記録: 閉じるボタンでdisplay=none', D.getElementById('statsOverlay').style.display==='none');

  click(D.getElementById('mStage'));
  const firstStage=D.querySelector('.sItem:not(.locked)');
  click(firstStage);
  add('ステージ開始: readoutにステージ名が表示される', D.getElementById('readout').innerHTML.length>0);

  let ok=true; console.log('=== ページ起動スモークテスト ===');
  for(const t of T){console.log((t.p?'PASS':'FAIL')+' : '+t.n); if(!t.p)ok=false;}
  console.log('=== '+(ok?'ALL PASS':'FAILED')+' ('+T.filter(t=>t.p).length+'/'+T.length+') ===');
  process.exit(ok?0:1);
},1000);
