// ══════════════════════════════════════════════════════
// workflow.js — 차수 중심 워크플로우 셸
// 의뢰 → 검수 → 중간 → 최종 → 보고서 를 차수 단위로 진행
// 기존 단계 화면(orders/inspection/thickness/results/report)을
// selectedOrderId 기준으로 재사용. 데이터/로직/디자인 그대로.
// ══════════════════════════════════════════════════════

let wfCurrentOrderId = null;

// 단계 → 기존 페이지/초기화 매핑
const WF_STAGES = [
  { key:'request',    label:'의뢰',   page:'workflow' },
  { key:'inspection', label:'검수',   page:'workflow' },
  { key:'middle',     label:'중간',   page:'thickness' },
  { key:'final',      label:'최종',   page:'results' },
  { key:'report',     label:'보고서', page:'report' },
];

// ──────────────────────────────────────────────
// 단계별 진행 상태 계산
// 반환: { request, inspection, middle, final, report } 각 {state, detail, ng}
//   state: 'done' | 'partial' | 'todo'
// ──────────────────────────────────────────────
function wfComputeStages(o){
  const secs = (o.specimens||[]).flatMap(sp=>sp.sections||[]);
  const sendLog = o.sendLog||[];

  // 의뢰: 차수 존재 = 완료
  const request = { state:'done', detail:`${(o.specimens||[]).length}종`, ng:0 };

  // 검수: section.receiptOk
  const recvTotal = secs.length;
  const recvDone  = secs.filter(s=>s.receiptOk).length;
  const inspection = {
    state: recvTotal===0 ? 'todo' : recvDone===recvTotal ? 'done' : recvDone>0 ? 'partial' : 'todo',
    detail: recvTotal ? `${recvDone}/${recvTotal}` : '-',
    ng: 0,
  };

  // 중간: tkData(도막두께·광택·ATR) + middle 발송
  const tk = o.tkData||{};
  const midEntered = Object.keys(tk).length>0 &&
                     Object.values(tk).some(v=> v && typeof v==='object' && Object.keys(v).length);
  const midSent = sendLog.some(l=>l.type==='middle');
  const middle = {
    state: midSent ? 'done' : midEntered ? 'partial' : 'todo',
    detail: midSent ? '발송완료' : midEntered ? '입력중' : '대기',
    ng: 0,
  };

  // 최종: rsData 진행도 (기존 rsCountProgress 재사용)
  let rsTotal=0, rsDone=0, rsNg=0;
  (o.specimens||[]).forEach(sp=>{
    const key = `${sp.maker}_${sp.color}`;
    const rd  = (o.rsData||{})[key]||{};
    if(typeof rsCountProgress === 'function'){
      const c = rsCountProgress(sp, rd);
      rsTotal += c.total; rsDone += c.done; rsNg += c.ng;
    }
  });
  const finalSent = sendLog.some(l=>l.type==='result');
  const final = {
    state: finalSent ? 'done' : (rsTotal && rsDone===rsTotal) ? 'partial' : rsDone>0 ? 'partial' : 'todo',
    detail: rsTotal ? `${rsDone}/${rsTotal}` : '-',
    ng: rsNg,
  };

  // 보고서: 최종결과 발송 = 보고서 발송으로 간주 (v1)
  const report = {
    state: finalSent ? 'done' : 'todo',
    detail: finalSent ? '발송완료' : '대기',
    ng: 0,
  };

  return { request, inspection, middle, final, report };
}

// 현재 진행 단계(첫 미완료) key 반환
function wfCurrentStageKey(stages){
  for(const k of ['inspection','middle','final','report']){
    if(stages[k].state !== 'done') return k;
  }
  return 'report';
}

// D-day 계산 (완료예정일이 있으면)
function wfDday(o){
  const due = o.due || o.dueDate || o.reqDate;
  if(!due || !/^\d{4}-\d{2}-\d{2}/.test(due)) return null;
  const d = new Date(due); const today = new Date();
  d.setHours(0,0,0,0); today.setHours(0,0,0,0);
  const diff = Math.round((d - today)/86400000);
  return diff;
}

// ──────────────────────────────────────────────
// 진입점
// ──────────────────────────────────────────────
function wfInit(){
  if(wfCurrentOrderId && _wfOrderById(wfCurrentOrderId)) wfOpenOrder(wfCurrentOrderId);
  else wfRenderHome();
}

