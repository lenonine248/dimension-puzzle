/* 星評価・par・ヒント探索の検証。実行: node dev-tests/score_test.js */
const fs=require('fs'),path=require('path');
const H=require(path.join(__dirname,'_helper.js'));
const M=H.loadModules();
const E=M.Engine,G=M.Game,Solver=M.Solver,Score=M.Score,FOLD=M.FOLD;
const T=[],add=(n,p)=>T.push({n,p});
const worldFromStage=st=>H.worldFromStage(E,st);
const rulesFromStage=H.rulesFromStage;
(async()=>{

/* 1. 星評価の閾値 */
add('Score: par以内で★3', Score.starsFor(5,5)===3&&Score.starsFor(3,5)===3);
add('Score: par+max(2,ceil(par*0.5))以内で★2', Score.starsFor(7,5)===2&&Score.starsFor(8,5)===2&&Score.starsFor(5,3)===2);
add('Score: それ以上は★1', Score.starsFor(9,5)===1&&Score.starsFor(100,5)===1);
add('Score: par不明時は★1', Score.starsFor(10,null)===1&&Score.starsFor(10,undefined)===1);
add('Score: 星文字列', Score.starStr(3)==='★★★'&&Score.starStr(2)==='★★☆'&&Score.starStr(0)==='☆☆☆');

/* 2. 全ステージJSONにparが存在し正の整数 */
{
  const files=fs.readdirSync(H.stagesDir()).filter(f=>/^stage\d+\.json$/.test(f));
  let bad=[];
  for(const f of files){const st=H.loadStage(f);
    if(!(Number.isInteger(st.par)&&st.par>0))bad.push(f);}
  add('par: 全'+files.length+'ステージに正のparが存在', bad.length===0);
  if(bad.length)console.log('   [par欠落]',bad.join(','));
}

/* 3. stages.jsにもparが同梱されている */
{
  const sjs=fs.readFileSync(H.stagesJsPath(),'utf8');
  const n=(sjs.match(/"par":\s*\d+/g)||[]).length;
  add('par: stages.jsに47件同梱', n===47);
}

/* 4. 2Dの途中盤面からの探索(次の一手のコアパス): stage0102を+z折りした直後の2D盤面から解ける */
{
  const st=H.loadStage('stage0102');
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const fold=FOLD['+z'];
  const g=E.compress(w,fold.axis,fold.front);
  E.gravitySettle(g); G.gravityDropAvatars(g);
  const r=await Solver.search({mode:'2d',grid:g,dims:st.dims,foldFront:'+z'},rules,{stateCap:50000,timeMs:8000,includeSwap:true});
  add('hint: 2D途中盤面からの探索が機能する', r.status==='win'&&r.path.length>=1);
  if(r.status==='win')console.log('   [0102折り後の次の一手] '+Solver.shortLabel(r.path[0])+' (par残り'+r.par+')');
}

/* 5. 解けない盤面では no-solution が返り「もう解けません」の分岐に入る */
{
  // ゴールなし盤面(=即lose状態…ではなくゴール0で最初からlose)。代わりに: ゴールが到達不能な閉じ盤面
  const st={dims:{W:3,H:2,D:1},voxels:[
    [0,0,0,'ground',false],[2,0,0,'ground',false],
    [0,1,0,'avatar',true],[2,1,0,'goal',false]
  ],foldAllow:{'+x':false,'-x':false,'+z':false,'-z':false}}; // x1が奈落でゴールに届かない
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const r=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:20000,timeMs:5000,includeSwap:true});
  add('hint: 解けない盤面はno-solution', r.status==='no-solution');
}

let ok=true;console.log('=== Score/par/ヒント検証 ===');
for(const t of T){console.log((t.p?'PASS':'FAIL')+' : '+t.n);if(!t.p)ok=false;}
console.log('=== '+(ok?'ALL PASS':'FAILED')+' ('+T.filter(t=>t.p).length+'/'+T.length+') ===');
process.exit(ok?0:1);
})();
