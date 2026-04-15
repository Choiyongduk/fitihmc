// ======================================================
// // body.js — 차체도장 전용: 의뢰관리·시험항목·시료수령·파싱
// 의존: common.js
// ======================================================

// ══════════════════════════════════════════════════════
function buildOrder(o){
  const makers = (o.maker||'').split(',').map(s=>s.trim()).filter(Boolean);
  const colors  = o.colors||[];
  // 도료사가 1개면 모든 색상에 적용, 여러 개면 색상 수 맞춤
  const specimens = colors.map((color, ci)=>{
    const maker = makers[ci] || makers[makers.length-1] || makers[0] || '—';
    const sections = (o.sections||['완성도막']).map(sname=>({
      name: sname,
      items: (DEFAULT_ITEMS[sname]||[]).map(iname=>({name:iname, price:PRICE_MAP[iname]||0, checked:true})),
    }));
    return {maker, color, sections, receiptDate:'', receiptCnt:'', receiptOk:false};
  });
  return {
    id: o.id||'o_'+Date.now(),
    cha: o.cha, purpose: o.purpose, mgr: o.mgr, date: o.date,
    maker: o.maker, colors: o.colors, cnt: o.cnt, status: o.status||'wait',
    specimens,
  };
}

// ══════════════════════════════════════════════════════
// 네비게이션
// ══════════════════════════════════════════════════════



// ══════════════════════════════════════════════════════
// 차수 목록 렌더
// ══════════════════════════════════════════════════════
function renderOrderList(){
  const orders = activeDB().orders[CY]||[];
  const statusBadge = {
    done:'<span class="badge pass">완료</span>',
    ip:  '<span class="badge ip">진행중</span>',
    wait:'<span class="badge wait">대기</span>'
  };

  // 검수 현황 계산
  function getReceiptInfo(o){
    const all = o.specimens.flatMap(sp=>sp.sections);
    const done = all.filter(s=>s.receiptOk).length;
    const hasNotes = all.some(s=>s.receiptNote&&s.receiptNote.trim());
    const noteIcon = hasNotes ? `<span style="color:var(--o);font-size:10px" title="시료수령 비고 있음">!</span>` : '';
    if(!all.length) return noteIcon;
    if(done===all.length) return `<span style="color:var(--g);font-size:10px"> 검수완료</span>${noteIcon}`;
    if(done>0) return `<span style="color:var(--o);font-size:10px"> ${done}/${all.length}</span>${noteIcon}`;
    return noteIcon;
  }
  document.getElementById('order-list').innerHTML = orders.length
    ? orders.map(o=>{
        const cost = calcOrderCost(o);
        return `<div class="order-item${o.id===selectedOrderId?' active':''}" onclick="selectOrder('${o.id}')">
          <span class="order-cha">${o.cha}</span>
          <div class="order-info">
            <div class="order-purpose">${o.purpose}</div>
            <div class="order-meta" style="display:flex;align-items:center;gap:6px">
              <span>${o.mgr} · ${o.date} · ${o.specimens.length}종</span>
              ${getReceiptInfo(o)}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            ${statusBadge[o.status]||statusBadge.wait}
            <span class="order-cost">${cost.toLocaleString()}원</span>
          </div>
        </div>`;
      }).join('')
    : `<div style="text-align:center;padding:30px;color:var(--tx3);font-size:13px">등록된 차수가 없습니다</div>`;
}

function selectOrder(id){
  selectedOrderId = id;
  renderOrderList();
  renderOrderDetail(id);
}

// ══════════════════════════════════════════════════════
// 차수 상세 렌더 (메인 기능)
// ══════════════════════════════════════════════════════
function renderOrderDetail(id){
  const order = (activeDB().orders[CY]||[]).find(o=>o.id===id);
  if(!order){document.getElementById('order-detail').innerHTML='';return;}

  const totalCost = calcOrderCost(order);

  document.getElementById('order-detail').innerHTML = `
    <!-- 기본 정보 -->
    <div class="card">
      <div class="card-title">${CY}-${order.cha} 기본 정보
        <button class="btn danger sm" style="margin-left:auto;font-size:11px" onclick="deleteOrder('${id}')">차수 삭제</button>
      </div>
      <div class="grid3" style="margin-bottom:10px">
        <div class="field"><label>차수</label>
          <input type="text" value="${order.cha}" onchange="order.cha=this.value;renderOrderList()"></div>
        <div class="field"><label>담당자</label>
          <select onchange="order.mgr=this.value">
            ${['김환오','채종운','전재철','양지원','이재진'].map(m=>`<option${order.mgr===m?' selected':''}>${m}</option>`).join('')}
          </select></div>
        <div class="field"><label>의뢰일</label>
          <input type="date" value="${order.date}" onchange="order.date=this.value"></div>
      </div>
      <div class="field"><label>평가목적</label>
        <input type="text" value="${order.purpose}" onchange="order.purpose=this.value;renderOrderList()"></div>
      <div class="grid2">
        <div class="field"><label>도료사</label>
          <input type="text" value="${order.maker||''}" onchange="order.maker=this.value"></div>
        <div class="field"><label>시편 총 수량 (EA)</label>
          <input type="number" value="${order.cnt||''}" placeholder="EA" onchange="order.cnt=parseInt(this.value)||0"></div>
      </div>
    </div>

    <!-- 탭: 시험항목·시료수령만 -->
    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:16px 16px 0">
        <div class="tab-bar">
          <button class="tab-btn active" onclick="switchTab('items','${id}',this)">시험항목 · 시료수령</button>
        </div>
      </div>

      <!-- 시험항목 탭 -->
      <div id="tab-items-${id}" class="tab-panel active" style="padding:16px">
        ${renderItemsTab(order)}
      </div>

      <!-- 비용 요약 (항상 노출) -->
      <div style="padding:0 16px 16px">
        ${buildCostSummaryHtml(order)}
      </div>
    </div>
  `;
}

function switchTab(name, orderId, btn){
  ['items','cost'].forEach(t=>{
    document.getElementById(`tab-${t}-${orderId}`)?.classList.toggle('active', t===name);
  });
  btn.closest('.tab-bar').querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(name==='cost') refreshCostTab(orderId);
}

// ══════════════════════════════════════════════════════
// 시험항목 탭
// ══════════════════════════════════════════════════════
function renderItemsTab(order){
  if(!order.specimens.length) return `<div style="text-align:center;color:var(--tx3);padding:30px">시편(업체/색상)이 없습니다</div>`;

  // 업체별 탭
  const makerKeys = [...new Set(order.specimens.map(sp=>sp.maker))];
  const makerTabsHtml = makerKeys.map((m,i)=>
    `<button class="maker-tab${i===0?' active':''}" onclick="switchMakerTab('${order.id}','${m}',this)">${m}</button>`
  ).join('');

  const makerPanels = makerKeys.map((m,mi)=>{
    const sps = order.specimens.filter(sp=>sp.maker===m);
    // 색상별 탭
    const colorTabsHtml = sps.map((sp,ci)=>
      `<button class="maker-tab${ci===0?' active':''}" style="font-size:12px;padding:4px 10px"
        onclick="switchColorTab('${order.id}','${m}','${sp.color}',this)">${sp.color}</button>`
    ).join('');

    const colorPanels = sps.map((sp, si)=>{
      const spIdx = order.specimens.indexOf(sp);
      return `<div id="cpanel-${order.id}-${m}-${sp.color}" class="${si===0?'':'hidden'}" style="${si===0?'':'display:none'}">
        ${renderSpecimenItems(order, spIdx)}
      </div>`;
    }).join('');

    return `<div id="mpanel-${order.id}-${m}" class="${mi===0?'':'hidden'}" style="${mi===0?'':'display:none'}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <span style="font-size:11px;color:var(--tx3)">${CUR_SYS==='dgu'?'피착제':'색상코드'}</span>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${colorTabsHtml}</div>
        <button class="btn sm" style="margin-left:auto" onclick="addSpecimenToOrder('${order.id}','${m}')">${CUR_SYS==='dgu'?'+ 피착제 추가':'+ 색상 추가'}</button>
      </div>
      ${colorPanels}
    </div>`;
  }).join('');

  return `
    <div style="background:var(--bbg);border:1px solid rgba(56,139,253,.25);border-radius:8px;padding:10px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--b)"> 의뢰 메일 파싱으로 항목 자동생성</span>
      <button class="btn sm" style="background:var(--b);border-color:var(--b);color:#fff" onclick="openMailParseModal('${order.id}')">메일 파싱</button>
      <span style="font-size:11px;color:var(--tx3);margin-left:4px">파싱 후 직접 편집 가능</span>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <div class="maker-tabs">${makerTabsHtml}</div>
      <button class="btn sm" style="margin-left:auto" onclick="addMakerToOrder('${order.id}')">+ 도료사 추가</button>
    </div>
    ${makerPanels}
  `;
}