function _wfOrderById(id){
  const db = activeDB();
  for(const yr of Object.keys(db.orders||{})){
    const o = (db.orders[yr]||[]).find(x=>x.id===id);
    if(o) return o;
  }
  return null;
}

function _wfOrderYear(id){
  const db = activeDB();
  for(const yr of Object.keys(db.orders||{})){
    if((db.orders[yr]||[]).some(x=>x.id===id)) return yr;
  }
  return null;
}

// 차수를 "진짜" 전역(let)에 반영 + 연도(CY) 동기화
// (window.selectedOrderId 만으로는 let 전역이 안 바뀌어 각 화면이 못 읽음)
function _wfSelectOrder(id){
  const yr = _wfOrderYear(id);
  if(yr && String(CY)!==String(yr) && typeof changeYear==='function'){
    changeYear(yr);  // CY(let) 갱신 + 목록 재렌더
  }
  try { selectedOrderId = id; } catch(e){}   // let 전역 직접 갱신 (classic script 공유 스코프)
  window.selectedOrderId = id;               // 호환용
}

// ──────────────────────────────────────────────
// 홈: 내 차수 카드 목록
// ──────────────────────────────────────────────
function wfRenderHome(){
  wfCurrentOrderId = null;
  const orders = activeDB().orders[CY]||[];
  const body = document.getElementById('wf-body');
  if(!body) return;

  const cards = orders.length ? orders.map(o=>{
    const st = wfComputeStages(o);
    const curKey = wfCurrentStageKey(st);
    const curLabel = WF_STAGES.find(s=>s.key===curKey).label;
    const totalNg = Object.values(st).reduce((a,s)=>a+(s.ng||0),0);
    const dday = wfDday(o);
    const ddayChip = dday==null ? '' :
      `<span style="font-size:11px;font-family:var(--mono);padding:2px 8px;border-radius:6px;background:${dday<0?'var(--rbg)':dday<=7?'var(--obg)':'var(--bg4)'};color:${dday<0?'var(--r)':dday<=7?'var(--o)':'var(--tx2)'}">D${dday<=0?'':'-'}${dday<0?'+'+(-dday):dday}</span>`;

    // 미니 스텝퍼 (5단계 점)
    const dots = WF_STAGES.map(s=>{
      const state = st[s.key].state;
      const c = state==='done'?'var(--g)':state==='partial'?'var(--o)':'var(--border2)';
      const isCur = s.key===curKey;
      return `<span title="${s.label}" style="width:${isCur?'9px':'7px'};height:${isCur?'9px':'7px'};border-radius:50%;background:${c};${isCur?'box-shadow:0 0 0 2px var(--bbg)':''};display:inline-block"></span>`;
    }).join('<span style="flex:1;height:1px;background:var(--border);min-width:6px"></span>');

    return `
    <div onclick="wfOpenOrder('${o.id}')" style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:.15s"
         onmouseover="this.style.borderColor='var(--b)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-family:var(--mono);font-weight:700;font-size:14px;color:var(--tx)">${CY}-${o.cha||'?'}차</span>
        <span style="font-size:12px;color:var(--tx3)">${o.mgr||''} · ${(o.specimens||[]).length}종</span>
        <span style="margin-left:auto;display:flex;gap:6px;align-items:center">
          ${totalNg>0?`<span class="badge ng" style="background:var(--rbg);color:var(--r);font-size:10px;padding:2px 7px;border-radius:6px">NG ${totalNg}</span>`:''}
          ${ddayChip}
        </span>
      </div>
      <div style="font-size:13px;color:var(--tx2);margin-bottom:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.purpose||'(목적 미입력)'}</div>
      <div style="display:flex;align-items:center;gap:0;margin-bottom:4px">${dots}</div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--tx3)">
        <span>의뢰 · 검수 · 중간 · 최종 · 보고서</span>
        <span style="color:var(--b);font-weight:600">현재: ${curLabel}</span>
      </div>
    </div>`;
  }).join('') : `<div style="text-align:center;padding:60px 20px;color:var(--tx3)">등록된 차수가 없습니다. <br>상단 "신규 차수 등록"으로 시작하세요.</div>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">내 차수</div>
      <span class="year-chip">${CY}년</span>
      <button class="btn" style="margin-left:auto;font-size:12px" onclick="(window.openNewOrderPage||window.openNewOrderModal||function(){})()">+ 신규 차수 등록</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${cards}</div>`;
}

