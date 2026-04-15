// ======================================================
// results.js — 시험결과 입력/판정
// ======================================================

// ══════════════════════════════════════════════════════
// 시험 결과 탭
// ══════════════════════════════════════════════════════

let rsCurrentOrder = null;
let rsSelectedKey = null; // 현재 선택된 "maker_color"

// 결과 저장: order.rsData[maker_color][secName][itemName] = {startDate, endDate, result, note}
// result: 'pass' | 'fail' | '' (빈 값 = 미입력)

function rsInit(){
  const sel = document.getElementById('rs-year-sel');
  if(!sel) return;
  // 연도 옵션 동기화
  sel.innerHTML = '';
  Object.keys(activeDB().orders).sort().reverse().forEach(yr=>{
    const opt=document.createElement('option');
    opt.value=yr; opt.textContent=yr+'년';
    if(yr===CY) opt.selected=true;
    sel.appendChild(opt);
  });
  rsChangeYear(CY);
  // 의뢰관리에서 선택된 차수 자동 연결
  if(selectedOrderId){
    const oSel=document.getElementById('rs-order-sel');
    [...(oSel?.options||[])].forEach(o=>{ if(o.value===selectedOrderId) o.selected=true; });
    rsSelectOrder(selectedOrderId);
  }
}

function rsChangeYear(yr){
  const sel=document.getElementById('rs-order-sel');
  if(!sel) return;
  sel.innerHTML='<option value="">-- 차수 선택 --</option>';
  (activeDB().orders[yr]||[]).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.id;
    opt.textContent=`${o.cha} — ${(o.purpose||'').slice(0,20)}`;
    sel.appendChild(opt);
  });
  rsCurrentOrder=null; rsSelectedKey=null;
  const list=document.getElementById('rs-list');
  if(list) list.innerHTML='<div style="text-align:center;padding:40px 20px;color:var(--tx3);font-size:13px">차수를 선택하세요</div>';
  const detail=document.getElementById('rs-detail');
  if(detail) detail.innerHTML='<div style="text-align:center;padding:60px 20px;color:var(--tx3)"><div>좌측에서 색상을 선택하세요</div></div>';
}

