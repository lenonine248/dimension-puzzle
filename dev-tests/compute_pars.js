/* 全ステージにソルバーを走らせ、最短手数(par)をステージJSONへ焼き込むツール。
   使い方: node dev-tests/compute_pars.js
   ステージの盤面を変更したら必ず再実行し、そのあと python3 build_stages.py を実行すること。 */
const fs=require('fs'),path=require('path');
const H=require(path.join(__dirname,'_helper.js'));
const M=H.loadModules();
const E=M.Engine,Solver=M.Solver;
const worldFromStage=st=>H.worldFromStage(E,st);
const rulesFromStage=H.rulesFromStage;
(async()=>{
  const files=H.allStageFiles();
  let changed=0,fail=[];
  for(const f of files){
    const p=path.join(H.stagesDir(),f), st=JSON.parse(fs.readFileSync(p,'utf8'));
    const r=await Solver.search({mode:'3d',world:worldFromStage(st),dims:st.dims},rulesFromStage(st),
      {stateCap:400000,timeMs:30000,includeSwap:true});
    if(r.status!=='win'){ fail.push(f+':'+r.status); continue; }
    if(st.par!==r.par){ st.par=r.par; fs.writeFileSync(p,JSON.stringify(st,null,0).replace(/","/g,'","')); changed++; }
    console.log(f+': par='+r.par);
  }
  console.log('--- 更新 '+changed+'件'+(fail.length?' / 失敗: '+fail.join(', '):' / 全ステージ解決'));
  process.exit(fail.length?1:0);
})();