// ──────────────────────────────────────────────
// 차수 열기: 스텝퍼 + 단계별 진행 카드
// ──────────────────────────────────────────────
function wfOpenOrder(id){
  const o = _wfOrderById(id);
  if(!o){ wfRenderHome(); return; }
  wfCurrentOrderId = id;
  _wfSelectOrder(id);

  // 워크플로우 페이지 활성화
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const wp = document.getElementById('page-workflow');
  if(wp) wp.classList.add('active');
  _wfSetNavActive();

  const st = wfComputeStages(o);
  const curKey = wfCurrentStageKey(st);
  const dday = wfDday(o);
  const body = document.getElementById('wf-body');
  if(!body) return;

  // 상단 스텝퍼
  const stepper = WF_STAGES.map((s,i)=>{
    const state = st[s.key].state;
    const isCur = s.key===curKey;
    let bg,fg,border='transparent',inner;
    if(state==='done'){ bg='var(--gbg)'; fg='var(--g)'; inner='✓'; }
    else if(state==='partial'){ bg='var(--obg)'; fg='var(--o)'; inner=(i+1); }
    else if(isCur){ bg='var(--bbg)'; fg='var(--b)'; border='var(--b)'; inner=(i+1); }
    else { bg='var(--bg4)'; fg='var(--tx3)'; inner=(i+1); }
    const line = i<WF_STAGES.length-1 ? `<div style="flex:1;height:2px;background:${st[WF_STAGES[i+1].key].state==='done'||state==='done'?'var(--g)':'var(--border)'};margin:0 2px;align-self:center;margin-top:-16px"></div>` : '';
    return `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;flex-shrink:0" onclick="wfStage('${s.key}')">
        <div style="width:30px;height:30px;border-radius:50%;background:${bg};color:${fg};border:2px solid ${border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:var(--mono)">${inner}</div>
        <div style="font-size:11px;margin-top:5px;color:${isCur?'var(--b)':fg};font-weight:${isCur?'700':'400'}">${s.label}</div>
      </div>${line}`;
  }).join('');

  // 단계별 상세 카드
  const stageRows = WF_STAGES.map(s=>{
    const info = st[s.key];
    const stCol = info.state==='done'?'var(--g)':info.state==='partial'?'var(--o)':'var(--tx3)';
    const stLbl = info.state==='done'?'완료':info.state==='partial'?'진행중':'대기';
    const ngBadge = info.ng>0 ? `<span style="font-size:11px;background:var(--rbg);color:var(--r);padding:2px 8px;border-radius:6px;margin-left:6px">NG ${info.ng}</span>` : '';
    return `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:8px;background:var(--bg2)">
        <div style="width:6px;height:32px;border-radius:3px;background:${stCol}"></div>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:600">${s.label}<span style="font-size:11px;color:var(--tx3);font-weight:400;margin-left:6px">${_wfStageHint(s.key)}</span>${ngBadge}</div>
          <div style="font-size:12px;color:var(--tx3);font-family:var(--mono)">${stLbl} · ${info.detail}</div>
        </div>
        <button class="btn ${s.key===curKey?'primary':''}" style="font-size:12px" onclick="wfStage('${s.key}')">열기 →</button>
      </div>`;
  }).join('');

  const ddayChip = dday==null ? '' :
    `<span style="font-size:12px;font-family:var(--mono);padding:3px 9px;border-radius:6px;background:${dday<0?'var(--rbg)':dday<=7?'var(--obg)':'var(--bg4)'};color:${dday<0?'var(--r)':dday<=7?'var(--o)':'var(--tx2)'}">D${dday<0?'+'+(-dday):'-'+dday}</span>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
      <button class="btn" style="font-size:12px" onclick="wfRenderHome()">← 차수 목록</button>
      ${ddayChip ? `<span style="margin-left:auto">${ddayChip}</span>`:''}
    </div>
    <div style="margin:10px 0 4px">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-family:var(--mono);font-weight:700;font-size:18px">${CY}-${o.cha||'?'}차</span>
        <span style="font-size:13px;color:var(--tx3)">${o.mgr||''} · ${(o.specimens||[]).length}종</span>
      </div>
      <div style="font-size:13px;color:var(--tx2);margin-top:3px">${o.purpose||''}</div>
    </div>
    <div style="display:flex;align-items:flex-start;padding:18px 4px 20px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);margin:12px 0">${stepper}</div>
    <div style="display:flex;flex-direction:column;gap:8px">${stageRows}</div>`;
}

