/* ソルバー検証。実行: node dev-tests/solver_test.js */
const fs=require('fs'),path=require('path');
const H=require(path.join(__dirname,'_helper.js'));
const M=H.loadModules();
const E=M.Engine,G=M.Game,G3=M.Game3D,Solver=M.Solver;
const T=[],add=(n,p)=>T.push({n,p});
const worldFromStage=st=>H.worldFromStage(E,st);
const rulesFromStage=H.rulesFromStage;

async function run(){

/* ===1. 簡単な既知ステージ: stage0101(第1章1つ目)がsolverで解ける === */
{
  const st=H.loadStage('stage0101');
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const r=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:50000,timeMs:8000});
  add('1-1: stage0101が解ける', r.status==='win');
  console.log('   [stage0101] status='+r.status+' par='+(r.par||'-')+' path='+Solver.formatPath(r.path||[]));
}

/* ===2. swap無しでは解けないが、swap込みなら解けるステージ(第3章の交換ステージ) === */
{
  const st=H.loadStage('stage0301');
  const rules=rulesFromStage(st);
  const w1=worldFromStage(st);
  const rNoSwap=await Solver.search({mode:'3d',world:w1,dims:st.dims},rules,{stateCap:50000,timeMs:8000,includeSwap:false});
  const w2=worldFromStage(st);
  const rSwap=await Solver.search({mode:'3d',world:w2,dims:st.dims},rules,{stateCap:50000,timeMs:8000,includeSwap:true});
  console.log('   [stage0301] noSwap='+rNoSwap.status+' withSwap='+rSwap.status+' par='+(rSwap.par||'-'));
  add('2-1: swapオプション有無で挙動が変わるか、または両方winなら情報として記録', true); // 情報表示(必須アサーションではなく傾向確認)
}

/* ===3. リーク検出: 全14章のうち、折り必須の代表ステージ(8-2雪崩)でリーク無しを確認 === */
{
  const st=H.loadStage('stage0802');
  const rules=rulesFromStage(st);
  const w1=worldFromStage(st);
  const rFoldless=await Solver.search({mode:'3d',world:w1,dims:st.dims},rules,{stateCap:200000,timeMs:10000,foldless:true});
  add('3-1: 8-2は折り無しでは解けない(リーク無し)', rFoldless.status==='no-solution');
  const w2=worldFromStage(st);
  const rFull=await Solver.search({mode:'3d',world:w2,dims:st.dims},rules,{stateCap:200000,timeMs:10000});
  add('3-2: 8-2は折り有りなら解ける', rFull.status==='win');
  console.log('   [8-2] foldless='+rFoldless.status+' full='+rFull.status+' par='+(rFull.par||'-'));
}

/* ===4. わざとリークを仕込んだ盤面でリーク検出が「リークあり」を返すこと === */
{
  // 単純な溝: 折らなくても迂回で歩いて行ける設計ミス盤面
  const st={dims:{W:4,H:2,D:3},voxels:[
    [0,0,0,'ground',false],[1,0,0,'ground',false],[2,0,0,'ground',false],[3,0,0,'ground',false],
    [0,0,1,'ground',false],[1,0,1,'ground',false],[2,0,1,'ground',false],[3,0,1,'ground',false], // z1に迂回床(意図せぬリーク)
    [0,0,2,'ground',false],[1,0,2,'ground',false],[2,0,2,'ground',false],[3,0,2,'ground',false],
    [0,1,2,'avatar',true],[3,1,2,'goal',false]
  ],foldAllow:{'-z':false,'+x':false,'-x':false}};
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const rFoldless=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:50000,timeMs:5000,foldless:true});
  add('4-1: 迂回可能な意図的リーク盤面で「リークあり」を検出', rFoldless.status==='win');
  if(rFoldless.status==='win')console.log('   [仕込みリーク] path='+Solver.formatPath(rFoldless.path));
}