function renderSpecimenItems(order, spIdx){
  const sp = order.specimens[spIdx];
  if(!sp) return '';
  const sectionsHtml = sp.sections.map((sec, secIdx)=>{
    const secCost = sec.items.filter(it=>it.checked).reduce((s,it)=>s+it.price,0);
    const isReceived = sec.receiptOk || false;
    const receiptDate = sec.receiptDate || '';
    const receiptEa = sec.receiptEa || '';
    const receiptNote = sec.receiptNote || '';

    const totalItems = sec.items.length;
    const rowsHtml = sec.items.map((item, itemIdx)=>`
      <tr draggable="true"
        ondragstart="itemDragStart(event,'${order.id}',${spIdx},${secIdx},${itemIdx})"
        ondragover="itemDragOver(event)"
        ondrop="itemDrop(event,'${order.id}',${spIdx},${secIdx},${itemIdx})"
        ondragend="itemDragEnd(event)"
        style="cursor:default">
        <td><div class="item-name-cell">
          <span class="drag-handle" title="드래그하여 순서 변경">⠿</span>
          <input type="checkbox" class="item-check" ${item.checked?'checked':''}
            onchange="toggleItem('${order.id}',${spIdx},${secIdx},${itemIdx},this.checked)">
          <span style="cursor:text" ondblclick="this.contentEditable='true';this.style.background='var(--bg3)';this.style.padding='1px 4px';this.style.borderRadius='3px';this.focus()" onblur="renameItem('${order.id}',${spIdx},${secIdx},${itemIdx},this.textContent.trim());this.contentEditable='false';this.style.background='';this.style.padding=''">${normItemName(item.name, sec.name)}</span>
        </div></td>
        <td class="unit-price" style="cursor:text" title="더블클릭하여 단가 수정" ondblclick="editItemPrice('${order.id}',${spIdx},${secIdx},${itemIdx},this)">${item.price.toLocaleString()}원</td>
        <td style="text-align:right">
          <button class="del-row-btn" onclick="deleteItem('${order.id}',${spIdx},${secIdx},${itemIdx})" title="항목 삭제">×</button>
        </td>
      </tr>
    `).join('');

    return `<div class="item-section">
      <div class="item-section-head">
        <span class="item-section-name">${sec.name}</span>
        <button class="btn ghost sm" style="font-size:11px" onclick="renameSec('${order.id}',${spIdx},${secIdx})">이름 변경</button>
        <button class="btn danger sm" style="font-size:11px" onclick="deleteSec('${order.id}',${spIdx},${secIdx})">섹션 삭제</button>
        <span class="item-section-cost">${secCost.toLocaleString()}원</span>
      </div>
      <!-- 시료수령 행 -->
      <div data-receipt="${order.id}-${spIdx}-${secIdx}"
        id="sec-receipt-${order.id}-${spIdx}-${secIdx}"
        style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:${isReceived?'rgba(45,164,78,.06)':'var(--bg2)'};border-bottom:1px solid var(--border);flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:600;color:${isReceived?'var(--g)':'var(--tx2)'}">
          <input type="checkbox" ${isReceived?'checked':''} style="width:14px;height:14px;accent-color:var(--g);cursor:pointer"
            onchange="toggleReceipt('${order.id}',${spIdx},${secIdx},this.checked)">
          검수완료
        </label>
        <input type="date" value="${receiptDate}"
          style="width:130px;padding:3px 7px;font-size:12px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:${receiptDate?'var(--tx)':'var(--tx3)'}"
          onchange="updateSecReceipt('${order.id}',${spIdx},${secIdx},'date',this.value)"
          placeholder="수령일">
        <input type="number" value="${receiptEa}" min="1" placeholder="EA"
          style="width:60px;padding:3px 7px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--tx)"
          onchange="updateSecReceipt('${order.id}',${spIdx},${secIdx},'ea',this.value)">
        <input type="text" value="${receiptNote}" placeholder="비고"
          style="flex:1;min-width:100px;padding:3px 7px;font-size:12px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--tx)"
          onchange="updateSecReceipt('${order.id}',${spIdx},${secIdx},'note',this.value)">
      </div>
      <table class="item-table">
        <thead><tr>
          <th>시험항목</th>
          <th style="text-align:right;width:100px">단가</th>
          <th style="width:36px"></th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <button class="section-add-btn" onclick="openAddItem('${order.id}',${spIdx},${secIdx},'${sec.name}')">
        ＋ 항목 추가
      </button>
    </div>`;
  }).join('');

  const spTotal = calcSpCost(sp);
  // 검수 현황 요약
  const totalSecs = sp.sections.length;
  const doneSecs = sp.sections.filter(s=>s.receiptOk).length;
  const receiptSummary = doneSecs===totalSecs
    ? `<span style="color:var(--g);font-size:12px">✓ 전체 검수완료</span>`
    : `<span style="color:var(--tx3);font-size:12px">${doneSecs}/${totalSecs} 검수완료</span>`;

  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--tx2)">시편종류 추가:</span>
      <button class="btn sm primary" onclick="openAddSecModal('${order.id}',${spIdx})">+ 추가</button>
      <label style="display:flex;align-items:center;gap:6px;margin-left:auto;cursor:pointer;font-size:12px;font-weight:600;color:var(--tx2);border:1px solid var(--border2);border-radius:6px;padding:3px 10px;background:var(--bg3)">
        <input type="checkbox" id="all-receipt-cb-${order.id}-${spIdx}"
          ${doneSecs===totalSecs&&totalSecs>0?'checked':''}
          style="width:14px;height:14px;accent-color:var(--g);cursor:pointer"
          onchange="checkAllReceipt('${order.id}',${spIdx})">
        전체 검수완료
      </label>
    </div>
    ${sectionsHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--border);margin-top:4px">
      <div id="receipt-summary-${order.id}-${spIdx}">
        ${doneSecs===totalSecs
          ? `<span style="color:var(--g);font-size:12px;font-weight:600">✓ 전체 검수완료</span>`
          : `<span style="color:var(--tx3);font-size:12px">${doneSecs}/${totalSecs} 검수완료</span>`}
      </div>
      <div>
        <span style="font-size:12px;color:var(--tx2)">이 시편 소계 </span>
        <span style="font-family:var(--mono);font-size:14px;font-weight:700;color:var(--o)">${spTotal.toLocaleString()}원</span>
      </div>
    </div>
    ${renderReceiptNotes(sp)}
  `;
}

// ── 탭 상태 기억 (업체/색상 탭 위치 복원용)
const tabState = {}; // {orderId: {maker, color}}

function switchMakerTab(orderId, maker, btn){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const makers=[...new Set(order.specimens.map(sp=>sp.maker))];
  makers.forEach(m=>{
    const p=document.getElementById(`mpanel-${orderId}-${m}`);
    if(p){p.style.display=m===maker?'':'none';}
  });
  btn.closest('.maker-tabs').querySelectorAll('.maker-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // 상태 저장
  if(!tabState[orderId]) tabState[orderId]={};
  tabState[orderId].maker = maker;
  // 해당 업체의 첫 색상으로 color 초기화
  const firstColor = order.specimens.find(sp=>sp.maker===maker)?.color;
  if(firstColor) tabState[orderId].color = firstColor;
}

function switchColorTab(orderId, maker, color, btn){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sps=order.specimens.filter(sp=>sp.maker===maker);
  sps.forEach(sp=>{
    const p=document.getElementById(`cpanel-${orderId}-${maker}-${sp.color}`);
    if(p) p.style.display=sp.color===color?'':'none';
  });
  btn.closest('div').querySelectorAll('.maker-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // 상태 저장
  if(!tabState[orderId]) tabState[orderId]={};
  tabState[orderId].maker = maker;
  tabState[orderId].color = color;
}

function restoreTabState(orderId){
  const state = tabState[orderId];
  if(!state) return;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;

  const makers=[...new Set(order.specimens.map(sp=>sp.maker))];
  const validMaker = makers.includes(state.maker) ? state.maker : makers[0];
  if(!validMaker) return;

  // 업체 패널 표시/숨김
  makers.forEach(m=>{
    const p=document.getElementById(`mpanel-${orderId}-${m}`);
    if(p) p.style.display=m===validMaker?'':'none';
  });
  // 업체 탭 버튼 활성화
  document.querySelectorAll(`#tab-items-${orderId} .maker-tabs .maker-tab`).forEach(b=>{
    b.classList.toggle('active', b.textContent.trim()===validMaker);
  });

  // 색상 탭 복원
  const spOfMaker = order.specimens.filter(sp=>sp.maker===validMaker);
  const validColor = spOfMaker.find(sp=>sp.color===state.color) ? state.color : spOfMaker[0]?.color;
  if(!validColor) return;

  spOfMaker.forEach(sp=>{
    const p=document.getElementById(`cpanel-${orderId}-${validMaker}-${sp.color}`);
    if(p) p.style.display=sp.color===validColor?'':'none';
  });
  // 색상 탭 버튼 활성화 (mpanel 안에 있는 maker-tab 버튼들)
  const makerPanel = document.getElementById(`mpanel-${orderId}-${validMaker}`);
  if(makerPanel){
    makerPanel.querySelectorAll('.maker-tab').forEach(b=>{
      b.classList.toggle('active', b.textContent.trim()===validColor);
    });
  }
}

// ── 항목 조작 ──
function toggleItem(orderId, spIdx, secIdx, itemIdx, checked){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  order.specimens[spIdx].sections[secIdx].items[itemIdx].checked = checked;
  refreshSectionCost(orderId, spIdx, secIdx);
  refreshOrderCost(orderId);
  updateYearCost();
}

function deleteItem(orderId, spIdx, secIdx, itemIdx){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  order.specimens[spIdx].sections[secIdx].items.splice(itemIdx,1);
  reRenderDetail(orderId);
}

function moveItem(orderId, spIdx, secIdx, itemIdx, dir){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const items = order.specimens[spIdx].sections[secIdx].items;
  const newIdx = itemIdx + dir;
  if(newIdx<0 || newIdx>=items.length) return;
  [items[itemIdx], items[newIdx]] = [items[newIdx], items[itemIdx]];
  reRenderDetail(orderId);
}

// ── 드래그 앤 드롭 (항목 순서 변경)
let _drag = null; // {orderId, spIdx, secIdx, itemIdx}

function itemDragStart(e, orderId, spIdx, secIdx, itemIdx){
  _drag = {orderId, spIdx:+spIdx, secIdx:+secIdx, itemIdx:+itemIdx};
  e.currentTarget.classList.add('drag-source');
  e.dataTransfer.effectAllowed = 'move';
}

function itemDragOver(e){
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  // 현재 hover 행 표시
  document.querySelectorAll('tr.drag-over').forEach(r=>r.classList.remove('drag-over'));
  e.currentTarget.classList.add('drag-over');
}

function itemDrop(e, orderId, spIdx, secIdx, itemIdx){
  e.preventDefault();
  if(!_drag) return;
  const to = {orderId, spIdx:+spIdx, secIdx:+secIdx, itemIdx:+itemIdx};
  // 같은 섹션 내에서만 이동
  if(_drag.orderId!==to.orderId || _drag.spIdx!==to.spIdx || _drag.secIdx!==to.secIdx) return;
  if(_drag.itemIdx===to.itemIdx) return;

  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const items = order.specimens[to.spIdx].sections[to.secIdx].items;
  const [moved] = items.splice(_drag.itemIdx, 1);
  items.splice(to.itemIdx, 0, moved);
  _drag = null;
  reRenderDetail(orderId);
}

function itemDragEnd(e){
  document.querySelectorAll('tr.drag-over, tr.drag-source').forEach(r=>{
    r.classList.remove('drag-over','drag-source');
  });
  _drag = null;
}

function deleteSec(orderId, spIdx, secIdx){
  if(!confirm('이 섹션을 삭제할까요?')) return;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  order.specimens[spIdx].sections.splice(secIdx,1);
  reRenderDetail(orderId);
}

function renameSec(orderId, spIdx, secIdx){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const name=prompt('새 섹션 이름:', order.specimens[spIdx].sections[secIdx].name);
  if(!name) return;
  order.specimens[spIdx].sections[secIdx].name=name;
  reRenderDetail(orderId);
}

function addSection(orderId, spIdx, sname){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  if(order.specimens[spIdx].sections.find(s=>s.name===sname)){alert('이미 있는 섹션입니다');return;}
  order.specimens[spIdx].sections.push({
    name:sname,
    items:(DEFAULT_ITEMS[sname]||[]).map(n=>({name:n,price:PRICE_MAP[n]||0,checked:true})),
  });
  reRenderDetail(orderId);
}

function addMakerToOrder(orderId){
  const maker=prompt('추가할 도료사 이름:');
  if(!maker) return;
  const color=prompt('색상코드:');
  if(!color) return;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  order.specimens.push({
    maker:maker.trim(), color:color.trim(),
    sections:[{name:'완성도막',items:(DEFAULT_ITEMS['완성도막']||[]).map(n=>({name:n,price:PRICE_MAP[n]||0,checked:true}))}],
    receiptDate:'',receiptCnt:'',receiptOk:false,
  });
  reRenderDetail(orderId);
}

function addSpecimenToOrder(orderId, maker){
  const color=prompt(`${maker}에 추가할 색상코드:`);
  if(!color) return;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  order.specimens.push({
    maker, color:color.trim(),
    sections:[{name:'완성도막',items:(DEFAULT_ITEMS['완성도막']||[]).map(n=>({name:n,price:PRICE_MAP[n]||0,checked:true}))}],
    receiptDate:'',receiptCnt:'',receiptOk:false,
  });
  reRenderDetail(orderId);
}

// ── 시료수령 (섹션별) ──
function toggleReceipt(orderId, spIdx, secIdx, checked){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sec = order.specimens[spIdx].sections[secIdx];
  sec.receiptOk = checked;
  if(checked && !sec.receiptDate){
    sec.receiptDate = new Date().toISOString().slice(0,10);
  }

  // ── 주문 전체 상태 자동 업데이트
  const allSections = order.specimens.flatMap(sp=>sp.sections);
  const totalSec = allSections.length;
  const doneSec  = allSections.filter(s=>s.receiptOk).length;

  if(doneSec === totalSec && totalSec > 0){
    // 모든 섹션 검수완료 → 진행중으로 변경
    if(order.status === 'wait') {
      order.status = 'ip';
      // 현대차 알림 토스트
      showToast(' 전체 시료 검수 완료 — 현대차 담당자에게 수령 확인 알림이 발송됩니다.', 'g', 4000);
    }
  } else if(doneSec === 0 && order.status === 'ip'){
    // 모두 해제하면 대기로 복귀
    order.status = 'wait';
  }

  // DOM 직접 업데이트 (reRenderDetail 호출 안 함 → 탭/색상 위치 유지)
  const receiptRow = document.querySelector(`[data-receipt="${orderId}-${spIdx}-${secIdx}"]`);
  if(receiptRow){
    const dateInput = receiptRow.querySelector('input[type=date]');
    if(dateInput && sec.receiptDate) dateInput.value = sec.receiptDate;
    receiptRow.style.background = checked ? 'rgba(45,164,78,.06)' : 'var(--bg2)';
    const label = receiptRow.querySelector('label');
    if(label) label.style.color = checked ? 'var(--g)' : 'var(--tx2)';
  }
  const secEl = document.getElementById(`sec-receipt-${orderId}-${spIdx}-${secIdx}`);
  if(secEl) secEl.style.background = checked ? 'rgba(45,164,78,.06)' : 'var(--bg2)';
  refreshReceiptSummary(orderId, spIdx);
  renderOrderList();
  updateYearCost();
}

function refreshReceiptSummary(orderId, spIdx){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sp = order.specimens[spIdx];
  const total = sp.sections.length;
  const done = sp.sections.filter(s=>s.receiptOk).length;
  const el = document.getElementById(`receipt-summary-${orderId}-${spIdx}`);
  if(!el) return;
  if(done===total){
    el.innerHTML = `<span style="color:var(--g);font-size:12px;font-weight:600">✓ 전체 검수완료</span>`;
  } else {
    el.innerHTML = `<span style="color:var(--tx3);font-size:12px">${done}/${total} 검수완료</span>`;
  }
}

function updateSecReceipt(orderId, spIdx, secIdx, field, value){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sec = order.specimens[spIdx].sections[secIdx];
  if(field==='date') sec.receiptDate = value;
  else if(field==='ea') sec.receiptEa = value;
  else if(field==='note') sec.receiptNote = value;
}