function _wfStageHint(key){
  return {
    request:'기본정보·시편·요구사항',
    inspection:'시료수령·검수',
    middle:'도막두께·광택·ATR',
    final:'나머지 전 항목',
    report:'최종 보고서·발송',
  }[key]||'';
}

// ──────────────────────────────────────────────
// 단계 열기: 기존 페이지로 이동 + 돌아가기 버튼 주입
// ──────────────────────────────────────────────
function wfStage(stage){
  const s = WF_STAGES.find(x=>x.key===stage);
  if(!s || !wfCurrentOrderId) return;
  const oid = wfCurrentOrderId;
  const yr  = _wfOrderYear(oid) || String(CY);
  _wfSelectOrder(oid);  // 전역도 맞춰둠(호환)

  // 검수: 워크플로우 안에서 인라인 체크리스트
  if(stage === 'inspection'){ wfInspect(oid, yr); return; }
  // 의뢰: 워크플로우 안에서 인라인 요청내용 보기
  if(stage === 'request'){ wfRequest(oid, yr); return; }

  // 그 외: 해당 페이지 활성화 + 화면을 그 차수의 연도·ID로 직접 구동
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('page-'+s.page);
  if(pg) pg.classList.add('active');

  _wfDriveStage(s.page, yr, oid);
  _wfInjectBack(s.page, stage);
  _wfScopeStage(s.page);
}

// 연도 셀렉터에 옵션 보장 + 값 설정
function _wfEnsureYear(selId, yr){
  const sel = document.getElementById(selId);
  if(!sel) return null;
  if(![...sel.options].some(o=>o.value===String(yr))){
    const opt=document.createElement('option');
    opt.value=String(yr); opt.textContent=yr+'년';
    sel.appendChild(opt);
  }
  sel.value = String(yr);
  return sel;
}

// 각 화면을 "그 차수의 연도+ID"로 직접 구동 (전역 CY에 의존하지 않음)
function _wfDriveStage(pageId, yr, oid){
  if(pageId === 'thickness'){
    _wfEnsureYear('tk-year-sel', yr);
    if(typeof tkChangeYear==='function') tkChangeYear(yr);
    const o=document.getElementById('tk-order-sel'); if(o) o.value=oid;
    if(typeof tkSelectOrder==='function') tkSelectOrder(oid);
  } else if(pageId === 'results'){
    _wfEnsureYear('rs-year-sel', yr);
    if(typeof rsChangeYear==='function') rsChangeYear(yr);
    const o=document.getElementById('rs-order-sel'); if(o) o.value=oid;
    if(typeof rsSelectOrder==='function') rsSelectOrder(oid);
  } else if(pageId === 'report'){
    _wfEnsureYear('rp-year-sel', yr);
    if(typeof rpChangeYear==='function') rpChangeYear(yr);
    const o=document.getElementById('rp-order-sel'); if(o) o.value=oid;
    if(typeof rpSelectOrder==='function') rpSelectOrder(oid);
  } else if(pageId === 'orders'){
    // renderOrderDetail은 CY 기준 → changeYear로 CY 확실히 맞춤(common.js 내부에서 설정)
    if(typeof changeYear==='function') changeYear(yr);
    if(typeof renderOrderDetail==='function') renderOrderDetail(oid);
    if(typeof updateYearCost==='function') updateYearCost();
  }
}

// 워크플로우 컨텍스트: 각 화면의 연도/차수 선택 UI 숨김 (이미 그 차수이므로)
const _WF_SEL_IDS = {
  thickness: ['tk-year-sel','tk-order-sel'],
  results:   ['rs-year-sel','rs-order-sel'],
  report:    ['rp-year-sel','rp-order-sel'],
};
function _wfScopeStage(pageId){
  (_WF_SEL_IDS[pageId]||[]).forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  if(pageId === 'orders'){
    const list = document.getElementById('order-list-panel');
    if(list) list.style.display = 'none';
    const layout = document.getElementById('orders-layout');
    if(layout) layout.style.gridTemplateColumns = '1fr';
  }
}