function rsSelectOrder(orderId){
  if(!orderId){ rsCurrentOrder=null; rsSelectedKey=null; return; }
  const yr=document.getElementById('rs-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(!order) return;
  rsCurrentOrder=order;
  if(!order.rsData) order.rsData={};
  rsSelectedKey=null;
  rsRenderList(order);
  document.getElementById('rs-detail').innerHTML='<div style="text-align:center;padding:60px 20px;color:var(--tx3)"><div>좌측에서 색상을 선택하세요</div></div>';
}

function rsRenderList(order){
  const listEl=document.getElementById('rs-list');
  if(!listEl) return;

  // 업체별로 그룹
  const makers=[...new Set(order.specimens.map(sp=>sp.maker))];
  let html='';
  makers.forEach(maker=>{
    const sps=order.specimens.filter(sp=>sp.maker===maker);
    html+=`<div style="font-size:10px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;padding:6px 8px 3px">${maker}</div>`;
    sps.forEach(sp=>{
      const key=`${sp.maker}_${sp.color}`;
      const rsData=order.rsData[key]||{};
      // 진행 현황 계산
      const {total,done,ng}=rsCountProgress(sp,rsData);
      const pct=total?Math.round(done/total*100):0;
      const isSelected=rsSelectedKey===key;
      const statusColor=ng>0?'var(--r)':done===total&&total>0?'var(--g)':'var(--tx3)';
      const statusLabel=ng>0?`NG ${ng}건`:done===total&&total>0?'완료':`${done}/${total}`;

      html+=`<div onclick="rsSelectSpec('${key}')"
        style="padding:10px 12px;border-radius:8px;margin-bottom:4px;cursor:pointer;border:1px solid ${isSelected?'var(--b)':'var(--border)'};background:${isSelected?'var(--bbg)':'var(--bg2)'};transition:.15s">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${isSelected?'var(--b)':'var(--tx)'}">${sp.color}</span>
          <span style="font-size:10px;font-weight:700;color:${statusColor};margin-left:auto;background:${ng>0?'var(--rbg)':done===total&&total>0?'var(--gbg)':'var(--bg3)'};padding:2px 6px;border-radius:10px">${statusLabel}</span>
        </div>
        <div style="height:3px;background:var(--bg4);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${ng>0?'var(--r)':'var(--g)'};transition:width .3s;border-radius:2px"></div>
        </div>
        <div style="font-size:10px;color:var(--tx3);margin-top:3px">${sp.sections.map(s=>s.name).join(' · ')}</div>
      </div>`;
    });
  });
  listEl.innerHTML=html;
}

// ── 항목별 입력 정의
const RS_INPUT = {
  // ── 차체도장
  '부착성':         {type:'adhesion'},
  '재도장성':       {type:'adhesion'},
  '층간부착성':     {type:'adhesion'},
  'O/B층간부착성':  {type:'adhesion'},
  '내충격성':       {type:'impact'},
  '경도':           {type:'hardness'},
  '내수성':         {type:'water'},
  '내습성':         {type:'water'},
  '내스크래치성':   {type:'scratch'},
  '내치핑성':       {type:'chipping'},
  '내염수분무성':   {type:'saltspray'},
  'ATR분析':        {type:'atr'},
  '도막두께':       {type:'fromMiddle'},
  '도막두께-전처리':{type:'wheelThickness'},
  '광택':           {type:'fromMiddle'},
  // ── 휠도장
  'CASS시험':       {type:'cass'},
  'CASS 시험':      {type:'cass'},
  'IR분석':         {type:'ir'},
  // ── DGU KNIFE CUT
  'KNIFE CUT_상태':      {type:'knifecut'},
  'KNIFE CUT_내열':      {type:'knifecut'},
  'KNIFE CUT_내수':      {type:'knifecut'},
  'KNIFE CUT_내약품':    {type:'knifecut'},
  'KNIFE CUT_내열CYCLE': {type:'knifecut'},
  // ── DGU 전단강도
  '전단강도_상태':       {type:'shear'},
  '전단강도_내열':       {type:'shear'},
  '전단강도_내수':       {type:'shear'},
  '전단강도_내약품':     {type:'shear'},
  '전단강도_내열CYCLE':  {type:'shear'},
  '전단모듈러스':        {type:'shearModulus'},
  // ── DGU 경도 (Shore A)
  '경도_상태':           {type:'dguHardness'},
  '경도_내열':           {type:'dguHardness'},
  '경도_내수':           {type:'dguHardness'},
  // ── DGU 실러물성
  '인장강도':            {type:'tensile'},
  '신율':                {type:'elongation'},
  '인열강도':            {type:'tear'},
};

const ADHESION_OPTS=['','M-1.0','M-1.5','M-2.0','M-2.5','M-3.0','M-3.5','M-4.0','M-4.5','M-5.0','M-5.5','M-6.0'];
const HARDNESS_OPTS=['','9H','8H','7H','6H','5H','4H','3H','2H','H','F','HB','B','2B','3B','4B','5B','6B'];
const IMPACT_VALS=['10','20','30','40','50'];
const CHIPPING_OPTS=['','1급','1.5급','2급','2.5급','3급','3.5급','4급','4.5급','5급'];

// 경도 숫자 변환 (판정용)
const HARDNESS_ORDER=['9H','8H','7H','6H','5H','4H','3H','2H','H','F','HB','B','2B','3B','4B','5B','6B'];
function hardnessGte(val,min){return HARDNESS_ORDER.indexOf(val)<=HARDNESS_ORDER.indexOf(min);}

// 부착성 등급 숫자 변환
function adhesionNum(s){
  if(!s) return 0;
  const m=s.match(/M-(\d+\.?\d*)/);
  return m?parseFloat(m[1]):0;
}

// 자동판정 (규격 기준)
function rsAutoJudge(d,itemName,secName){
  const v=d.value||{};
  let j='';
  switch(RS_INPUT[itemName]?.type){
    case 'adhesion':
      // 부착성 합격: M-1.0 ~ M-2.5 (M-3.0부터 불합격)
      if(v.grade) j=adhesionNum(v.grade)<=2.5&&adhesionNum(v.grade)>=1.0?'pass':'fail';
      break;
    case 'impact':
      if(v.val) j=parseInt(v.val)>=20?'pass':'fail';
      break;
    case 'hardness':
      if(v.grade) j=hardnessGte(v.grade,'B')?'pass':'fail';
      break;
    case 'water':
      if(v.appearance){
        const appOk=v.appearance==='이상없음';
        const adhOk=!v.adhesion||adhesionNum(v.adhesion)<=2.5;
        j=appOk&&adhOk?'pass':'fail';
      }
      break;
    case 'chipping':
      // 내치핑성 합격: 1급 ~ 3급
      if(v.grade){const n=parseFloat(v.grade); j=n<=3?'pass':'fail';}
      break;
    case 'saltspray':
      if(v.appearance||v.peeling){
        const appOk=!v.appearance||v.appearance==='이상없음';
        const peel=v.peeling==='<1'?0:parseFloat(v.peeling)||0;
        const peelOk=v.peeling==='<1'||peel<3;
        j=appOk&&peelOk?'pass':'fail';
      }
      break;
    case 'cass':
      // CASS 합격: 240Hr 후 균열/박리/부식/부풀음 없을 것
      if(v.final) j=v.final==='이상없음'?'pass':'fail';
      break;
    case 'scratch':
      // 광택유지율은 프로젝트별 기준 — 자동판정 없이 수동
      break;
    case 'ir':
    case 'wheelThickness':
    case 'atr':
      break;
    // ── DGU 자동판정
    case 'knifecut':
      // KNIFE CUT: Cf% ≥ 90% → PASS (응집파괴율)
      if(v.cf !== undefined && v.cf !== ''){
        const cf = parseFloat(v.cf);
        if(!isNaN(cf)) j = cf >= 90 ? 'pass' : 'fail';
      }
      break;
    case 'shear':
      // 전단강도: 3 MPa 이상 → PASS
      if(v.avg !== undefined && v.avg !== ''){
        const avg = parseFloat(v.avg);
        if(!isNaN(avg)) j = avg >= 3 ? 'pass' : 'fail';
      }
      break;
    case 'shearModulus':
    case 'tensile':
    case 'elongation':
      // 참고치 — 자동판정 없음
      break;
    case 'tear':
      // 인열강도: 15 N/mm 이상 → PASS
      if(v.avg !== undefined && v.avg !== ''){
        const avg = parseFloat(v.avg);
        if(!isNaN(avg)) j = avg >= 15 ? 'pass' : 'fail';
      }
      break;
    case 'dguHardness':
      // 경도: 45~70 Hs → PASS
      if(v.avg !== undefined && v.avg !== ''){
        const avg = parseFloat(v.avg);
        if(!isNaN(avg)) j = (avg >= 45 && avg <= 70) ? 'pass' : 'fail';
      }
      break;
  }
  if(j) d.judge=j;
}

function rsGetInputType(itemName){return RS_INPUT[itemName]||{type:'text'};}

function rsCountProgress(sp,rsData){
  let total=0,done=0,ng=0;
  sp.sections.forEach(sec=>{
    sec.items.filter(it=>it.checked).forEach(it=>{
      total++;
      const r=(rsData[sec.name]||{})[it.name];
      const v=r?.value;
      const hasVal=v&&(typeof v==='string'?v.trim()!=='':Object.keys(v).some(k=>v[k]!==''&&v[k]!=null));
      if(hasVal||r?.judge) done++;
      if(r?.judge==='fail') ng++;
    });
  });
  return {total,done,ng};
}

function rsSelectSpec(key){
  rsSelectedKey=key;
  if(rsCurrentOrder) rsRenderList(rsCurrentOrder);
  rsRenderDetail(key);
}

function rsRenderDetail(key){
  if(!rsCurrentOrder) return;
  const order=rsCurrentOrder;
  if(!order.rsData) order.rsData={};
  if(!order.rsData[key]) order.rsData[key]={};
  const rsData=order.rsData[key];

  const parts=key.split('_'); const color=parts[parts.length-1]; const maker=parts.slice(0,-1).join('_');
  const sp=order.specimens.find(s=>s.maker===maker&&s.color===color);
  if(!sp){document.getElementById('rs-detail').innerHTML='<div style="padding:20px;color:var(--r)">시편 정보를 찾을 수 없습니다</div>';return;}

  let html=`<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
    <span style="font-size:11px;font-weight:700;color:var(--tx3)">${maker}</span>
    <span style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--tx)">${color}</span>
    <button onclick="rsClearAll('${key}')" class="btn sm" style="margin-left:auto;font-size:11px">전체 초기화</button>
  </div>`;

  sp.sections.forEach(sec=>{
    const items=sec.items.filter(it=>it.checked);
    if(!items.length) return;
    if(!rsData[sec.name]) rsData[sec.name]={};
    const secData=rsData[sec.name];
    const secDone=items.filter(it=>{const r=secData[it.name];return r?.judge||Object.values(r?.value||{}).some(v=>v!=='');}).length;
    const secNg=items.filter(it=>secData[it.name]?.judge==='fail').length;
    const statusColor=secNg>0?'var(--r)':secDone===items.length&&items.length>0?'var(--g)':'var(--tx3)';

    const rows=items.map(it=>{
      if(!secData[it.name]) secData[it.name]={value:{},judge:'',note:''};
      const d=secData[it.name];
      if(typeof d.value!=='object'||Array.isArray(d.value)) d.value={};
      const inp=rsGetInputType(it.name);
      const cell=rsBuildCell(order.id,key,sec.name,it.name,inp,d);
      const pass=d.judge==='pass'; const fail=d.judge==='fail';
      return `<tr>
        <td style="padding:7px 10px;border-bottom:1px solid var(--border);font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap">${it.name}</td>
        <td style="padding:5px 8px;border-bottom:1px solid var(--border)">${cell}</td>
        <td style="padding:5px 8px;border-bottom:1px solid var(--border);text-align:center;white-space:nowrap" id="rs-judge-${order.id}-${key}-${sec.name}-${it.name}">
          <div style="display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden">
            <button onclick="rsSetJudge('${order.id}','${key}','${sec.name}','${it.name}','pass')"
              style="padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:var(--sans);background:${pass?'var(--g)':'var(--bg3)'};color:${pass?'#fff':'var(--tx3)'}">PASS</button>
            <button onclick="rsSetJudge('${order.id}','${key}','${sec.name}','${it.name}','fail')"
              style="padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;border:none;border-left:1px solid var(--border);font-family:var(--sans);background:${fail?'var(--r)':'var(--bg3)'};color:${fail?'#fff':'var(--tx3)'}">FAIL</button>
            <button onclick="rsSetJudge('${order.id}','${key}','${sec.name}','${it.name}','')"
              style="padding:3px 7px;font-size:11px;cursor:pointer;border:none;border-left:1px solid var(--border);font-family:var(--sans);background:var(--bg3);color:var(--tx3)">✕</button>
          </div>
        </td>
        <td style="padding:5px 8px;border-bottom:1px solid var(--border)">
          <input type="text" value="${(d.note||'').replace(/"/g,'&quot;')}" placeholder="비고"
            style="width:100%;padding:3px 6px;font-size:11px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--tx);outline:none;min-width:80px"
            onchange="rsUpdateField('${order.id}','${key}','${sec.name}','${it.name}','note',this.value)">
        </td>
      </tr>`;
    }).join('');

    html+=`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;overflow:hidden">
      <div style="padding:9px 14px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <span style="font-size:13px;font-weight:700;color:var(--tx)">${sec.name}</span>
        <span style="font-size:11px;font-weight:700;color:${statusColor};margin-left:auto">${secNg>0?`NG ${secNg}건`:secDone===items.length&&items.length>0?'✓ 완료':`${secDone}/${items.length}`}</span>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg4)">
          <th style="padding:6px 10px;font-size:11px;font-weight:700;color:var(--tx3);text-align:left;border-bottom:1px solid var(--border);white-space:nowrap">시험항목</th>
          <th style="padding:6px 10px;font-size:11px;font-weight:700;color:var(--tx3);text-align:left;border-bottom:1px solid var(--border)">측정값 / 결과</th>
          <th style="padding:6px 10px;font-size:11px;font-weight:700;color:var(--tx3);text-align:center;border-bottom:1px solid var(--border)">판정</th>
          <th style="padding:6px 10px;font-size:11px;font-weight:700;color:var(--tx3);text-align:left;border-bottom:1px solid var(--border)">비고</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  });
  document.getElementById('rs-detail').innerHTML=html;
}

function rsBuildCell(orderId,key,secName,itemName,inp,d){
  const v=d.value||{};
  const selOpt=(opts,cur)=>opts.map(o=>`<option value="${o}" ${o===cur?'selected':''}>${o||'선택'}</option>`).join('');
  const base='padding:4px 7px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--tx);outline:none';
  const btnBase=`padding:4px 10px;font-size:12px;font-family:var(--mono);cursor:pointer;border:1px solid var(--border);border-radius:4px;transition:.12s`;

  switch(inp.type){
    case 'fromMiddle': return rsGetMiddleVal(orderId,key,secName,itemName);

    case 'adhesion':
      return `<select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','grade',this.value)">${selOpt(ADHESION_OPTS,v.grade||'')}</select>`;

    case 'impact':
      return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
        ${IMPACT_VALS.map(o=>{
          const sel=v.val===o;
          return `<button onclick="rsSetImpact('${orderId}','${key}','${secName}','${itemName}','${o}')"
            style="${btnBase};background:${sel?'var(--bbg)':'var(--bg3)'};border-color:${sel?'var(--b)':'var(--border)'};color:${sel?'var(--b)':'var(--tx2)'};font-weight:${sel?'700':'400'}">${o}</button>`;
        }).join('')}
        <span style="font-size:10px;color:var(--tx3)">cm</span>
      </div>`;

    case 'hardness':
      return `<select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','grade',this.value)">${selOpt(HARDNESS_OPTS,v.grade||'')}</select>`;

    case 'water':
      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','appearance',this.value)">
          <option value="" ${!v.appearance?'selected':''}>외관 선택</option>
          <option value="이상없음" ${v.appearance==='이상없음'?'selected':''}>이상없음</option>
          <option value="이상있음" ${v.appearance==='이상있음'?'selected':''}>이상있음</option>
        </select>
        <span style="font-size:10px;color:var(--tx3)">부착성</span>
        <select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','adhesion',this.value)">${selOpt(ADHESION_OPTS,v.adhesion||'')}</select>
      </div>`;

    case 'scratch':{
      // 초기값: 중간결과 광택값 자동 연동
      const yr=document.getElementById('rs-year-sel')?.value||CY;
      const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
      const pts=key.split('_'); const cl=pts[pts.length-1]; const mk=pts.slice(0,-1).join('_');
      const glossKey=`gloss_${mk}_${cl}_유광`;
      const glossVal=order?.tkData?.[glossKey]||'';
      // 초기값이 없으면 중간결과에서 가져와 자동 세팅
      if(!v.before&&glossVal) v.before=glossVal;
      // 광택유지율 자동계산 (24h후/초기 × 100)
      const before=parseFloat(v.before||0);
      const h24=parseFloat(v.h24||0);
      const retention=before&&h24?Math.round(h24/before*100):'';
      if(retention) v.retention=String(retention);
      const inpS=base+';width:56px;text-align:center';
      return `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:flex-end">
        ${[
          {f:'before',l:'초기'},
          {f:'after', l:'시험후'},
          {f:'wash',  l:'세척후'},
          {f:'h24',   l:'24h후'},
        ].map(({f,l})=>`<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:9px;color:var(--tx3)">${l}</span>
          <input type="number" step="0.1" value="${v[f]||''}" placeholder="—" style="${inpS}"
            ${f==='before'?`title="초기값: 중간결과 광택 자동 연동"`:''}
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','${f}',this.value)">
        </div>`).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
          <span style="font-size:9px;color:var(--tx3)">유지율</span>
          <div style="display:flex;align-items:center;gap:2px">
            <input type="number" step="0.1" value="${retention||''}" placeholder="자동" style="${inpS};background:var(--bg4);color:var(--b)" readonly>
            <span style="font-size:10px;color:var(--tx3)">%</span>
          </div>
        </div>
      </div>`;}

    case 'chipping':
      return `<select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','grade',this.value)">${selOpt(CHIPPING_OPTS,v.grade||'')}</select>`;

    case 'saltspray':
      return `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','appearance',this.value)">
          <option value="" ${!v.appearance?'selected':''}>외관 선택</option>
          <option value="이상없음" ${v.appearance==='이상없음'?'selected':''}>이상없음</option>
          <option value="이상있음" ${v.appearance==='이상있음'?'selected':''}>이상있음</option>
        </select>
        <span style="font-size:10px;color:var(--tx3);white-space:nowrap">편측박리</span>
        <button onclick="rsSetPeeling('${orderId}','${key}','${secName}','${itemName}','<1')"
          style="${btnBase};background:${v.peeling==='<1'?'var(--gbg)':'var(--bg3)'};border-color:${v.peeling==='<1'?'var(--g)':'var(--border)'};color:${v.peeling==='<1'?'var(--g)':'var(--tx3)'};font-size:11px">↓1mm</button>
        <input type="number" step="0.5" min="1" value="${v.peeling&&v.peeling!=='<1'?v.peeling:''}" placeholder="mm"
          style="${base};width:60px;text-align:center"
          oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','peeling',this.value)">
        <span style="font-size:10px;color:var(--tx3)">mm</span>
      </div>`;

    case 'atr': return rsGetAtrStatus(orderId,key);

    case 'wheelThickness':
      // 휠도장 도막두께: 층별 직접 입력 (전착/하도/중도/상도/클리어)
      return `<div style="display:flex;flex-wrap:wrap;gap:5px;align-items:flex-end">
        ${[{f:'전착',l:'전착'},{f:'하도',l:'하도'},{f:'중도',l:'중도'},{f:'상도',l:'상도'},{f:'클리어',l:'클리어'}].map(({f,l})=>`
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <span style="font-size:9px;color:var(--tx3)">${l}</span>
            <div style="display:flex;align-items:center;gap:1px">
              <input type="number" step="0.1" value="${v[f]||''}" placeholder="—"
                style="${base};width:48px;text-align:center"
                oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','${f}',this.value)">
              <span style="font-size:9px;color:var(--tx3)">µm</span>
            </div>
          </div>`).join('')}
      </div>`;

    case 'cass':
      // CASS 시험: 외관 이상없음/있음 + 120Hr 중간점검
      return `<div style="display:flex;flex-direction:column;gap:5px">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--tx3);white-space:nowrap">120Hr</span>
          <select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','mid',this.value)">
            <option value="" ${!v.mid?'selected':''}>중간점검</option>
            <option value="이상없음" ${v.mid==='이상없음'?'selected':''}>이상없음</option>
            <option value="이상있음" ${v.mid==='이상있음'?'selected':''}>이상있음</option>
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--tx3);white-space:nowrap">240Hr</span>
          <select style="${base};cursor:pointer" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','final',this.value)">
            <option value="" ${!v.final?'selected':''}>최종결과</option>
            <option value="이상없음" ${v.final==='이상없음'?'selected':''}>이상없음</option>
            <option value="이상있음" ${v.final==='이상있음'?'selected':''}>이상있음</option>
          </select>
        </div>
      </div>`;

    case 'ir':
      return rsGetAtrStatus(orderId,key);

    // ── DGU: KNIFE CUT (Cf% / SAf% 입력)
    case 'knifecut':{
      const cf  = v.cf  !== undefined ? v.cf  : '';
      const saf = v.saf !== undefined ? v.saf : '';
      const cfNum = parseFloat(cf);
      const judgeColor = !isNaN(cfNum) ? (cfNum>=90?'var(--g)':'var(--r)') : 'var(--tx3)';
      return `<div style="display:flex;flex-direction:column;gap:4px">
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--tx3);width:28px">Cf%</span>
          <input type="number" min="0" max="100" step="1" value="${cf}" placeholder="—"
            style="${base};width:60px;text-align:center"
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','cf',this.value)">
          <span style="font-size:11px;font-family:var(--mono);color:${judgeColor}">${!isNaN(cfNum)?cfNum+'%':''}</span>
        </div>
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:10px;color:var(--tx3);width:28px">SAf%</span>
          <input type="number" min="0" max="100" step="1" value="${saf}" placeholder="—"
            style="${base};width:60px;text-align:center"
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','saf',this.value)">
        </div>
        <div style="font-size:9px;color:var(--tx3)">합계: ${!isNaN(cfNum)&&saf!==''?Math.round(cfNum+(parseFloat(saf)||0))+'%':'—'}</div>
      </div>`;}

    // ── DGU: 전단강도 (MPa, 3개 시편 + 평균)
    case 'shear':
    case 'shearModulus':{
      const isModulus = type==='shearModulus';
      const spec = isModulus ? null : 3;
      const vals = ['1','2','3'].map(i=>({k:i, val: v[i]!==undefined?v[i]:''}));
      const avg = v.avg !== undefined ? v.avg : '';
      const avgNum = parseFloat(avg);
      const judgeColor = !isModulus && !isNaN(avgNum) ? (avgNum>=3?'var(--g)':'var(--r)') : 'var(--tx3)';
      return `<div style="display:flex;flex-direction:column;gap:3px">
        ${vals.map(({k,val})=>`<div style="display:flex;align-items:center;gap:3px">
          <span style="font-size:10px;color:var(--tx3);width:12px">${k}</span>
          <input type="number" step="0.01" value="${val}" placeholder="—"
            style="${base};width:65px;text-align:center"
            oninput="rsDguAutoAvg('${orderId}','${key}','${secName}','${itemName}',this,'${k}')">
          <span style="font-size:9px;color:var(--tx3)">MPa</span>
        </div>`).join('')}
        <div style="display:flex;align-items:center;gap:3px;border-top:1px solid var(--border);padding-top:2px">
          <span style="font-size:10px;color:var(--tx2);width:12px">평균</span>
          <input type="number" step="0.01" value="${avg}" placeholder="—"
            style="${base};width:65px;text-align:center;font-weight:700"
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','avg',this.value)">
          <span style="font-size:11px;font-family:var(--mono);color:${judgeColor}">${!isNaN(avgNum)?avgNum+'MPa':''}</span>
        </div>
      </div>`;}

    // ── DGU: 경도 (Shore A, 5회 평균)
    case 'dguHardness':{
      const hvals = ['1','2','3','4','5'].map(i=>({k:i, val:v[i]!==undefined?v[i]:''}));
      const havg = v.avg !== undefined ? v.avg : '';
      const havgNum = parseFloat(havg);
      const hjColor = !isNaN(havgNum) ? (havgNum>=45&&havgNum<=70?'var(--g)':'var(--r)') : 'var(--tx3)';
      return `<div style="display:flex;flex-wrap:wrap;gap:3px;align-items:flex-end">
        ${hvals.map(({k,val})=>`<div style="display:flex;flex-direction:column;align-items:center;gap:1px">
          <span style="font-size:9px;color:var(--tx3)">${k}</span>
          <input type="number" step="0.5" value="${val}" placeholder="—"
            style="${base};width:44px;text-align:center"
            oninput="rsDguAutoAvg('${orderId}','${key}','${secName}','${itemName}',this,'${k}')">
        </div>`).join('')}
        <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
          <span style="font-size:9px;color:var(--tx2)">평균</span>
          <input type="number" step="0.5" value="${havg}" placeholder="—"
            style="${base};width:50px;text-align:center;font-weight:700;border-color:var(--b)"
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','avg',this.value)">
        </div>
        <span style="font-size:11px;font-family:var(--mono);color:${hjColor}">${!isNaN(havgNum)?havgNum+'Hs':''}</span>
      </div>`;}

    // ── DGU: 인장강도/신율/인열강도 (3개 시편 + 평균)
    case 'tensile':
    case 'elongation':
    case 'tear':{
      const tunit = type==='tensile'?'MPa':type==='elongation'?'%':'N/mm';
      const tspec = type==='tear' ? 15 : null;
      const tvals = ['1','2','3'].map(i=>({k:i, val:v[i]!==undefined?v[i]:''}));
      const tavg = v.avg !== undefined ? v.avg : '';
      const tavgNum = parseFloat(tavg);
      const tjColor = tspec && !isNaN(tavgNum) ? (tavgNum>=tspec?'var(--g)':'var(--r)') : 'var(--tx3)';
      return `<div style="display:flex;flex-direction:column;gap:3px">
        ${tvals.map(({k,val})=>`<div style="display:flex;align-items:center;gap:3px">
          <span style="font-size:10px;color:var(--tx3);width:12px">${k}</span>
          <input type="number" step="0.1" value="${val}" placeholder="—"
            style="${base};width:65px;text-align:center"
            oninput="rsDguAutoAvg('${orderId}','${key}','${secName}','${itemName}',this,'${k}')">
          <span style="font-size:9px;color:var(--tx3)">${tunit}</span>
        </div>`).join('')}
        <div style="display:flex;align-items:center;gap:3px;border-top:1px solid var(--border);padding-top:2px">
          <span style="font-size:10px;color:var(--tx2);width:12px">평균</span>
          <input type="number" step="0.1" value="${tavg}" placeholder="—"
            style="${base};width:65px;text-align:center;font-weight:700"
            oninput="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','avg',this.value)">
          <span style="font-size:11px;font-family:var(--mono);color:${tjColor}">${!isNaN(tavgNum)?tavgNum+tunit:''}</span>
        </div>
      </div>`;}

    default:
      return `<input type="text" value="${typeof v==='string'?v.replace(/"/g,'&quot;'):''}" placeholder="입력"
        style="${base};width:160px" onchange="rsUpdateVal('${orderId}','${key}','${secName}','${itemName}','text',this.value)">`;
  }
}

// 내충격성 버튼 (DOM 직접 업데이트)
function rsSetImpact(orderId,key,secName,itemName,val){
  rsUpdateVal(orderId,key,secName,itemName,'val',val);
}

// DGU 시편 입력 → 평균 자동계산
function rsDguAutoAvg(orderId, key, secName, itemName, inputEl, idx){
  rsUpdateVal(orderId, key, secName, itemName, idx, inputEl.value);
  // 같은 셀 안에서 숫자 입력란 모두 찾아서 평균 계산
  const cell = inputEl.closest('[data-rs-cell]') || inputEl.closest('div');
  const numInputs = [...(cell?.querySelectorAll('input[type="number"]')||[])].slice(0,-1); // 마지막은 평균 입력
  const vals = numInputs.map(i=>parseFloat(i.value)).filter(v=>!isNaN(v));
  if(vals.length){
    const avg = (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(2);
    const avgInput = cell?.querySelector('input[type="number"]:last-of-type');
    if(avgInput && avgInput!==inputEl){
      avgInput.value = avg;
      rsUpdateVal(orderId, key, secName, itemName, 'avg', avg);
    }
  }
}

// 내염수분무성 1mm 미만 버튼
function rsSetPeeling(orderId,key,secName,itemName,val){
  rsUpdateVal(orderId,key,secName,itemName,'peeling',val);
}

function rsGetMiddleVal(orderId,key,secName,itemName){
  const yr=document.getElementById('rs-year-sel')?.value||CY;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(!order||!order.tkData) return '<span style="color:var(--tx3);font-size:11px">중간결과 없음</span>';
  const pts=key.split('_'); const cl=pts[pts.length-1]; const mk=pts.slice(0,-1).join('_');
  if(itemName==='도막두께'){
    const tkKeys=Object.keys(order.tkData).filter(k=>k.startsWith(`tk_${mk}_${cl}_`)&&k.endsWith('_CLEAR'));
    const vals=tkKeys.flatMap(k=>(order.tkData[k]||'').split('/').map(v=>parseFloat(v)).filter(v=>!isNaN(v)));
    if(!vals.length) return '<span style="color:var(--tx3);font-size:11px">미입력</span>';
    const avg=(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
    return `<span style="font-family:var(--mono);font-size:12px;color:var(--tx)">${avg} µm</span>`;
  }
  if(itemName==='광택'){
    const gk=`gloss_${mk}_${cl}_유광`;
    const gv=order.tkData[gk];
    return gv?`<span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--tx)">${gv} GU</span>`:'<span style="color:var(--tx3);font-size:11px">미입력</span>';
  }
  return '<span style="color:var(--tx3);font-size:11px">—</span>';
}

function rsGetAtrStatus(orderId,key){
  const yr=document.getElementById('rs-year-sel')?.value||CY;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(!order||!order.tkData) return '<span style="color:var(--tx3);font-size:11px">미업로드</span>';
  const pts=key.split('_'); const cl=pts[pts.length-1]; const mk=pts.slice(0,-1).join('_');
  const atrKey=`atr_${mk}_${cl}`;
  const files=order.tkData[atrKey]||[];
  return files.length?`<span style="color:var(--g);font-size:12px">✓ ${files.length}개 파일</span>`:'<span style="color:var(--tx3);font-size:11px">미업로드</span>';
}

function rsUpdateVal(orderId,key,secName,itemName,field,val){
  const yr=document.getElementById('rs-year-sel')?.value||CY;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.rsData) order.rsData={};
  if(!order.rsData[key]) order.rsData[key]={};
  if(!order.rsData[key][secName]) order.rsData[key][secName]={};
  if(!order.rsData[key][secName][itemName]) order.rsData[key][secName][itemName]={value:{},judge:'',note:''};
  const d=order.rsData[key][secName][itemName];
  if(typeof d.value!=='object'||Array.isArray(d.value)) d.value={};
  d.value[field]=val;
  // 자동 판정
  rsAutoJudge(d,itemName,secName);
  autoSave();
  rsRenderList(order);
  // 해당 행 판정 버튼 DOM 업데이트 (포커스 유지)
  const jId=`rs-judge-${orderId}-${key}-${secName}-${itemName}`;
  const jEl=document.getElementById(jId);
  if(jEl){
    const pass=d.judge==='pass'; const fail=d.judge==='fail';
    jEl.innerHTML=`<div style="display:inline-flex;border:1px solid var(--border);border-radius:5px;overflow:hidden">
      <button onclick="rsSetJudge('${orderId}','${key}','${secName}','${itemName}','pass')"
        style="padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;border:none;font-family:var(--sans);background:${pass?'var(--g)':'var(--bg3)'};color:${pass?'#fff':'var(--tx3)'}">PASS</button>
      <button onclick="rsSetJudge('${orderId}','${key}','${secName}','${itemName}','fail')"
        style="padding:3px 9px;font-size:11px;font-weight:700;cursor:pointer;border:none;border-left:1px solid var(--border);font-family:var(--sans);background:${fail?'var(--r)':'var(--bg3)'};color:${fail?'#fff':'var(--tx3)'}">FAIL</button>
      <button onclick="rsSetJudge('${orderId}','${key}','${secName}','${itemName}','')"
        style="padding:3px 7px;font-size:11px;cursor:pointer;border:none;border-left:1px solid var(--border);font-family:var(--sans);background:var(--bg3);color:var(--tx3)">✕</button>
    </div>`;
  }
  // 내충격성/내스크래치성 입력은 셀 재렌더 (버튼 선택 표시 갱신)
  if(['impact','scratch','saltspray'].includes(RS_INPUT[itemName]?.type)){
    rsRenderDetail(key);
  }
}

function rsUpdateField(orderId,key,secName,itemName,field,val){
  const yr=document.getElementById('rs-year-sel')?.value||CY;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.rsData) order.rsData={};
  if(!order.rsData[key]) order.rsData[key]={};
  if(!order.rsData[key][secName]) order.rsData[key][secName]={};
  if(!order.rsData[key][secName][itemName]) order.rsData[key][secName][itemName]={value:{},judge:'',note:''};
  order.rsData[key][secName][itemName][field]=val;
  autoSave();
}

function rsSetJudge(orderId,key,secName,itemName,val){
  const yr=document.getElementById('rs-year-sel')?.value||CY;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.rsData) order.rsData={};
  if(!order.rsData[key]) order.rsData[key]={};
  if(!order.rsData[key][secName]) order.rsData[key][secName]={};
  if(!order.rsData[key][secName][itemName]) order.rsData[key][secName][itemName]={value:{},judge:'',note:''};
  order.rsData[key][secName][itemName].judge=val;
  autoSave();
  rsRenderList(order);
  rsRenderDetail(key);
  // NG 뱃지 실시간 업데이트
  ngSyncBadge();
}

function rsCheckAll(key,result){
  if(!rsCurrentOrder) return;
  const order=rsCurrentOrder;
  const pts=key.split('_'); const cl=pts[pts.length-1]; const mk=pts.slice(0,-1).join('_');
  const sp=order.specimens.find(s=>s.maker===mk&&s.color===cl);
  if(!sp) return;
  if(!order.rsData) order.rsData={};
  if(!order.rsData[key]) order.rsData[key]={};
  sp.sections.forEach(sec=>{
    if(!order.rsData[key][sec.name]) order.rsData[key][sec.name]={};
    sec.items.filter(it=>it.checked).forEach(it=>{
      if(!order.rsData[key][sec.name][it.name]) order.rsData[key][sec.name][it.name]={value:{},judge:'',note:''};
      order.rsData[key][sec.name][it.name].judge=result;
    });
  });
  autoSave(); rsRenderList(order); rsRenderDetail(key);
}

function rsClearAll(key){
  if(!rsCurrentOrder) return;
  if(!confirm('이 색상의 모든 결과를 초기화할까요?')) return;
  rsCurrentOrder.rsData[key]={};
  autoSave(); rsRenderList(rsCurrentOrder); rsRenderDetail(key);
}