// ── 전체 검수완료 일괄 체크 (DOM 직접 업데이트로 탭 위치 유지)
function checkAllReceipt(orderId, spIdx){
  const idx = parseInt(spIdx);
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sp = order.specimens[idx];
  if(!sp) return;
  const today = new Date().toISOString().slice(0,10);
  const allDone = sp.sections.every(s=>s.receiptOk);
  const newState = !allDone;

  sp.sections.forEach((sec, secIdx)=>{
    sec.receiptOk = newState;
    if(newState && !sec.receiptDate) sec.receiptDate = today;

    // DOM 직접 업데이트
    const row = document.querySelector(`[data-receipt="${orderId}-${idx}-${secIdx}"]`);
    if(row){
      row.style.background = newState ? 'rgba(45,164,78,.06)' : 'var(--bg2)';
      const cb = row.querySelector('input[type=checkbox]');
      if(cb) cb.checked = newState;
      const lbl = row.querySelector('label');
      if(lbl) lbl.style.color = newState ? 'var(--g)' : 'var(--tx2)';
      const dateInput = row.querySelector('input[type=date]');
      if(dateInput && sec.receiptDate) dateInput.value = sec.receiptDate;
    }
  });

  // 전체 체크 박스도 업데이트
  const allCb = document.getElementById(`all-receipt-cb-${orderId}-${idx}`);
  if(allCb) allCb.checked = newState;

  // 검수 현황 요약 업데이트
  refreshReceiptSummary(orderId, idx);

  // 전체 주문 상태 업데이트
  const allSections = order.specimens.flatMap(s=>s.sections);
  const doneSec = allSections.filter(s=>s.receiptOk).length;
  if(doneSec === allSections.length && allSections.length>0 && order.status==='wait'){
    order.status='ip';
    showToast(' 전체 시료 검수 완료 — 현대차 담당자에게 수령 확인 알림이 발송됩니다.','g',4000);
  } else if(doneSec===0 && order.status==='ip'){
    order.status='wait';
  }
  renderOrderList();
  updateYearCost();
}

// ── 비고 내용 표시 (비고가 있는 섹션만)
function renderReceiptNotes(sp){
  const notes = sp.sections
    .filter(s=>s.receiptNote&&s.receiptNote.trim())
    .map(s=>`<div style="display:flex;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--tx3);flex-shrink:0;min-width:80px">${s.name}</span>
      <span style="color:var(--o)">${s.receiptNote}</span>
    </div>`);
  if(!notes.length) return '';
  return `<div style="margin-top:8px;background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:6px;padding:10px 12px">
    <div style="font-size:11px;font-weight:700;color:var(--o);margin-bottom:6px">시료수령 비고</div>
    ${notes.join('')}
  </div>`;
}

// ── 차수 삭제
function deleteOrder(orderId){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!confirm(`[${order.cha}] ${order.purpose}\n\n이 차수를 삭제합니까? 복구할 수 없습니다.`)) return;
  activeDB().orders[CY] = activeDB().orders[CY].filter(o=>o.id!==orderId);
  autoSave();
  if(selectedOrderId===orderId){
    selectedOrderId = activeDB().orders[CY][0]?.id||null;
  }
  renderOrderList();
  if(selectedOrderId) renderOrderDetail(selectedOrderId);
  else document.getElementById('order-detail').innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--tx3)"><div>차수를 선택하거나 새로 등록하세요</div></div>`;
  updateYearCost();
}
function openAddItem(orderId, spIdx, secIdx, secName){
  addItemTarget={orderId,spIdx,secIdx};
  document.getElementById('ai-section').value=secName;
  document.getElementById('ai-item-sel').value='';
  document.getElementById('ai-price').value='';
  document.getElementById('ai-custom-wrap').style.display='none';

  // 현재 시스템에 따라 optgroup 표시/숨김
  const isWheel = CUR_SYS === 'wheel';
  const isDgu   = CUR_SYS === 'dgu';
  const bodyOpts  = ['ai-opt-body-1','ai-opt-body-2'];
  const wheelOpts = ['ai-opt-wheel'];
  const dguOpts   = ['ai-opt-dgu'];
  bodyOpts.forEach(id=>{  const el=document.getElementById(id); if(el) el.style.display=isWheel||isDgu?'none':''; });
  wheelOpts.forEach(id=>{ const el=document.getElementById(id); if(el) el.style.display=isWheel?'':'none'; });
  dguOpts.forEach(id=>{   const el=document.getElementById(id); if(el) el.style.display=isDgu?'':'none'; });

  openModal('add-item-modal');
}

function onAiItemSel(val){
  const isCustom = val==='' || val.startsWith('__custom__');
  document.getElementById('ai-custom-wrap').style.display = isCustom&&val!=='' ? 'block' : 'none';
  if(val && !isCustom){
    // value 형식: "항목명|가격"
    const parts = val.split('|');
    const price = parts[1] ? parseInt(parts[1]) : 0;
    document.getElementById('ai-price').value = price || '';
  }
}

function confirmAddItem(){
  const {orderId,spIdx,secIdx}=addItemTarget;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sel=document.getElementById('ai-item-sel').value;
  // value 형식: "항목명|가격" 또는 "__custom__|0"
  const isCustom = sel.startsWith('__custom__') || sel==='';
  const name = isCustom
    ? document.getElementById('ai-custom').value.trim()
    : sel.split('|')[0];
  if(!name){alert('항목 이름을 입력하세요');return;}
  const price=parseInt(document.getElementById('ai-price').value)||0;
  order.specimens[spIdx].sections[secIdx].items.push({name,price,checked:true});
  closeModal('add-item-modal');
  reRenderDetail(orderId);
}