// ──────────────────────────────────────────────
// 의뢰 — 시험 요청 내용 (워크플로우 인라인)
// ──────────────────────────────────────────────
function wfRequest(oid, yr){
  const o = _wfOrderById(oid);
  const body = document.getElementById('wf-body');
  if(!o || !body) return;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-workflow')?.classList.add('active');

  const due = o.due || o.dueDate || o.reqDate || '';
  const makers = [...new Set((o.specimens||[]).map(sp=>sp.maker))];
  const specBlocks = makers.map(m=>{
    const sps = (o.specimens||[]).filter(sp=>sp.maker===m);
    const colorBlocks = sps.map(sp=>{
      const rows = (sp.sections||[]).map(sec=>{
        const items = (sec.items||[]).filter(it=>it.checked!==false).map(it=>it.name).join(', ');
        return `<tr style="border-top:1px solid var(--border)">
          <td style="padding:7px 10px;font-size:13px;font-weight:600;white-space:nowrap;vertical-align:top">${sec.name}</td>
          <td style="padding:7px 10px;font-size:12px;color:var(--tx2)">${items||'-'}</td>
        </tr>`;
      }).join('');
      return `<div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px;background:var(--bg2)">
        <div style="padding:8px 12px;background:var(--bg3);font-size:12px;font-weight:700;color:var(--tx2)">${sp.color||'-'} <span style="color:var(--tx3);font-weight:400">(${m})</span></div>
        <table style="width:100%;border-collapse:collapse"><tbody>${rows||'<tr><td style="padding:10px;color:var(--tx3);font-size:12px">시편종류 없음</td></tr>'}</tbody></table>
      </div>`;
    }).join('');
    return colorBlocks;
  }).join('');

  const info = (label,val)=>`<div style="display:flex;gap:8px;font-size:13px;padding:3px 0"><span style="color:var(--tx3);min-width:84px">${label}</span><span style="color:var(--tx);font-weight:500">${val||'-'}</span></div>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn" style="font-size:12px" onclick="wfOpenOrder('${oid}')">← ${yr}-${o.cha||'?'}차</button>
      <button class="btn primary" style="font-size:12px" onclick="wfStage('inspection')">다음: 검수 →</button>
      <div style="font-size:16px;font-weight:700;margin-left:8px">의뢰 — 시험 요청 내용</div>
      <button class="btn" style="font-size:12px;margin-left:auto" onclick="wfEditOrder('${oid}')">✏️ 상세 편집</button>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px;background:var(--bg2);margin-bottom:14px">
      ${info('차수', `${yr}-${o.cha||'?'}차`)}
      ${info('평가목적', o.purpose)}
      ${info('현대차 담당', o.mgr)}
      ${info('의뢰일', o.date)}
      ${due?info('완료예정일', due):''}
      ${info('시편 수', `${(o.specimens||[]).length}종`)}
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--tx2)">업체 · 색상별 시험항목</div>
    ${specBlocks || '<div style="text-align:center;padding:30px;color:var(--tx3)">시편이 없습니다</div>'}`;
}

// 의뢰 상세 편집 — 기존 의뢰관리 화면을 그 차수로 정확히 구동
function wfEditOrder(oid){
  const yr = _wfOrderYear(oid) || String(CY);
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-orders')?.classList.add('active');
  _wfDriveStage('orders', yr, oid);
  _wfInjectBack('orders', 'request');
  _wfScopeStage('orders');
}