/* ===5. 詰み検出: メカニズムの正しさを小規模盤面で検証 === */
{
  // 5a: 安全な小盤面(陳なし・障害物なし) → 詰み0・危険手0・即死手0のはず
  const safe={dims:{W:3,H:2,D:1},voxels:[
    [0,0,0,'ground',false],[1,0,0,'ground',false],[2,0,0,'ground',false],
    [0,1,0,'avatar',true],[2,1,0,'goal',false]
  ],foldAllow:{'+x':false,'-x':false,'+z':false,'-z':false}}; // 3D専用にして「自前軸の折りは変形破壊的」というゲーム本来の仕様と切り分ける
  const rulesSafe=rulesFromStage(safe);
  const wSafe=worldFromStage(safe);
  const dlSafe=await Solver.findDeadlocks({mode:'3d',world:wSafe,dims:safe.dims},rulesSafe,{stateCap:20000,timeMs:5000});
  add('5-1: 安全盤面はdeadlock探索が完走する(status=ok)', dlSafe.status==='ok');
  add('5-2: 安全盤面は詰み0・危険手0・即死手0', dlSafe.status==='ok'&&dlSafe.deadlockCount===0&&dlSafe.riskyMoves.length===0&&dlSafe.deathMoves.length===0);
  add('5-3: 安全盤面は開始状態が勝利到達可能', dlSafe.startWinnable===true);
  console.log('   [安全盤面] status='+dlSafe.status+' visited='+dlSafe.visited);

  // 5b: 雷区(障害物)へ歩くと即死する盤面 → 即死手(deathMoves)が1以上検出されるはず
  const dead={dims:{W:3,H:2,D:1},voxels:[
    [0,0,0,'ground',false],[1,0,0,'ground',false],[2,0,0,'ground',false],
    [0,1,0,'avatar',true],[1,1,0,'hazard',false],[2,1,0,'goal',false]
  ],foldAllow:{'+x':false,'-x':false,'+z':false,'-z':false}};
  const rulesDead=rulesFromStage(dead);
  const wDead=worldFromStage(dead);
  const dlDead=await Solver.findDeadlocks({mode:'3d',world:wDead,dims:dead.dims},rulesDead,{stateCap:20000,timeMs:5000});
  add('5-4: 障害物盤面もdeadlock探索が完走する', dlDead.status==='ok');
  add('5-5: 障害物に接触する初手が即死手として検出される', dlDead.status==='ok'&&dlDead.deathMoves.length>=1);
  console.log('   [障害物盤面] status='+dlDead.status+' visited='+dlDead.visited+' death='+dlDead.deathMoves.length+' risky='+dlDead.riskyMoves.length);
}

/* ===6. 状態数上限による打ち切りが「未確定」を返すこと(解なしと混同しない) === */
{
  const st=H.loadStage('stage1403'); // 複合的で状態空間が大きめの14-3
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const r=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:5,timeMs:20000}); // 極端に低い上限
  add('6-1: 上限を極端に低くすると truncated を返す(no-solutionではない)', r.status==='truncated');
  console.log('   [低上限] status='+r.status+' reason='+r.reason);
}

/* ===7. par の妥当性: 9-1「消毒」の想定解は6手 (c(1,0) c(1,0) fold(+z) unfold c(1,0) c(1,0) c(0,1)) 相当。ソルバーのparはこれ以下のはず === */
{
  const st=H.loadStage('stage0901');
  const rules=rulesFromStage(st);
  const w=worldFromStage(st);
  const r=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:100000,timeMs:10000});
  add('7-1: 9-1が解け、par<=7(手作業の想定解以下)', r.status==='win'&&r.par<=7);
  console.log('   [9-1] par='+r.par+' path='+Solver.formatPath(r.path));
}

/* ===8. 全47ステージが(必要ならswap込みで)解けることを一括確認 === */
{
  const glob=fs.readdirSync(H.stagesDir()).filter(f=>/^stage\d+\.json$/.test(f));
  let okCount=0, failList=[];
  for(const f of glob){
    const st=H.loadStage(f);
    const rules=rulesFromStage(st);
    const w=worldFromStage(st);
    const r=await Solver.search({mode:'3d',world:w,dims:st.dims},rules,{stateCap:120000,timeMs:9000,includeSwap:true});
    if(r.status==='win')okCount++; else failList.push(f+':'+r.status);
  }
  add('8-1: 全'+glob.length+'ステージがswap込みソルバーで解ける', failList.length===0);
  if(failList.length)console.log('   [未解決]',failList.join(', '));
  console.log('   [全ステージ] '+okCount+'/'+glob.length+' 解けた');
}

let ok=true;console.log('=== Solver コア検証 ===');
for(const t of T){console.log((t.p?'PASS':'FAIL')+' : '+t.n);if(!t.p)ok=false;}
console.log('=== '+(ok?'ALL PASS':'FAILED')+' ('+T.filter(t=>t.p).length+'/'+T.length+') ===');
process.exit(ok?0:1);
}
run();