// ══════════════════════════════════════════════════════
// 시료수령 탭
// ══════════════════════════════════════════════════════
function renderReceiptTab(order){
  return `
    <div style="margin-bottom:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <div class="field" style="margin:0;flex:1;min-width:160px">
        <label>수령일</label>
        <input type="date" id="receipt-date-${order.id}" value="${order.receiptDate||''}"
          onchange="order.receiptDate=this.value">
      </div>
      <div style="flex:1;min-width:160px">
        <label style="font-size:12px;color:var(--tx2);display:block;margin-bottom:4px">비고</label>
        <input type="text" id="receipt-note-${order.id}" value="${order.receiptNote||''}"
          placeholder="시료 수령 관련 특이사항" onchange="order.receiptNote=this.value">
      </div>
    </div>
    <div class="receipt-grid">
      ${order.specimens.map((sp,si)=>`
        <div class="receipt-card">
          <div class="receipt-maker">${sp.maker}</div>
          <div class="receipt-color">${sp.color}</div>
          <div class="receipt-field">
            <span class="receipt-label">수령수량</span>
            <input class="receipt-input" type="number" value="${sp.receiptCnt||''}" placeholder="EA"
              onchange="order.specimens[${si}].receiptCnt=this.value">
          </div>
          <div class="receipt-field">
            <span class="receipt-label">수령일</span>
            <input class="receipt-input" type="date" value="${sp.receiptDate||order.receiptDate||''}"
              onchange="order.specimens[${si}].receiptDate=this.value">
          </div>
          <div class="receipt-ok">
            <input type="checkbox" ${sp.receiptOk?'checked':''}
              onchange="order.specimens[${si}].receiptOk=this.checked;updateReceiptStatus('${order.id}')">
            <span>검수 완료</span>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:12px;padding:10px 14px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--tx2)">검수 현황</span>
      <span style="font-family:var(--mono);font-size:13px;font-weight:700" id="receipt-status-${order.id}">
        ${order.specimens.filter(s=>s.receiptOk).length} / ${order.specimens.length} 완료
      </span>
      <button class="btn sm" style="margin-left:auto" onclick="checkAllReceipt('${order.id}')">전체 검수완료</button>
    </div>
  `;
}

function updateReceiptStatus(orderId){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const el=document.getElementById(`receipt-status-${orderId}`);
  if(el) el.textContent=`${order.specimens.filter(s=>s.receiptOk).length} / ${order.specimens.length} 완료`;
}



function renderCostTab(order){
  return `<div id="cost-content-${order.id}">${buildCostHtml(order)}</div>`;
}

function buildCostHtml(order){
  // 항목별 집계 (모든 시편 합산)
  const itemTotals = {};
  order.specimens.forEach(sp=>{
    sp.sections.forEach(sec=>{
      sec.items.filter(it=>it.checked).forEach(it=>{
        if(!itemTotals[it.name]) itemTotals[it.name]={price:it.price,count:0};
        itemTotals[it.name].count++;
      });
    });
  });
  const rows = Object.entries(itemTotals);
  const total = rows.reduce((s,[,v])=>s+(v.price*v.count),0);

  const rowsHtml = rows.length
    ? rows.map(([name,v])=>`
        <tr>
          <td>${name}</td>
          <td class="cost-num">${v.count}회</td>
          <td class="cost-num">${v.price.toLocaleString()}원</td>
          <td class="cost-num pos">${(v.price*v.count).toLocaleString()}원</td>
        </tr>`).join('')
    : `<tr><td colspan="4" style="text-align:center;color:var(--tx3);padding:20px">시험항목을 선택하세요</td></tr>`;

  // 시편별 소계
  const spRows = order.specimens.map(sp=>{
    const cost=calcSpCost(sp);
    return `<tr>
      <td style="font-family:var(--mono)">${sp.maker} · ${sp.color}</td>
      <td colspan="2" style="color:var(--tx3);font-size:12px">${sp.sections.map(s=>s.name).join(', ')}</td>
      <td class="cost-num pos">${cost.toLocaleString()}원</td>
    </tr>`;
  }).join('');

  return `
    <div style="margin-bottom:16px">
      <div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">항목별 집계</div>
      <div class="cost-summary">
        <table class="cost-table">
          <thead><tr><th>시험항목</th><th style="text-align:right">횟수</th><th style="text-align:right">단가</th><th style="text-align:right">소계</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr class="cost-total-row">
              <td colspan="3">차수 합계</td>
              <td class="cost-num total">${total.toLocaleString()}원</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div>
      <div style="font-size:12px;font-weight:700;color:var(--tx2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">시편별 소계</div>
      <div class="cost-summary">
        <table class="cost-table">
          <thead><tr><th>시편</th><th colspan="2">시험 구분</th><th style="text-align:right">금액</th></tr></thead>
          <tbody>${spRows}</tbody>
          <tfoot>
            <tr class="cost-total-row">
              <td colspan="3">합계</td>
              <td class="cost-num total">${total.toLocaleString()}원</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
    <div style="margin-top:12px;display:flex;justify-content:flex-end">
      <button class="btn primary" onclick="exportCostCsv('${order.id}')">CSV 다운로드</button>
    </div>
  `;
}

function editItemPrice(orderId, spIdx, secIdx, itemIdx, td){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const item=order.specimens[spIdx]?.sections[secIdx]?.items[itemIdx]; if(!item) return;
  const input=document.createElement('input');
  input.type='number'; input.value=item.price;
  input.style.cssText='width:90px;padding:2px 5px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--b);border-radius:4px;color:var(--tx);outline:none;text-align:right';
  td.innerHTML=''; td.appendChild(input); input.focus(); input.select();
  const commit=()=>{
    const v=parseInt(input.value)||0; item.price=v;
    td.textContent=v.toLocaleString()+'원';
    td.ondblclick=()=>editItemPrice(orderId,spIdx,secIdx,itemIdx,td);
    refreshSectionCost(orderId,spIdx,secIdx); autoSave();
  };
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',e=>{ if(e.key==='Enter') input.blur(); });
}

function renameItem(orderId, spIdx, secIdx, itemIdx, newName){
  if(!newName) return;
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const item=order.specimens[spIdx]?.sections[secIdx]?.items[itemIdx]; if(!item) return;
  item.name=newName;
  autoSave();
}

function refreshCostTab(orderId){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const el=document.getElementById(`cost-content-${orderId}`);
  if(el) el.innerHTML=buildCostHtml(order);
}

function refreshSectionCost(orderId, spIdx, secIdx){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const sec=order.specimens[spIdx].sections[secIdx];
  const cost=sec.items.filter(it=>it.checked).reduce((s,it)=>s+it.price,0);
  // section head cost
  const heads=document.querySelectorAll(`[id^="tab-items-${orderId}"] .item-section-cost`);
  if(heads[secIdx]) heads[secIdx].textContent=cost.toLocaleString()+'원';
  refreshOrderCost(orderId);
}

function refreshOrderCost(orderId){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const cost=calcOrderCost(order);
  // 목록의 비용 갱신
  renderOrderList();
  updateYearCost();
}

// ══════════════════════════════════════════════════════
// 비용 계산
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// 신규 차수 등록 (메일 파싱 우선)
// ══════════════════════════════════════════════════════
let noParsedData = null; // 파싱 결과 임시 저장

function openNewOrderModal(){
  noParsedData = null;
  document.getElementById('no-mail-text').value = '';
  document.getElementById('no-step1').style.display = 'block';
  document.getElementById('no-step2').style.display = 'none';
  document.getElementById('no-step2-dgu').style.display = 'none';
  document.getElementById('no-parse-summary').innerHTML = '';
  document.getElementById('no-date').value = new Date().toISOString().slice(0,10);
  // DGU textarea placeholder 교체
  const ta = document.getElementById('no-mail-textarea');
  if(ta){
    ta.placeholder = CUR_SYS==='dgu'
      ? '메일 본문을 여기에 붙여넣기(Ctrl+V)\n\n자동 추출 항목:\n· 평가목적, 담당자, 의뢰일\n· 실러 업체명\n· 피착제 계층 (GLASS/선루프/도장 → 업체 → 제품코드)\n· 시험항목 (KNIFE CUT, 경도, 실러물성 등)'
      : 'Outlook에서 메일 본문 전체 선택(Ctrl+A) → 복사(Ctrl+C) → 여기 붙여넣기(Ctrl+V)\n\n아래 항목이 자동 추출됩니다:\n· 평가목적, 담당자, 업체, 색상코드, 총 EA\n· 시편종류별 시험항목 (①②③ 번호 패턴)';
  }
  document.getElementById('no-xlsx-status').style.display = 'none';
  // 시스템 배지 표시
  const badge = document.getElementById('no-sys-badge');
  if(badge){ badge.textContent = CUR_SYS==='wheel' ? '휠도장' : CUR_SYS==='dgu' ? '' : '차체도장'; badge.style.display = CUR_SYS==='dgu' ? 'none' : ''; }
  // STEP1 안내 텍스트 교체
  const infoEl = document.getElementById('no-step1-info');
  if(infoEl){
    if(CUR_SYS==='dgu'){
      infoEl.innerHTML = '메일 본문을 붙여넣으면<br><b>실러업체·피착제 계층·시험항목</b>이 자동으로 읽혀집니다.';
    } else {
      infoEl.innerHTML = '메일 본문을 붙여넣거나, 캡처 이미지를 붙여넣거나, 기존 시험항목 엑셀 파일을 올리면<br><b>업체·색상·시편종류·시험항목</b>이 자동으로 읽혀집니다.';
    }
  }
  // 업체/색상 초기화
  document.getElementById('no-maker').value = '';
  document.getElementById('no-colors').value = '';
  document.getElementById('no-color-rows').innerHTML = '';
  noSwitchTab('text', document.getElementById('no-tab-text'));
  openModal('new-order-modal');
}

// ── 업체 입력 후 차종 입력 행 동적 생성
function noRebuildColorRows(){
  const makerStr = document.getElementById('no-maker').value.trim();
  const makers = makerStr ? makerStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean) : [];
  const container = document.getElementById('no-color-rows');

  // 기존 값 보존 (row가 이미 있으면 현재 값 읽기)
  const existing = {};
  container.querySelectorAll('[data-maker-row]').forEach(row=>{
    const mk = row.dataset.makerRow;
    const inp = row.querySelector('input');
    if(inp) existing[mk] = inp.value;
  });

  // noParsedData에서 기존 차종 매핑 활용
  const parsedMap = noParsedData?.colorsByMaker || {};

  if(!makers.length){
    // 업체 없으면 단순 색상 입력
    container.innerHTML = `<div class="field">
      <label>${CUR_SYS==='wheel'?'차종코드':'색상코드'} <span style="font-size:11px;color:var(--tx3)">(쉼표 구분)</span></label>
      <input id="no-colors-single" placeholder="${CUR_SYS==='wheel'?'예: JK PE, RG3, JK HEV':'예: NRB, HT7, SMZ'}"
        value="${document.getElementById('no-colors').value}"
        oninput="document.getElementById('no-colors').value=this.value">
    </div>`;
    return;
  }

  const isWheel = CUR_SYS === 'wheel';
  const isDguMode = CUR_SYS === 'dgu';
  const placeholder = isWheel ? '예: JK PE, RG3' : isDguMode ? '예: GLASS_FUYAO_TDF9324' : '예: NRB, HT7';
  const colorLabel = isWheel ? '차종' : isDguMode ? '피착제 코드' : '색상코드';

  container.innerHTML = makers.map(mk=>{
    // 우선순위: 현재 입력값 → parsedData → 빈칸
    const val = existing[mk] !== undefined ? existing[mk]
              : (parsedMap[mk]||[]).join(', ');
    return `<div data-maker-row="${mk}" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:6px 10px;background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
      <span style="font-size:12px;font-weight:600;color:var(--b);font-family:var(--mono);min-width:110px;flex-shrink:0">${mk}</span>
      <div style="flex:1">
        <input placeholder="${placeholder}" value="${val}"
          style="width:100%;padding:5px 8px;font-size:12px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border2);border-radius:5px;color:var(--tx);outline:none;box-sizing:border-box"
          onfocus="this.style.borderColor='var(--b)'" onblur="this.style.borderColor='var(--border2)'"
          oninput="noSyncColorHidden();noWheelTkRefresh()">
      </div>
      <span style="font-size:10px;color:var(--tx3)">${colorLabel}</span>
    </div>`;
  }).join('');

  noSyncColorHidden();

  // 휠도장이면 도막두께 포인트 수 입력 UI 표시
  noWheelTkRefresh();
}

// ── 휠도장 도막두께 포인트 수 입력 UI 갱신
function noWheelTkRefresh(){
  const wrap = document.getElementById('no-wheel-tk-wrap');
  if(!wrap) return;

  const isWheel = CUR_SYS === 'wheel';
  const items = noParsedData?.sectionItems?.['완성도막'] || [];
  const hasTk = isWheel && (items.includes('도막두께') || items.length === 0);
  wrap.style.display = (isWheel && (hasTk || CUR_SYS==='wheel')) ? 'block' : 'none';
  if(!isWheel) return;

  // 기존 포인트 수 보존
  const prevPts = {};
  document.querySelectorAll('[data-tk-point-row]').forEach(row=>{
    const key = row.dataset.tkPointRow;
    const inp = row.querySelector('input');
    if(inp && inp.value) prevPts[key] = inp.value;
  });

  // DOM의 업체별 차종 입력값에서 직접 읽기 (noSyncColorHidden 이전에도 정확함)
  const rowData = [];
  const makerRows = document.querySelectorAll('[data-maker-row]');
  if(makerRows.length){
    makerRows.forEach(row=>{
      const mk = row.dataset.makerRow;
      const inp = row.querySelector('input');
      const colorStr = inp ? inp.value.trim() : '';
      const colors = colorStr ? colorStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean) : [];
      if(colors.length){
        colors.forEach(c=> rowData.push({key:`${mk}__${c}`, label:`${mk} · ${c}`}));
      } else {
        rowData.push({key:`${mk}__?`, label:`${mk} · (차종 미입력)`});
      }
    });
  } else {
    // 업체 row 없음 — no-maker 입력값 기반
    const makerStr = document.getElementById('no-maker').value.trim();
    const makers = makerStr ? makerStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean) : [];
    const colorsByMaker = noParsedData?.colorsByMaker || {};
    if(makers.length){
      makers.forEach(mk=>{
        const colors = colorsByMaker[mk] || [];
        if(colors.length){
          colors.forEach(c=> rowData.push({key:`${mk}__${c}`, label:`${mk} · ${c}`}));
        } else {
          rowData.push({key:`${mk}__?`, label:`${mk} · (차종 미입력)`});
        }
      });
    } else {
      // 업체도 없으면 단순 전체
      rowData.push({key:'총계', label:'전체 (총 포인트 수)'});
    }
  }

  const rowsEl = document.getElementById('no-wheel-tk-rows');
  rowsEl.innerHTML = rowData.map(({key, label})=>{
    const safeKey = key.replace(/[^a-zA-Z0-9가-힣]/g,'_');
    const pts = prevPts[key] || '';
    const cost = pts ? (parseInt(pts)||0) * 25000 : 0;
    return `<div data-tk-point-row="${key}"
      style="display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--bg2);border-radius:5px;border:1px solid var(--border)">
      <span style="font-size:11px;color:var(--tx2);flex:1;font-family:var(--mono)">${label}</span>
      <div style="display:flex;align-items:center;gap:4px">
        <input type="number" min="1" placeholder="포인트 수" value="${pts}"
          style="width:72px;padding:3px 6px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none;text-align:center"
          onfocus="this.style.borderColor='var(--b)'" onblur="this.style.borderColor='var(--border2)'"
          oninput="noUpdateTkCost(this,'${key}')">
        <span style="font-size:10px;color:var(--tx3)">포인트</span>
      </div>
      <span id="tk-cost-${safeKey}"
        style="font-size:11px;font-family:var(--mono);color:var(--g);min-width:80px;text-align:right">
        ${cost ? cost.toLocaleString()+'원' : '—'}
      </span>
    </div>`;
  }).join('');
}

// ── 포인트 수 입력 시 비용 즉시 표시
function noUpdateTkCost(input, key){
  const pts = parseInt(input.value) || 0;
  const cost = pts * 25000;
  const safeKey = key.replace(/[^a-zA-Z0-9가-힣]/g,'_');
  const costEl = document.getElementById('tk-cost-'+safeKey);
  if(costEl) costEl.textContent = cost ? cost.toLocaleString()+'원' : '—';
}
function noSyncColorHidden(){
  const rows = document.querySelectorAll('[data-maker-row]');
  if(!rows.length){
    // 단순 입력 모드
    const single = document.getElementById('no-colors-single');
    if(single) document.getElementById('no-colors').value = single.value;
    return;
  }
  // 업체별 입력값 → colorsByMaker에 반영
  if(!noParsedData) noParsedData = {makers:[],colorsByMaker:{},sectionItems:{},sectionEA:{}};
  const makers = [];
  rows.forEach(row=>{
    const mk = row.dataset.makerRow;
    const inp = row.querySelector('input');
    const codes = inp ? inp.value.split(/[,，]+/).map(s=>s.trim()).filter(Boolean) : [];
    makers.push(mk);
    noParsedData.colorsByMaker[mk] = codes;
  });
  noParsedData.makers = makers;
  // 전체 색상 목록도 갱신
  const allColors = [...new Set(Object.values(noParsedData.colorsByMaker).flat())];
  document.getElementById('no-colors').value = allColors.join(',');
  // DOM 재생성 금지 — 포커스 유지를 위해 noRebuildColorRows 호출 안 함
}

function noMakerInput(){
  // 업체 입력 중 실시간 반영 (딜레이 없이)
}

function noSwitchTab(tab, btn){
  document.getElementById('no-tab-text-body').style.display  = tab==='text'?'block':'none';
  document.getElementById('no-tab-image-body').style.display = tab==='image'?'block':'none';
  document.getElementById('no-tab-xlsx-body').style.display  = tab==='xlsx'?'block':'none';
  ['no-tab-text','no-tab-image','no-tab-xlsx'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const isActive=(id===`no-tab-${tab}`);
    el.style.borderBottom=isActive?'2px solid var(--b)':'2px solid transparent';
    el.style.color=isActive?'var(--tx)':'var(--tx3)';
    el.style.fontWeight=isActive?'600':'400';
  });
  // 이미지 탭 포커스
  if(tab==='image') setTimeout(()=>document.getElementById('no-img-paste-zone')?.focus(),100);
}

// ── 이미지 붙여넣기 / 드롭
let noPastedImageBase64 = null;

function noHandleImagePaste(e){
  const items=[...(e.clipboardData?.items||[])];
  const imgItem=items.find(i=>i.type.startsWith('image/'));
  if(!imgItem){ showToast('클립보드에 이미지가 없습니다','o',2000); return; }
  e.preventDefault();
  const blob=imgItem.getAsFile();
  noLoadImageBlob(blob);
}

function noHandleImageDrop(e){
  e.preventDefault();
  document.getElementById('no-img-paste-zone').style.borderColor='var(--border2)';
  const file=e.dataTransfer.files[0];
  if(!file||!file.type.startsWith('image/')){ showToast('이미지 파일만 가능합니다','o',2000); return; }
  noLoadImageBlob(file);
}

function noLoadImageBlob(blob){
  const reader=new FileReader();
  reader.onload=e=>{
    const base64=e.target.result.split(',')[1];
    const mime=blob.type||'image/png';
    noPastedImageBase64={base64,mime};
    // 미리보기 표시
    const wrap=document.getElementById('no-img-preview-wrap');
    wrap.innerHTML=`
      <img src="data:${mime};base64,${base64}" style="max-width:100%;max-height:200px;border-radius:6px;margin-bottom:8px">
      <div style="font-size:12px;color:var(--g)">✓ 이미지 준비됨 — "파싱 → 다음" 버튼을 눌러주세요</div>
      <button class="btn sm" onclick="noClearImage()" style="margin-top:6px;font-size:11px">이미지 지우기</button>`;
    document.getElementById('no-img-status').textContent='';
  };
  reader.readAsDataURL(blob);
}

function noClearImage(){
  noPastedImageBase64=null;
  document.getElementById('no-img-preview-wrap').innerHTML=`
    
    <div style="font-size:14px;font-weight:600;color:var(--tx);margin-bottom:4px">캡처 후 여기에 Ctrl+V</div>
    <div style="font-size:12px;color:var(--tx3)">캡처도구로 화면 캡처 → Ctrl+C → 이 영역 클릭 후 Ctrl+V</div>`;
}

// ── Claude API로 이미지 OCR 파싱
async function noRunParseImage(){
  if(!noPastedImageBase64){
    showToast('이미지를 먼저 붙여넣으세요 (Ctrl+V)','o',2500);
    return;
  }
  // API 키 확인
  const apiKey = settingsGetKey();
  if(!apiKey){
    document.getElementById('no-img-status').innerHTML=
      `<span style="color:var(--r)">API 키가 없습니다.
       <button onclick="closeModal('new-order-modal');openModal('settings-modal')"
         style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:2px 8px;cursor:pointer;color:var(--b);font-size:11px;margin-left:6px">
         설정에서 API 키 입력
       </button></span>`;
    return;
  }
  const statusEl=document.getElementById('no-img-status');
  statusEl.innerHTML='<span style="color:var(--b)"> AI가 이미지를 분석 중입니다...</span>';

  const isWheel = CUR_SYS==='wheel';
  const sysPrompt = isWheel
    ? `당신은 현대자동차 휠 도장 평가 의뢰서를 분석하는 전문가입니다.