// ──────────────────────────────────────────────
// 검수 — 업체/색상/시편종류별 시료수령 체크리스트 (워크플로우 인라인)
// ──────────────────────────────────────────────
function wfInspect(oid, yr){
  const o = _wfOrderById(oid);
  const body = document.getElementById('wf-body');
  if(!o || !body) return;

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-workflow')?.classList.add('active');

  const allSecs = (o.specimens||[]).flatMap(sp=>sp.sections||[]);
  const total = allSecs.length;
  const done  = allSecs.filter(s=>s.receiptOk).length;

  // 업체별 → 색상(시편)별 → 시편종류 행
  const makers = [...new Set((o.specimens||[]).map(sp=>sp.maker))];
  const groups = makers.map(m=>{
    const sps = (o.specimens||[]).filter(sp=>sp.maker===m);
    const colorBlocks = sps.map(sp=>{
      const spIdx = (o.specimens||[]).indexOf(sp);
      const rows = (sp.sections||[]).map((sec,si)=>{
        const items = (sec.items||[]).filter(it=>it.checked!==false).map(it=>it.name).join(', ');
        const ea = sec.receiptEa || sec.receiptCnt || '';
        const note = sec.receiptNote || '';
        const noteWarn = !sec.receiptOk && note ? 'border-color:var(--o)' : '';
        return `
          <div style="padding:9px 12px;border-top:1px solid var(--border)">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <input type="checkbox" ${sec.receiptOk?'checked':''}
                     onchange="wfInspectToggle('${oid}',${spIdx},${si},this.checked)"
                     style="width:17px;height:17px;margin-top:2px;flex-shrink:0;cursor:pointer">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:${sec.receiptOk?'var(--g)':'var(--tx)'}">${sec.name}</div>
                <div style="font-size:11px;color:var(--tx3);margin-top:2px">${items||'-'}</div>
              </div>
              <span style="font-size:11px;color:${sec.receiptOk?'var(--g)':'var(--tx3)'};flex-shrink:0;margin-top:2px">${sec.receiptOk?'✓ 수령':'대기'}</span>
            </div>
            <div style="display:flex;gap:6px;margin-top:7px;padding-left:27px;flex-wrap:wrap">
              <input value="${ea}" placeholder="실수령 EA"
                     onchange="wfInspectField('${oid}',${spIdx},${si},'receiptEa',this.value)"
                     style="width:88px;padding:4px 8px;font-size:12px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--tx);outline:none">
              <input value="${note.replace(/"/g,'&quot;')}" placeholder="비고 (개수 불일치 · 컬러 변경 등 특이사항)"
                     onchange="wfInspectField('${oid}',${spIdx},${si},'receiptNote',this.value)"
                     style="flex:1;min-width:160px;padding:4px 8px;font-size:12px;background:var(--bg3);border:1px solid var(--border);border-radius:5px;color:var(--tx);outline:none;${noteWarn}">
            </div>
          </div>`;
      }).join('');
      return `
        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px;background:var(--bg2)">
          <div style="padding:8px 12px;background:var(--bg3);font-size:12px;font-weight:700;color:var(--tx2)">${sp.color||'-'} <span style="color:var(--tx3);font-weight:400">(${m})</span></div>
          ${rows||'<div style="padding:10px 12px;color:var(--tx3);font-size:12px">시편종류 없음</div>'}
        </div>`;
    }).join('');
    return colorBlocks;
  }).join('');

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn" style="font-size:12px" onclick="wfOpenOrder('${oid}')">← ${yr}-${o.cha||'?'}차</button>
      <button class="btn primary" style="font-size:12px" onclick="wfStage('middle')">다음: 중간 →</button>
      <div style="font-size:16px;font-weight:700;margin-left:8px">검수 — 시료수령 체크</div>
      <span style="font-size:12px;font-family:var(--mono);color:${done===total&&total?'var(--g)':'var(--o)'};margin-left:auto">${done}/${total} 완료</span>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      <button class="btn primary" style="font-size:13px" onclick="wfInspectAll('${oid}',true)">전체 검수 완료 ✓</button>
      <button class="btn" style="font-size:13px" onclick="wfInspectAll('${oid}',false)">전체 해제</button>
      <button class="btn" style="font-size:13px;margin-left:auto;border-color:var(--g);color:var(--g)" onclick="wfInspectReply('${oid}')">📧 현대차 검수 회신</button>
    </div>
    <div style="font-size:11px;color:var(--tx3);margin-bottom:12px">완료 안 된 항목은 비고에 사유(개수 불일치·컬러 변경 등)를 적어 회신하세요.</div>
    ${groups || '<div style="text-align:center;padding:40px;color:var(--tx3)">시편이 없습니다</div>'}`;
}

function wfInspectToggle(oid, spIdx, secIdx, checked){
  const o = _wfOrderById(oid); if(!o) return;
  const sec = o.specimens?.[spIdx]?.sections?.[secIdx];
  if(!sec) return;
  sec.receiptOk = checked;
  if(checked && !sec.receiptDate) sec.receiptDate = new Date().toISOString().slice(0,10);
  if(typeof autoSave==='function') autoSave();
  wfInspect(oid, _wfOrderYear(oid)||String(CY));  // 재렌더 (카운트 갱신)
}

function wfInspectAll(oid, val){
  const o = _wfOrderById(oid); if(!o) return;
  const today = new Date().toISOString().slice(0,10);
  (o.specimens||[]).forEach(sp=>(sp.sections||[]).forEach(sec=>{
    sec.receiptOk = val;
    if(val && !sec.receiptDate) sec.receiptDate = today;
  }));
  if(typeof autoSave==='function') autoSave();
  wfInspect(oid, _wfOrderYear(oid)||String(CY));
}

// 실수령EA / 비고 저장 (재렌더 없이 — 입력 포커스 유지)
function wfInspectField(oid, spIdx, secIdx, field, value){
  const o = _wfOrderById(oid); if(!o) return;
  const sec = o.specimens?.[spIdx]?.sections?.[secIdx];
  if(!sec) return;
  sec[field] = value;
  if(typeof autoSave==='function') autoSave();
}

// 현대차 검수 회신 — 수령/불일치 요약을 sendLog에 기록
function wfInspectReply(oid){
  const o = _wfOrderById(oid); if(!o) return;
  const yr = _wfOrderYear(oid)||String(CY);
  const lines = [];
  let recv=0, totalSec=0, issues=0;
  (o.specimens||[]).forEach(sp=>(sp.sections||[]).forEach(sec=>{
    totalSec++;
    if(sec.receiptOk) recv++;
    const note = (sec.receiptNote||'').trim();
    if(note) issues++;
    lines.push(`· ${sp.maker}/${sp.color}/${sec.name}: ${sec.receiptOk?'수령완료':'미수령'}${sec.receiptEa?` (${sec.receiptEa}EA)`:''}${note?` — ${note}`:''}`);
  }));
  const summary = `[검수 회신] ${yr}-${o.cha||'?'}차 (${o.purpose||''})\n수령 ${recv}/${totalSec}건${issues?` · 특이사항 ${issues}건`:''}\n\n${lines.join('\n')}`;

  if(!confirm(`현대차 담당자에게 검수 회신을 발송할까요?\n\n${summary}`)) return;

  if(!o.sendLog) o.sendLog = [];
  o.sendLog.push({ type:'inspection', typeName:'검수 회신', sentAt:new Date().toISOString(), sentBy:'시험담당자', recv, totalSec, issues, status:'sent' });
  if(typeof autoSave==='function') autoSave();
  if(typeof showToast==='function') showToast('검수 회신이 기록되었습니다. (현대차 발송)', 'g', 3500);
  else alert('검수 회신이 기록되었습니다.');
  wfInspect(oid, yr);
}


function _wfInjectBack(pageId, stageKey){
  const page = document.getElementById('page-'+pageId);
  if(!page) return;
  const tb = page.querySelector('.topbar');
  if(!tb) return;
  let bar = tb.querySelector('.wf-nav-bar');
  if(!bar){
    bar = document.createElement('div');
    bar.className = 'wf-nav-bar';
    bar.style.cssText = 'display:flex;align-items:center;gap:6px;margin-right:8px';
    tb.insertBefore(bar, tb.firstChild);
  }
  const o = _wfOrderById(wfCurrentOrderId);
  const idx = WF_STAGES.findIndex(s=>s.key===stageKey);
  const prev = WF_STAGES[idx-1];
  const next = WF_STAGES[idx+1];
  bar.innerHTML = '';

  // ← 워크플로우(차수)로
  const back = document.createElement('button');
  back.className = 'btn';
  back.style.cssText = 'font-size:12px';
  back.innerHTML = `← ${CY}-${o?o.cha:''}차`;
  back.title = '차수 워크플로우로';
  back.onclick = ()=> wfOpenOrder(wfCurrentOrderId);
  bar.appendChild(back);

  // 이전 단계
  if(prev){
    const pv = document.createElement('button');
    pv.className = 'btn';
    pv.style.cssText = 'font-size:12px';
    pv.innerHTML = `← ${prev.label}`;
    pv.onclick = ()=> wfStage(prev.key);
    bar.appendChild(pv);
  }
  // 다음 단계 (쭉쭉 진행)
  if(next){
    const nx = document.createElement('button');
    nx.className = 'btn primary';
    nx.style.cssText = 'font-size:12px';
    nx.innerHTML = `다음: ${next.label} →`;
    nx.onclick = ()=> wfStage(next.key);
    bar.appendChild(nx);
  }
}

// 워크플로우 nav-item 활성화 표시
function _wfSetNavActive(btnId){
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const nb = document.getElementById(btnId||'wf-nav-btn');
  if(nb) nb.classList.add('active');
}

// 외부에서 호출하는 진입 (nav 버튼)
function wfNav(){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const wp = document.getElementById('page-workflow');
  if(wp) wp.classList.add('active');
  _wfSetNavActive('wf-nav-btn');
  wfInit();
}

// ──────────────────────────────────────────────
// 차수 목록 (조밀한 표 — 많은 차수 빠르게 훑기)
// ──────────────────────────────────────────────
function wfListNav(){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const wp = document.getElementById('page-workflow');
  if(wp) wp.classList.add('active');
  _wfSetNavActive('wf-list-btn');
  wfListView();
}

function wfListView(){
  wfCurrentOrderId = null;
  const orders = activeDB().orders[CY]||[];
  const body = document.getElementById('wf-body');
  if(!body) return;

  const rows = orders.length ? orders.map(o=>{
    const st = wfComputeStages(o);
    const curKey = wfCurrentStageKey(st);
    const curLabel = WF_STAGES.find(s=>s.key===curKey).label;
    const totalNg = Object.values(st).reduce((a,s)=>a+(s.ng||0),0);
    const dday = wfDday(o);
    const doneCnt = Object.values(st).filter(s=>s.state==='done').length;

    // 미니 진행 점 5개
    const dots = WF_STAGES.map(s=>{
      const state = st[s.key].state;
      const c = state==='done'?'var(--g)':state==='partial'?'var(--o)':'var(--border2)';
      return `<span style="width:6px;height:6px;border-radius:50%;background:${c};display:inline-block;margin-right:2px"></span>`;
    }).join('');

    const ddayChip = dday==null ? '<span style="color:var(--tx3)">-</span>' :
      `<span style="font-family:var(--mono);color:${dday<0?'var(--r)':dday<=7?'var(--o)':'var(--tx2)'}">D${dday<0?'+'+(-dday):'-'+dday}</span>`;

    return `
      <tr onclick="wfOpenOrder('${o.id}')" style="cursor:pointer;border-bottom:1px solid var(--border)"
          onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background='transparent'">
        <td style="padding:9px 10px;font-family:var(--mono);font-weight:700;white-space:nowrap">${CY}-${o.cha||'?'}</td>
        <td style="padding:9px 10px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.purpose||'-'}</td>
        <td style="padding:9px 10px;white-space:nowrap;color:var(--tx2)">${o.mgr||'-'}</td>
        <td style="padding:9px 10px;text-align:center;color:var(--tx2)">${(o.specimens||[]).length}</td>
        <td style="padding:9px 10px;white-space:nowrap">${dots} <span style="font-size:12px;color:var(--b);font-weight:600;margin-left:4px">${curLabel}</span> <span style="font-size:11px;color:var(--tx3)">${doneCnt}/5</span></td>
        <td style="padding:9px 10px;text-align:right;white-space:nowrap">
          ${totalNg>0?`<span style="font-size:11px;background:var(--rbg);color:var(--r);padding:2px 7px;border-radius:6px;margin-right:6px">NG ${totalNg}</span>`:''}${ddayChip}
        </td>
      </tr>`;
  }).join('') : `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--tx3)">등록된 차수가 없습니다</td></tr>`;

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700">차수 목록</div>
      <span class="year-chip">${CY}년</span>
      <span style="font-size:12px;color:var(--tx3)">총 ${orders.length}차수</span>
      <button class="btn" style="margin-left:auto;font-size:12px" onclick="(window.openNewOrderModal||function(){})()">+ 신규 차수 등록</button>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;background:var(--bg2)">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg3);border-bottom:1px solid var(--border2);text-align:left;color:var(--tx3);font-size:11px">
            <th style="padding:8px 10px;font-weight:700">차수</th>
            <th style="padding:8px 10px;font-weight:700">평가목적</th>
            <th style="padding:8px 10px;font-weight:700">담당</th>
            <th style="padding:8px 10px;font-weight:700;text-align:center">종수</th>
            <th style="padding:8px 10px;font-weight:700">진행</th>
            <th style="padding:8px 10px;font-weight:700;text-align:right">상태</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// 부팅: 데이터 준비 후(common.js DOMContentLoaded 다음) 홈 렌더
window.addEventListener('DOMContentLoaded', ()=>{
  setTimeout(()=>{ try { wfInit(); } catch(e){ console.warn('[wfInit]', e); } }, 0);
});

// 전역 노출
window.wfInit = wfInit;
window.wfNav = wfNav;
window.wfListNav = wfListNav;
window.wfListView = wfListView;
window.wfRenderHome = wfRenderHome;
window.wfOpenOrder = wfOpenOrder;
window.wfStage = wfStage;
window.wfInspect = wfInspect;
window.wfInspectToggle = wfInspectToggle;
window.wfInspectAll = wfInspectAll;
window.wfInspectField = wfInspectField;
window.wfInspectReply = wfInspectReply;
window.wfRequest = wfRequest;
window.wfEditOrder = wfEditOrder;
