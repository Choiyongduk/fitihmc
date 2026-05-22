// ══════════════════════════════════════════════════════
// workflow.js — 차수 중심 워크플로우 셸
// 의뢰 → 검수 → 중간 → 최종 → 보고서 를 차수 단위로 진행
// 기존 단계 화면(orders/inspection/thickness/results/report)을
// selectedOrderId 기준으로 재사용. 데이터/로직/디자인 그대로.
// ══════════════════════════════════════════════════════

let wfCurrentOrderId = null;

// 단계 → 기존 페이지/초기화 매핑
const WF_STAGES = [
  { key:'request',    label:'의뢰',   page:'orders',     icon:'＋', launch(){ if(window.renderOrderList) renderOrderList(); if(window.selectOrder) selectOrder(wfCurrentOrderId); else if(window.renderOrderDetail) renderOrderDetail(wfCurrentOrderId); } },
  { key:'inspection', label:'검수',   page:'inspection', icon:'✓', launch(){ if(window.inspectionInit) inspectionInit(); } },
  { key:'middle',     label:'중간',   page:'thickness',  icon:'▢', launch(){ if(window.tkInit) tkInit(); } },
  { key:'final',      label:'최종',   page:'results',    icon:'✎', launch(){ if(window.rsInit) rsInit(); } },
  { key:'report',     label:'보고서', page:'report',     icon:'▤', launch(){ if(window.rpInit) rpInit(); } },
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
  return (activeDB().orders[CY]||[]).find(o=>o.id===id);
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
  window.selectedOrderId = id;

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
  window.selectedOrderId = wfCurrentOrderId;

  // 기존 nav 사용 (페이지 전환 + nav-item 활성화는 생략 — 워크플로우 컨텍스트 유지)
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg = document.getElementById('page-'+s.page);
  if(pg) pg.classList.add('active');

  try { s.launch(); } catch(e){ console.warn('[wfStage]', stage, e); }
  _wfInjectBack(s.page, stage);
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