이미지에서 다음 정보를 추출하여 JSON으로만 응답하세요 (다른 텍스트 없이):
{
  "purpose": "평가목적",
  "mgr": "담당자 이름 (김환오/전재철/채종운/양지원/이재진 중 해당자)",
  "date": "YYYY-MM-DD 형식 날짜 (시편발송일 또는 메일 날짜)",
  "totalEa": 총 시편 수 (숫자),
  "makers": ["업체명1", "업체명2"],
  "colorsByMaker": {"업체명": ["차종코드1", "차종코드2"]},
  "items": ["도막두께", "도막두께-전처리", "부착성", "내수성", "내습성", "내치핑성", "내염수분무성", "CASS시험", "IR분석"],
  "wheelPoints": {"업체명": ["측정포인트1", "측정포인트2"]},
  "requirements": "요구사항 요약 (도막두께 기준 등)"
}
items는 이미지에서 언급된 항목만 포함하세요. 도막두께가 있으면 도막두께-전처리도 포함하세요.`
    : `당신은 현대자동차 차체도장 평가 의뢰서를 분석하는 전문가입니다.
이미지에서 다음 정보를 추출하여 JSON으로만 응답하세요:
{
  "purpose": "평가목적",
  "mgr": "담당자 이름",
  "date": "YYYY-MM-DD 날짜",
  "totalEa": 총 EA 수,
  "makers": ["업체명"],
  "colorsByMaker": {"업체명": ["색상코드"]},
  "sectionItems": {"시편종류": ["시험항목1", "시험항목2"]}
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {type:'image', source:{type:'base64', media_type:noPastedImageBase64.mime, data:noPastedImageBase64.base64}},
            {type:'text', text:'이 이미지에서 정보를 추출해주세요. JSON만 응답하세요.'}
          ]
        }],
        system: sysPrompt
      })
    });
    const data = await response.json();
    const rawText = data.content?.find(c=>c.type==='text')?.text||'';
    // JSON 파싱
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if(!jsonMatch) throw new Error('JSON 파싱 실패: '+rawText.slice(0,100));
    const parsed = JSON.parse(jsonMatch[0]);

    statusEl.innerHTML='<span style="color:var(--g)">✓ 분석 완료</span>';

    if(isWheel){
      // 휠도장 결과 적용
      const d = {
        makers: parsed.makers||[],
        colorsByMaker: parsed.colorsByMaker||{},
        sectionItems: {'완성도막': parsed.items||[...DEFAULT_ITEMS_WHEEL['완성도막']]},
        sectionEA: {'완성도막': parsed.totalEa||1},
        purpose: parsed.purpose||'',
        mgr: parsed.mgr||'',
        mailDate: parsed.date||'',
        totalEa: parsed.totalEa||0,
        wheelPoints: parsed.wheelPoints||{},
        _isWheel: true
      };
      if(!d.makers.length) d.makers=['미지정'];
      noParsedData = d;
      // 필드 자동채우기
      if(d.purpose) document.getElementById('no-purpose').value=d.purpose;
      if(d.mailDate) document.getElementById('no-date').value=d.mailDate;
      if(d.mgr){ const s=document.getElementById('no-mgr'); [...s.options].forEach(o=>o.selected=o.value===d.mgr); }
      document.getElementById('no-maker').value=d.makers.filter(m=>m!=='미지정').join(', ');
      const allColors=[...new Set(Object.values(d.colorsByMaker).flat())];
      document.getElementById('no-colors').value=allColors.join(',');
      noRebuildColorRows();
      if(d.totalEa) document.getElementById('no-cnt').value=d.totalEa;

      // 요약 표시
      const mkTag=v=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
      const clTag=v=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
      const itTag=v=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.25);border-radius:3px;padding:1px 6px;font-size:11px;margin-right:2px;display:inline-block">${v}</span>`;
      const row=(k,v)=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px"><span style="color:var(--tx3);width:75px;flex-shrink:0;font-size:11px">${k}</span><span style="flex:1">${v}</span></div>`;
      let rows='';
      rows+=row('업체', d.makers.map(mkTag).join(''));
      d.makers.forEach(mk=>{ const c=d.colorsByMaker[mk]||[]; if(c.length) rows+=row(`└${mk}`,c.map(clTag).join('')); });
      rows+=row('시험항목', d.sectionItems['완성도막'].map(itTag).join(''));
      if(parsed.requirements) rows+=row('요구사항',`<span style="font-size:11px;color:var(--tx2)">${parsed.requirements}</span>`);
      document.getElementById('no-parse-summary').innerHTML=`<div style="font-size:11px;font-weight:700;color:var(--g);margin-bottom:8px">✓ AI 이미지 파싱 완료 (휠도장)</div><div style="font-size:12px">${rows}</div>`;
    } else {
      // 차체도장 결과 적용
      const d = {
        makers: parsed.makers||[],
        colorsByMaker: parsed.colorsByMaker||{},
        sectionItems: parsed.sectionItems||{'완성도막':[...DEFAULT_ITEMS['완성도막']]},
        sectionEA:{},
        purpose:parsed.purpose||'',
        mgr:parsed.mgr||'',
        mailDate:parsed.date||'',
        totalEa:parsed.totalEa||0
      };
      if(!d.makers.length) d.makers=['미지정'];
      noParsedData=d;
      if(d.purpose) document.getElementById('no-purpose').value=d.purpose;
      if(d.mailDate) document.getElementById('no-date').value=d.mailDate;
      if(d.mgr){ const s=document.getElementById('no-mgr'); [...s.options].forEach(o=>o.selected=o.value===d.mgr); }
      document.getElementById('no-maker').value=d.makers.filter(m=>m!=='미지정').join(', ');
      const allColors=[...new Set(Object.values(d.colorsByMaker).flat())];
      document.getElementById('no-colors').value=allColors.join(',');
      noRebuildColorRows();
      if(d.totalEa) document.getElementById('no-cnt').value=d.totalEa;
    }
    document.getElementById('no-step1').style.display='none';
    document.getElementById('no-step2').style.display='block';
  } catch(err){
    statusEl.innerHTML=`<span style="color:var(--r)">분석 실패: ${err.message}</span>`;
    console.error('이미지 파싱 오류:', err);
  }
}

function noBackToStep1(){
  document.getElementById('no-step1').style.display = 'block';
  document.getElementById('no-step2').style.display = 'none';
  document.getElementById('no-step2-dgu').style.display = 'none';
  const dz = document.getElementById('no-xlsx-drop');
  if(dz){ dz.style.borderColor='var(--border2)'; dz.style.background='var(--bg3)'; }
}

// ── 엑셀 업로드 ──
function noXlsxDrop(e){
  e.preventDefault();
  const dz = document.getElementById('no-xlsx-drop');
  dz.style.borderColor='var(--border2)'; dz.style.background='var(--bg3)';
  const f = e.dataTransfer.files[0]; if(f) noXlsxRead(f);
}

function noXlsxRead(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      // SheetJS로 파싱
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, {type:'array'});

      // 데이터 시트 찾기 (단가표, 총합 제외)
      const dataSheet = wb.SheetNames.find(n=>!['단가표','총합'].includes(n));
      if(!dataSheet){ alert('데이터 시트를 찾을 수 없습니다'); return; }

      const ws = wb.Sheets[dataSheet];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:null});

      // 파싱 결과 객체
      const d = { makers:[], colorsByMaker:{}, sectionItems:{}, sectionEA:{},
                  purpose:'', mgr:'', specimens:[] };

      // 첫 행: 파일명에서 차수/담당자 추출
      const titleRow = rows[0]?.[0]||'';
      const mgrM = titleRow.match(/([가-힣]{2,4})\s*(?:책임)?연구원/);
      if(mgrM){ const n=mgrM[1]; if(['김환오','채종운','전재철','양지원','이재진'].includes(n)) d.mgr=n; }

      // 헤더 행 찾기 (업체명, 색상, 시편종류, 시험항목 포함)
      let headerIdx = rows.findIndex(r=> r && r.some(c=>c&&String(c).includes('업체명')));
      // 투톤 헤더 (루프, 바디)도 처리
      let isTwoTone = false;
      if(headerIdx===-1){
        headerIdx = rows.findIndex(r=> r && r.some(c=>c&&(String(c).includes('루프')||String(c).includes('바디'))));
        if(headerIdx>=0) isTwoTone = true;
      }
      if(headerIdx===-1){ alert('헤더 행(업체명/색상/시편종류/시험항목)을 찾을 수 없습니다'); return; }

      // 데이터 행 순회
      let curMaker='', curColor='', curSec='', curEA=null;
      const specMap = {}; // "maker|color" → sections[]

      for(let i=headerIdx+1; i<rows.length; i++){
        const row = rows[i]; if(!row) continue;
        const vals = row.map(c=>c===null?null:(c+'').trim());

        // 비용 합계 행이면 중지
        if(vals[0]&&String(vals[0]).includes('총 비용')) break;
        if(vals[0]&&String(vals[0]).includes('해당 시험')) break;

        const col0=vals[0], col1=vals[1], col2=vals[2], col3=vals[3], col4=vals[4];

        // 업체명 갱신
        if(col0 && col0.length<=6 && !/총|비용|EA|시편|시험|항목|루프|바디/.test(col0)) curMaker=col0;
        // 색상 갱신
        if(col1 && col1!=='-' && col1.length<=10 && !/시편종류|시험항목|비고/.test(col1)) curColor=col1;
        // 시편종류 갱신 (개행 포함 가능)
        if(col2 && !/시편종류|시험항목/.test(col2)){
          curSec = col2.replace(/\n/g,' ').trim();
          if(vals[4]&&!isNaN(parseInt(vals[4]))) curEA=parseInt(vals[4]);
          else if(col4&&!isNaN(parseInt(col4))) curEA=parseInt(col4);
        }
        // 시험항목
        const itemName = col3;
        if(!itemName || /시험항목|^$/.test(itemName)) continue;
        if(!curMaker||!curColor||!curSec) continue;

        const key = `${curMaker}|${curColor}`;
        if(!specMap[key]) specMap[key]={maker:curMaker, color:curColor, sections:[]};
        let sec = specMap[key].sections.find(s=>s.name===curSec);
        if(!sec){
          sec={name:curSec, ea:curEA, items:[]};
          specMap[key].sections.push(sec);
        }
        sec.items.push({name:itemName, price:PRICE_MAP[itemName]||getPrice(itemName), checked:true});

        // 업체/색상 수집
        if(!d.makers.includes(curMaker)) d.makers.push(curMaker);
        if(!d.colorsByMaker[curMaker]) d.colorsByMaker[curMaker]=[];
        if(!d.colorsByMaker[curMaker].includes(curColor)) d.colorsByMaker[curMaker].push(curColor);
      }

      // sectionItems 수집 (비용 파싱용)
      Object.values(specMap).forEach(sp=>{
        sp.sections.forEach(sec=>{
          if(!d.sectionItems[sec.name]) d.sectionItems[sec.name]=sec.items.map(i=>i.name);
        });
      });

      // specimens 직접 저장 (엑셀은 이미 완전한 구조)
      d.specimens = Object.values(specMap).map(sp=>({
        maker:sp.maker, color:sp.color, sections:sp.sections,
        receiptDate:'', receiptCnt:'', receiptOk:false
      }));

      noParsedData = d;
      noParsedData._fromXlsx = true; // 엑셀 소스 표시

      // 필드 자동채우기
      if(d.mgr){ const sel=document.getElementById('no-mgr'); [...sel.options].forEach(o=>o.selected=o.value===d.mgr); }
      document.getElementById('no-maker').value = d.makers.join(', ');
      const allColors = [...new Set(Object.values(d.colorsByMaker).flat())];
      document.getElementById('no-colors').value = allColors.join(',');
      noRebuildColorRows();
      document.getElementById('no-cnt').value = d.specimens.length * 10; // 대략

      // 드롭존 성공 표시
      const dz=document.getElementById('no-xlsx-drop');
      dz.style.borderColor='var(--g)'; dz.style.background='var(--gbg)';
      dz.innerHTML=`
        <div style="font-size:13px;font-weight:700;color:var(--g)">${file.name}</div>
        <div style="font-size:12px;color:var(--tx2);margin-top:4px">${d.specimens.length}개 시편 · ${Object.keys(d.sectionItems).length}개 시편종류 읽음</div>`;

      // 미리보기 표시
      const secs=[...new Set(d.specimens.flatMap(sp=>sp.sections.map(s=>s.name)))];
      document.getElementById('no-xlsx-status').style.display='block';
      document.getElementById('no-xlsx-status').innerHTML=`
        <div style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px;font-size:12px;margin-top:4px">
          <div style="font-weight:700;color:var(--g);margin-bottom:6px">✓ 엑셀 읽기 완료</div>
          <div style="display:flex;gap:8px;margin-bottom:4px"><span style="color:var(--tx3);width:60px">업체</span><span>${d.makers.map(m=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${m}</span>`).join('')}</span></div>
          <div style="display:flex;gap:8px;margin-bottom:4px"><span style="color:var(--tx3);width:60px">색상</span><span>${allColors.map(c=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${c}</span>`).join('')}</span></div>
          <div style="display:flex;gap:8px"><span style="color:var(--tx3);width:60px">시편구분</span><span>${secs.map(s=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.25);border-radius:3px;padding:1px 6px;font-size:11px;margin-right:3px">${s}</span>`).join('')}</span></div>
        </div>`;

    } catch(err){
      alert('엑셀 읽기 실패: '+err.message);
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

// noRunParse: 엑셀 탭이면 이미 파싱됐으니 바로 step2로
function noLoadSample1(){
  if(CUR_SYS === 'dgu'){
    document.getElementById('no-mail-text').value =
`안녕하세요. 현대차 표면처리재료개발팀 전재철입니다.
하기와같이 DGU 물성평가 의뢰하오니 평가 진행 부탁드립니다.

구분
내용
평가목적
국내공장 DGU 다원화 위한 SIKA 제품 평가
평가 대상 업체
총 1 개사 (SIKA)
시편 송부 현황
GLASS
(총 25EA)
FUYAO  FUYAO - TDF9324  총 5 EA
KCC 글라스  IR900  총 5 EA
KCC 글라스  1L5352  총 5 EA
KCC 글라스  1L6040 (투명유리)  총 5 EA
KCC 글라스  1T3015  총 5 EA
선루프
(총 15EA)
현대첨단소재  GFRP  총 5 EA
BASF  GFRP  총 5 EA
GS칼텍스  CFRP  총 5 EA
도장
(총 50EA)
KCC  TT8800  총 5 EA
KCC  TT6832  총 5 EA
KCC  TT6830  총 5 EA
KNK  KINO5700  총 5 EA
KNK  KINO5000  총 5 EA
NAC  NHS2900  총 5 EA
NAC  NHS1900  총 5 EA
NAC  HNCS1800WN  총 5 EA
NAC  HS7500 MATT  총 5 EA
부자재 송부 현황
DGU  SIKAFLEX 250KH5  총 10 EA
PRIMER  SIKAPRIMER 507  총 1 EA
평가항목
- KNIFECUT 부착성 : 전조건 (상태, 내열, 내수, 내약품, 내열CYCLE)
- 경도 : 전조건 (상태, 내열, 내수)
- 실러물성 : 인장강도, 신율, 인열강도
요구사항
- KNIFECUT : 90% 이상 접착층의 응집 파괴 일 것.
- 경도 : 35~60 (SHORE A 기준)
- 인열강도 : 15이상
시편발송일정
 2026년  3월 31일 (화) 택배 송부
평가요청일정
 ~2026년  5월 6일 (수) 限`;
    return;
  }
  if(CUR_SYS === 'wheel'){
    document.getElementById('no-mail-text').value =
`안녕하세요, 전재철 책임연구원입니다.

평가목적: 신규 차종 휠 3종 도막두께 및 IR 측정 (일치화평가 목적)
담당자: 양지원 연구원

평가 종수: 총 3 종 (JK PE, RG3, JX HEV)

시편 송부 현황 (총 3EA):
- 현대성우캐스팅: JK PE, RG3
- 핸즈: JX HEV

평가항목:
- 전처리: 총 9개소 (3EA X 3종)
- 도막두께 측정 부위: 총 24개소
  ※ 측정 포인트: 수직부(중앙), 수평부, 엣지부, 측면부, 수직 하단부
- IR 측정: 도막두께 측정 부위 외 긁어내어 TR 모드로 측정

요구사항:
- 도막두께:
  1) PRIMER: 수평부 80µm 이상, 그 외 30µm 이상
  2) BASE: 측정치 기입
  3) CLEAR: 수평부 60µm 이상, 그 외 30µm 이상
- IR은 측정한 이후 RAW DATA 송부 요청

시편발송일정: 2026년 4월 10일 (금) 택배 송부
평가요청일정: ~2026년 5월 8일 (금) 限`;
    return;
  }
  document.getElementById('no-mail-text').value =
`안녕하세요, 전재철 책임연구원입니다.

평가목적: HMMC 공장 NX5e차종 신규색상 4종 물성평가
담당자: 양지원 책임연구원

평가 업체: KCC, NAC
평가관련 칼라: ABP, LHG, EBB, KLM

평가 시편 종류(총 130 EA):
- 완성 도막 시편 10 EA
- OVER BAKE / UNDER BAKE 각 5 EA
- 도어 내판 6 EA
- 후드 내판 6 EA

평가항목:
① 외판 완성도막
- 도막두께, 광택, 부착성, 내충격성, 경도, 내수성, 내습성, 내스크래치성, 내치핑성, 내염수분무성, ATR분析
② OVER/UNDER BAKE (부착성, 내충격성, 내수성, 내치핑성)
③ 도어 내판 (도막두께, 부착성, 내충격성, 경도, 내수성, 내습성)
④ 후드 내판 (도막두께, 부착성, 내충격성, 경도, 내수성, 내습성)

도막두께 기준: 전착 16±2µm / 중도 30±2µm / CLEAR 40±2µm`;
}

function noRunParse(){
  const activeTab = document.getElementById('no-tab-image-body')?.style.display!=='none' ? 'image'
    : document.getElementById('no-tab-xlsx-body')?.style.display!=='none' ? 'xlsx' : 'text';
  if(activeTab==='image'){
    noRunParseImage();
    return;
  }
  if(activeTab==='text'){
    if(CUR_SYS==='wheel') { noRunParseWheel(); return; }
    if(CUR_SYS==='dgu')   { noRunParseDgu();   return; }
  }
  const text = document.getElementById('no-mail-text').value.trim();
  if(!text){alert('메일 파일을 첨부하거나 텍스트를 붙여넣어 주세요');return;}

  const d = {makers:[], colorsByMaker:{}, sectionItems:{}, sectionEA:{}, purpose:'', mgr:'', mailDate:'', totalEa:0};

  // ── 평가목적
  // 패턴1: "평가목적\r\n\r\n울산41공장..."  (줄바꿈 후 다음줄)
  // 패턴2: "평가목적\t울산41공장..."         (표 붙여넣기 탭 구분)
  // 패턴3: "평가목적 : 내용"
  // 패턴4: "[평가의뢰] 제목"
  const purM1 = text.match(/평가목적\s*\t\s*([^\t\r\n]{5,80})/);
  const purM2 = text.match(/평가목적\s*\r?\n\s*\r?\n\s*([^\r\n]{5,80})/);
  const purM3 = text.match(/평가목적\s*[：:]\s*([^\r\n]{5,80})/);
  const purM4 = text.match(/\[평가의뢰\]\s*([^\r\n]{5,80})/);
  if(purM1) d.purpose = purM1[1].trim();
  else if(purM2) d.purpose = purM2[1].trim();
  else if(purM3) d.purpose = purM3[1].trim();
  else if(purM4) d.purpose = purM4[1].trim().replace(/^\[평가의뢰\]\s*/,'');

  // ── 발신일
  const dateM = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if(dateM) d.mailDate = `${dateM[1]}-${String(dateM[2]).padStart(2,'0')}-${String(dateM[3]).padStart(2,'0')}`;

  // ── 담당자 (FITI 직원 중 이름 매칭)
  const STAFF = ['김환오','채종운','전재철','양지원','이재진'];
  for(const name of STAFF){ if(text.includes(name)){ d.mgr=name; break; } }

  // ── 업체
  // "평가 업체 : NAC - 1개社" 또는 "평가업체/\r\n평가칼라현황\r\n\r\n-평가 업체 : NAC"
  const makerM = text.match(/평가\s*업체\s*[：:]\s*([A-Za-z가-힣, ]+?)(?:\s*[-–]\s*\d|$|\r|\n)/i);
  if(makerM){
    d.makers = makerM[1].split(/[,，\s]+/)
      .map(s=>s.trim().replace(/[^A-Za-z가-힣]/g,''))
      .filter(s=>s.length>=2&&s.length<=6&&!/총|개|사|社/.test(s));
  }

  // ── 칼라
  // "평가관련 칼라 : YAC, R2T, R8N, CRP – 총 4종"
  const colorM = text.match(/(?:평가관련\s*)?칼라\s*[：:]\s*([A-Za-z0-9, ]+?)(?:\s*[–\-]\s*총|\r|\n|$)/i);
  if(colorM){
    const colors = colorM[1].split(/[,\s]+/)
      .map(s=>s.trim().replace(/[^A-Za-z0-9]/g,''))
      .filter(s=>s.length>=2&&s.length<=5);
    if(d.makers.length) d.makers.forEach(m=>{ d.colorsByMaker[m]=colors; });
    else d.colorsByMaker['미지정']=colors;
  }

  // ── 총 EA
  const totalM = text.match(/총\s*(\d+)\s*EA/i); if(totalM) d.totalEa=parseInt(totalM[1]);

  // ── 시편 EA
  [{re:/완성\s*도막\s*시편\s*(\d+)\s*EA/i,     sec:'완성도막'},
   {re:/OVER\s*BAKE[^,\r\n]*각\s*(\d+)\s*EA/i,sec:'OVER BAKE'},
   {re:/UNDER\s*BAKE[^,\r\n]*각\s*(\d+)\s*EA/i,sec:'UNDER BAKE'},
   {re:/도어\s*내판[^,\r\n]*(\d+)\s*EA/i,      sec:'도어 내판'},
   {re:/후드\s*내판[^,\r\n]*(\d+)\s*EA/i,      sec:'후드 내판'},
  ].forEach(p=>{ const mm=text.match(p.re); if(mm) d.sectionEA[p.sec]=parseInt(mm[1]); });

  // ── 시험항목: ①②③④ 블록 파싱
  // msg 실제 형식 예:
  //   "① 외판 완성도막 – 11개 항목\r\n\r\n    - 도막두께, 광택, ..."
  //   "② OVER/UNDER BAKE 상도 도막 – 각 4개 항목 (내충격성, 부착성, 내수성, 내치핑성)"
  //   "③ 재도장/층간/오버베이킹도막 – 시편당 1개 항목 (부착성)"
  const blockRe = /([①②③④⑤])\s*([^\r\n①②③④⑤]+(?:\r?\n(?![①②③④⑤])[^\r\n]*)*)/g;
  let bm;
  while((bm=blockRe.exec(text))!==null){
    const block = bm[2];
    const headerLine = block.split(/\r?\n/)[0];
    const rawSec = headerLine
      .replace(/[–\-]\s*(?:각\s*)?\d+개\s*항목.*$/,'')
      .replace(/[–\-]\s*시편당.*$/,'')
      .trim();
    const secName = normSecName(rawSec);
    if(!secName) continue;

    let items = [];

    // ── 우선순위 1: 헤더 줄 끝에 붙은 괄호 "(내충격성, 부착성, ...)"
    // 단, 헤더줄에서만 찾아야 함 (★ 줄 등 다른 줄 괄호 오인식 방지)
    const headerBracket = headerLine.match(/[（(]([^)）]{3,})[)）]\s*$/);
    if(headerBracket){
      const cands = headerBracket[1].split(/[,，·]/).map(s=>s.trim()).filter(s=>s.length>1&&s.length<20);
      // 시험항목 특성: 한글 2자 이상, 숫자/코드 없는 것만
      const valid = cands.filter(s=>/^[가-힣]{2,}/.test(s));
      if(valid.length>=1) items = valid;
    }

    // ── 우선순위 2: "- 도막두께, 광택, ..." 대시 줄
    if(!items.length){
      const dashM = block.match(/\n\s{0,8}[-·]\s+([가-힣A-Za-z][가-힣A-Za-z\s,，()]+)/);
      if(dashM){
        const rawItems = dashM[1];
        items = rawItems
          .split(/[,，]/)
          .map(s => {
            // "ATR(1종 - YAC)" → "ATR분석" 로 정규화
            let v = s.trim();
            if(/^ATR/i.test(v)) return 'ATR분석';
            // 괄호 안 내용 제거
            v = v.replace(/\([^)]*\)/g, '').trim();
            return v;
          })
          .filter(s => s.length>1 && s.length<20
            && !s.startsWith('※')
            && !s.startsWith('도막두께 측정')
            && !s.startsWith('전체 시편')
          );
      }
    }

    if(!items.length) continue;

    if(/OVER.*UNDER|OVER\s*\/\s*UNDER/i.test(rawSec)){
      d.sectionItems['OVER BAKE']=[...items];
      d.sectionItems['UNDER BAKE']=[...items];
    } else if(/재도장.*층간|재도장\/층간/i.test(rawSec)){
      // 부착성 → 각 섹션에 맞는 항목명으로 교정
      const toRedo = items.map(n=>n==='부착성'?'재도장성':n);
      const toLayers = items.map(n=>n==='부착성'?'층간부착성':n);
      const toOB = items.map(n=>(n==='부착성'||n==='층간부착성')?'O/B층간부착성':n);
      d.sectionItems['재도장']=toRedo;
      d.sectionItems['층간부착']=toLayers;
      d.sectionItems['O/B 층간부착']=toOB;
    } else {
      d.sectionItems[secName]=[...items];
    }
  }

  // 아무것도 안 잡혔으면 기본값
  if(!Object.keys(d.sectionItems).length) d.sectionItems['완성도막']=[...DEFAULT_ITEMS['완성도막']];
  if(!d.makers.length) d.makers=['미지정'];

  noParsedData = d;

  // ── 필드 자동채우기
  if(d.purpose) document.getElementById('no-purpose').value = d.purpose;
  if(d.mailDate) document.getElementById('no-date').value = d.mailDate;
  else document.getElementById('no-date').value = new Date().toISOString().slice(0,10);
  if(d.mgr){ const sel=document.getElementById('no-mgr'); [...sel.options].forEach(o=>o.selected=o.value===d.mgr); }
  document.getElementById('no-maker').value = d.makers.join(', ');
  const allColors = [...new Set(Object.values(d.colorsByMaker).flat())];
  document.getElementById('no-colors').value = allColors.join(',');
  noRebuildColorRows();
  if(d.totalEa) document.getElementById('no-cnt').value = d.totalEa;

  // ── 파싱 요약 표시
  const secs = Object.keys(d.sectionItems);
  const hasATR = Object.values(d.sectionItems).some(items=>items.includes('ATR분석'));
  const mkTag=v=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
  const clTag=v=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
  const itTag=v=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.25);border-radius:3px;padding:1px 6px;font-size:11px;margin-right:2px;margin-bottom:2px;display:inline-block">${v}</span>`;
  let rows = '';
  const row=(k,v)=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px"><span style="color:var(--tx3);width:65px;flex-shrink:0;font-size:11px;padding-top:2px">${k}</span><span style="flex:1">${v}</span></div>`;
  rows += row('업체', d.makers.length?d.makers.map(mkTag).join(''):mkTag('미감지'));
  rows += row('색상',
    allColors.length
      ? `${allColors.map(clTag).join('')}<span style="font-size:11px;color:var(--tx3);margin-left:4px">${allColors.length}종</span>`
      : `<span style="color:var(--o);font-size:12px">미감지 — 아래 직접 입력</span>`
  );
  if(d.totalEa) rows += row('총 EA', `<span style="font-family:var(--mono);font-size:12px;font-weight:700">${d.totalEa} EA</span>`);
  secs.forEach(sec=> rows += row(sec, d.sectionItems[sec].map(itTag).join('')));

  const warnings = [];
  if(!allColors.length) warnings.push('색상코드 미감지 — 아래 색상코드 필드를 직접 입력해주세요.');
  if(hasATR && allColors.length>1) warnings.push(`ℹ ATR분석: 업체당 첫 번째 색상(${d.makers.map(m=>(d.colorsByMaker[m]||[])[0]).filter(Boolean).join(', ')})만 자동 체크됩니다. 시험항목 탭에서 변경 가능합니다.`);
  const warnHtml = warnings.map(w=>`<div style="margin-top:5px;padding:6px 10px;background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:4px;font-size:11px;color:var(--o)">${w}</div>`).join('');

  document.getElementById('no-parse-summary').innerHTML=`
    <div style="font-size:11px;font-weight:700;color:var(--g);margin-bottom:8px">✓ 파싱 완료 — 아래 내용 확인 후 등록하세요</div>
    <div style="font-size:12px">${rows}</div>${warnHtml}`;
  document.getElementById('no-step1').style.display='none';
  document.getElementById('no-step2').style.display='block';
}

// ── 휠도장 전용 파싱
// ── DGU 텍스트 파싱 (MS715-25 의뢰서)

// ══════════════════════════════════════════════════════
// 차수 등록 디스패처
// ══════════════════════════════════════════════════════
function registerOrder(){
  if(CUR_SYS === 'dgu')   { registerOrderDgu();   return; }
  if(CUR_SYS === 'wheel') { registerOrderWheel(); return; }
  registerOrderBody();
}

// ── 공통 마무리 (body/wheel/dgu 모두 호출)
function _finalizeOrder(yr, db, makerStr, allColors, specimens){
  const order = {
    id: (CUR_SYS==='wheel'?'w_':CUR_SYS==='dgu'?'d_':'o_') + Date.now(),
    cha:     document.getElementById('no-cha').value.trim(),
    purpose: document.getElementById('no-purpose').value || '',
    mgr:     document.getElementById('no-mgr').value,
    date:    document.getElementById('no-date').value || new Date().toISOString().slice(0,10),
    maker: makerStr, colors: allColors,
    cnt: parseInt(document.getElementById('no-cnt').value) || 0,
    status: 'wait', specimens,
  };
  db.orders[yr].push(order);
  closeModal('new-order-modal');
  autoSave();
  if(yr !== CY){ document.getElementById('year-sel').value = yr; changeYear(yr); }
  else { selectedOrderId = order.id; renderOrderList(); renderOrderDetail(order.id); updateYearCost(); }
}

// ── 차체도장 차수 등록
function registerOrderBody(){
  const cha = document.getElementById('no-cha').value.trim();
  if(!cha){ alert('차수를 입력하세요'); document.getElementById('no-cha').focus(); return; }
  const yr = document.getElementById('no-year').value;
  const db = DB;
  if(!db.orders[yr]) db.orders[yr] = [];
  noSyncColorHidden();
  const d = noParsedData || {makers:[],colorsByMaker:{},sectionItems:{},sectionEA:{}};
  const makerStr = document.getElementById('no-maker').value.trim();
  const colorStr = document.getElementById('no-colors').value.trim();
  let makers = makerStr
    ? makerStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean)
    : (d.makers.length ? d.makers : ['미지정']);
  const colorsByMaker = {};
  makers.forEach(mk=>{
    const row = document.querySelector(`[data-maker-row="${mk}"] input`);
    if(row && row.value.trim()) colorsByMaker[mk] = row.value.split(/[,，]+/).map(s=>s.trim()).filter(Boolean);
    else if(d.colorsByMaker?.[mk]?.length) colorsByMaker[mk] = d.colorsByMaker[mk];
    else { const fb = colorStr ? colorStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean) : []; colorsByMaker[mk] = fb.length ? fb : ['미지정']; }
  });
  const allColors = [...new Set(Object.values(colorsByMaker).flat())];
  const secs2 = Object.keys(d.sectionItems).length ? Object.keys(d.sectionItems) : ['완성도막'];
  const singleSecs = ['재도장','층간부착','O/B층간부착','O/B 층간부착'];
  let specimens = [];
  if(d._fromXlsx && d.specimens?.length){ specimens = d.specimens; }
  else {
    const makerFirstColor = {};
    makers.forEach(maker=>{
      (colorsByMaker[maker]||[]).forEach(color=>{
        const isFirst = !makerFirstColor[maker];
        if(isFirst) makerFirstColor[maker] = color;
        const sp = {maker, color, sections:[], receiptDate:'', receiptCnt:'', receiptOk:false};
        secs2.forEach(sec=>{
          const rawItems = d.sectionItems[sec] || (DEFAULT_ITEMS[sec] || DEFAULT_ITEMS['완성도막']);
          sp.sections.push({
            name:sec, receiptEa: singleSecs.includes(sec)?1:(d.sectionEA[sec]||null),
            receiptOk:false, receiptDate:'', receiptNote:'',
            items: rawItems.map(n=>{ const iName=normItemName(n,sec); return {name:iName, price:PRICE_MAP[iName]||0, checked:(n==='ATR분析'?isFirst:true)}; })
          });
        });
        specimens.push(sp);
      });
    });
  }
  if(!specimens.length) specimens = [{maker:'미지정',color:'미지정',sections:secs2.map(sec=>({name:sec,receiptEa:null,receiptOk:false,receiptDate:'',receiptNote:'',items:(d.sectionItems[sec]||(DEFAULT_ITEMS[sec]||DEFAULT_ITEMS['완성도막'])).map(n=>({name:normItemName(n,sec),price:PRICE_MAP[normItemName(n,sec)]||0,checked:true}))}))}];
  _finalizeOrder(yr, db, makerStr, allColors, specimens);
}

// ══════════════════════════════════════════════════════
// CSV 내보내기
// ══════════════════════════════════════════════════════
function exportCostCsv(orderId){
  const order=(activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  let csv='\uFEFF연도,차수,도료사,색상,시편구분,시험항목,단가,금액\n';
  order.specimens.forEach(sp=>{
    sp.sections.forEach(sec=>{
      sec.items.filter(it=>it.checked).forEach(it=>{
        csv+=`${CY},${order.cha},${sp.maker},${sp.color},${sec.name},${it.name},${it.price},${it.price}\n`;
      });
    });
  });
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`FITI_${CY}_${order.cha}_비용내역.csv`;
  a.click();
}

// ══════════════════════════════════════════════════════
// 시편종류 추가 모달
// ══════════════════════════════════════════════════════
let addSecTarget = {orderId:null, spIdx:null};

function openAddSecModal(orderId, spIdx){
  addSecTarget = {orderId, spIdx};
  document.getElementById('new-sec-name').value = '';
  document.getElementById('new-sec-items').innerHTML = '';
  // DGU전용 버튼 목록 교체
  const presetWrap = document.getElementById('add-sec-presets');
  if(presetWrap){
    if(CUR_SYS==='dgu'){
      presetWrap.innerHTML = `
        <button class="btn sm" onclick="setNewSecName('KNIFE CUT')">KNIFE CUT</button>
        <button class="btn sm" onclick="setNewSecName('전단강도')">전단강도</button>
        <button class="btn sm" onclick="setNewSecName('경도')">경도</button>
        <button class="btn sm" onclick="setNewSecName('실러물성')">실러물성</button>
        <button class="btn sm" onclick="setNewSecName('공통비용')">공통비용</button>`;
    } else {
      presetWrap.innerHTML = `
        <button class="btn sm" onclick="setNewSecName('완성도막')">완성도막</button>
        <button class="btn sm" onclick="setNewSecName('OVER BAKE')">OVER BAKE</button>
        <button class="btn sm" onclick="setNewSecName('UNDER BAKE')">UNDER BAKE</button>
        <button class="btn sm" onclick="setNewSecName('재도장')">재도장</button>
        <button class="btn sm" onclick="setNewSecName('층간부착')">층간부착</button>
        <button class="btn sm" onclick="setNewSecName('O/B 층간부착')">O/B 층간부착</button>
        <button class="btn sm" onclick="setNewSecName('내판 도막')">내판 도막</button>
        <button class="btn sm" onclick="setNewSecName('도어 내판')">도어 내판</button>
        <button class="btn sm" onclick="setNewSecName('후드 내판')">후드 내판</button>
        <button class="btn sm" onclick="setNewSecName('투톤도막')">투톤도막</button>
        <button class="btn sm" onclick="setNewSecName('전착도막')">전착도막</button>
        <button class="btn sm" onclick="setNewSecName('중도 단독')">중도 단독</button>
        <button class="btn sm" onclick="setNewSecName('중도 삭제')">중도 삭제</button>
        <button class="btn sm" onclick="setNewSecName('치핑프라이머')">치핑프라이머</button>`;
    }
  }
  openModal('add-sec-modal');
}

function setNewSecName(v){
  document.getElementById('new-sec-name').value = v;
  updateNewSecItems(v);
}

function updateNewSecItems(secName){
  const defMap = CUR_SYS==='dgu' ? DEFAULT_ITEMS_DGU : DEFAULT_ITEMS;
  const fallback = CUR_SYS==='dgu' ? DEFAULT_ITEMS_DGU['KNIFE CUT'] : DEFAULT_ITEMS['완성도막'];
  const items = defMap[secName] || fallback || [];
  document.getElementById('new-sec-items').innerHTML = items.map(item=>`
    <label style="display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;background:var(--bg4);border:1px solid var(--border);border-radius:4px;padding:3px 8px">
      <input type="checkbox" checked value="${item}" style="width:13px;height:13px;accent-color:var(--g)"> ${item}
    </label>
  `).join('');
}

function confirmAddSec(){
  const {orderId, spIdx} = addSecTarget;
  const order = (activeDB().orders[CY]||[]).find(o=>o.id===orderId); if(!order) return;
  const name = document.getElementById('new-sec-name').value.trim();
  if(!name){alert('시편종류명을 입력하세요');return;}
  const checked = [...document.querySelectorAll('#new-sec-items input:checked')].map(c=>c.value);
  if(!checked.length){alert('항목을 하나 이상 선택하세요');return;}
  order.specimens[spIdx].sections.push({
    name,
    items: checked.map(n=>({name:n, price:CUR_SYS==='dgu'?(PRICE_MAP_DGU[n]||0):(PRICE_MAP[n]||getPrice(n)), checked:true}))
  });
  closeModal('add-sec-modal');
  reRenderDetail(orderId);
}

// ══════════════════════════════════════════════════════
// 메일 파싱
// ══════════════════════════════════════════════════════
let mailParseTarget = null;
let mailParsedResult = null;

function openMailParseModal(orderId){
  mailParseTarget = orderId;
  mailParsedResult = null;
  document.getElementById('mail-parse-text').value = '';
  document.getElementById('mail-parse-preview').style.display = 'none';
  document.getElementById('mail-parse-apply-btn').style.display = 'none';
  openModal('mail-parse-modal');
}

function loadSampleMail1(){
  document.getElementById('mail-parse-text').value =
`안녕하세요, 채종운 연구원입니다.
아래와 같이 물성평가 의뢰 드립니다.

평가목적: 울산41공장 도료업체 이원화 개발관련 평가의뢰

평가 업체: NAC
평가관련 칼라: YAC, R2T, R8N, CRP

평가 시편 종류(총 92 EA):
- 완성 도막 시편 10 EA
- OVER BAKE / UNDER BAKE 각 5 EA
- 재도장/층간부착/O/B층간부착 시편 각 1 EA

평가항목:
① 외판 완성도막
- 도막두께, 광택, 내충격성, 부착성, 내습성, 내수성, 내치핑성, 경도, 내스크래치성, 내염수분무성, ATR분석
② OVER/UNDER BAKE (내충격성, 부착성, 내수성, 내치핑성)
③ 재도장/층간부착/O/B층간부착 (부착성)

도막두께 기준:
전착: 16±2µm / 중도: 35±2µm / CLEAR: 40±2µm`;
}

function loadSampleMail2(){
  document.getElementById('mail-parse-text').value =
`안녕하세요, 전재철 연구원입니다.

평가목적: HMMC 공장 NX5e차종 신규색상 4종 물성평가

평가 업체: KCC, NAC
평가관련 칼라: ABP, LHG, EBB, KLM

평가 시편 종류(총 130 EA):
- 완성 도막 시편 10 EA
- OVER BAKE / UNDER BAKE 각 5 EA
- 도어 내판 6 EA
- 후드 내판 6 EA

평가항목:
① 외판 완성도막
- 도막두께, 광택, 부착성, 내충격성, 경도, 내수성, 내습성, 내스크래치성, 내치핑성, 내염수분무성, ATR분석
② OVER/UNDER BAKE (부착성, 내충격성, 내수성, 내치핑성)
③ 도어 내판 (도막두께, 부착성, 내충격성, 경도, 내수성, 내습성)
④ 후드 내판 (도막두께, 부착성, 내충격성, 경도, 내수성, 내습성)

도막두께 기준:
전착: 16±2µm / 중도: 30±2µm / CLEAR: 40±2µm`;
}

function runMailParse(){
  const text = document.getElementById('mail-parse-text').value.trim();
  if(!text){alert('메일 내용을 입력하세요');return;}

  const d = {makers:[], colorsByMaker:{}, sectionItems:{}, sectionEA:{}};

  // 업체 파싱
  const makerM = text.match(/(?:평가\s*업체|업체)\s*[:：]\s*([^\n]+)/i);
  if(makerM){
    d.makers = makerM[1].split(/[,，\s]+/).map(s=>s.trim()).filter(s=>s.length>=2&&s.length<=6&&!/총|개|사/.test(s));
  }

  // 칼라 파싱
  const colorM = text.match(/(?:평가관련\s*)?칼라\s*[:：]\s*([^\n]+)/i);
  if(colorM){
    const colors = colorM[1].split(/[,，\s\-–]+/).map(s=>s.trim().replace(/[^A-Za-z0-9가-힣]/g,'')).filter(s=>s.length>=2&&s.length<=8&&!/총|개|종/.test(s));
    d.makers.forEach(m=>{ d.colorsByMaker[m]=colors; });
    if(!d.makers.length) d.colorsByMaker['미지정']=colors;
  }

  // 시험항목 블록 파싱 (①②③④ 패턴)
  const secRe = /[①②③④⑤]\s*([^\n(（]+)[\n(（]\s*([^\n)）]+)/g;
  let m;
  while((m=secRe.exec(text))!==null){
    const rawSec = m[1].trim();
    const rawItems = m[2].trim();
    const secName = normSecName(rawSec);
    const items = rawItems.split(/[,，·]/).map(s=>s.trim().replace(/^[-·•]/,'')).filter(s=>s.length>1&&s.length<20);
    if(items.length && secName){
      // OVER/UNDER BAKE 같이 묶인 경우
      if(/OVER.*UNDER|OVER\s*\/\s*UNDER/i.test(rawSec)){
        d.sectionItems['OVER BAKE']=[...items];
        d.sectionItems['UNDER BAKE']=[...items];
      } else {
        d.sectionItems[secName]=[...items];
      }
    }
  }

  // EA 파싱
  [
    {re:/완성\s*도막[^,\n]*(\d+)\s*EA/i, sec:'완성도막'},
    {re:/OVER\s*BAKE[^,\n]*각\s*(\d+)\s*EA/i, sec:'OVER BAKE'},
    {re:/UNDER\s*BAKE[^,\n]*각\s*(\d+)\s*EA/i, sec:'UNDER BAKE'},
    {re:/도어\s*내판[^,\n]*(\d+)\s*EA/i, sec:'도어 내판'},
    {re:/후드\s*내판[^,\n]*(\d+)\s*EA/i, sec:'후드 내판'},
  ].forEach(p=>{
    const mm=text.match(p.re); if(mm) d.sectionEA[p.sec]=parseInt(mm[1]);
  });

  // 결과가 없으면 기본값
  if(!Object.keys(d.sectionItems).length){
    d.sectionItems['완성도막'] = [...DEFAULT_ITEMS['완성도막']];
  }
  if(!d.makers.length) d.makers = ['미지정'];

  mailParsedResult = d;

  // 미리보기
  const makers = d.makers;
  const allColors = [...new Set(Object.values(d.colorsByMaker).flat())];
  const secs = Object.keys(d.sectionItems);

  let html = `
    <div style="display:grid;gap:6px;font-size:12px">
      <div style="display:flex;gap:8px"><span style="color:var(--tx3);width:70px;flex-shrink:0">업체</span>
        <span>${makers.map(m=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:4px">${m}</span>`).join('')}</span>
      </div>
      <div style="display:flex;gap:8px"><span style="color:var(--tx3);width:70px;flex-shrink:0">색상코드</span>
        <span>${allColors.length ? allColors.map(c=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:4px">${c}</span>`).join('') : '<span style="color:var(--o)">미감지 — 적용 후 직접 추가</span>'}</span>
      </div>
  `;
  secs.forEach(sec=>{
    const items = d.sectionItems[sec];
    html += `<div style="display:flex;gap:8px;align-items:flex-start">
      <span style="color:var(--tx3);width:70px;flex-shrink:0;padding-top:1px">${sec}</span>
      <span>${items.map(i=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.2);border-radius:4px;padding:1px 7px;font-size:11px;margin-right:3px;margin-bottom:3px;display:inline-block">${i}</span>`).join('')}</span>
    </div>`;
  });
  html += '</div>';

  document.getElementById('mail-parse-preview-content').innerHTML = html;
  document.getElementById('mail-parse-preview').style.display = 'block';
  document.getElementById('mail-parse-apply-btn').style.display = 'inline-flex';
}

function normSecName(raw){
  const r = raw.replace(/도막|시편|삼도|외판|\s+/g,' ').trim().replace(/\s+/g,' ');
  if(/완성/.test(r)) return '완성도막';
  if(/OVER.*UNDER|OVER\s*\/\s*UNDER/i.test(r)) return 'OVER+UNDER';
  if(/OVER/i.test(r)) return 'OVER BAKE';
  if(/UNDER/i.test(r)) return 'UNDER BAKE';
  if(/재도장/.test(r)) return '재도장';
  if(/O\/B.*층간|오버베이킹.*층간/.test(r)) return 'O/B 층간부착';
  if(/층간부착/.test(r)) return '층간부착';
  if(/도어.*내판/.test(r)) return '도어 내판';
  if(/후드.*내판|테일게이트/.test(r)) return '후드 내판';
  if(/내판/.test(r)) return '내판 도막';
  if(/투톤/.test(r)) return '투톤도막';
  if(/전착/.test(r)) return '전착도막';
  return r;
}

function applyMailParse(){
  const d = mailParsedResult; if(!d) return;
  const order = (activeDB().orders[CY]||[]).find(o=>o.id===mailParseTarget); if(!order) return;

  if(order.specimens.length > 0){
    if(!confirm('기존 시험항목을 모두 파싱 결과로 교체합니다. 계속하시겠습니까?')) return;
  }

  const makers = d.makers.length ? d.makers : ['미지정'];
  let colorMap = Object.keys(d.colorsByMaker).length ? d.colorsByMaker : {};
  if(!Object.keys(colorMap).length) makers.forEach(m=>colorMap[m]=['미지정']);

  const singleSecs = ['재도장','층간부착','O/B층간부착','O/B 층간부착'];
  let secs = Object.keys(d.sectionItems);
  if(!secs.length) secs = ['완성도막'];

  order.specimens = [];
  makers.forEach(maker=>{
    const colors = colorMap[maker] || colorMap[Object.keys(colorMap)[0]] || ['미지정'];
    colors.forEach(color=>{
      const sp = {maker, color, sections:[], receiptDate:'', receiptCnt:'', receiptOk:false};
      secs.forEach(sec=>{
        const rawItems = d.sectionItems[sec] || (DEFAULT_ITEMS[sec]||DEFAULT_ITEMS['완성도막']);
        const ea = singleSecs.includes(sec) ? 1 : (d.sectionEA[sec]||null);
        sp.sections.push({
          name: sec,
          ea,
          items: rawItems.map(n=>({name:n, price:PRICE_MAP[n]||getPrice(n), checked:true}))
        });
      });
      order.specimens.push(sp);
    });
  });

  // 기본정보 자동채우기
  const purposeM = d.purpose || '';
  if(purposeM) order.purpose = purposeM;

  closeModal('mail-parse-modal');
  reRenderDetail(mailParseTarget);
  renderOrderList();
  updateYearCost();
}

// ══════════════════════════════════════════════════════
// 저장 / 복원 (localStorage → Firebase 연동 시 교체)
// ══════════════════════════════════════════════════════
