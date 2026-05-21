// ============================================================
// inspection.js — 검수 관리 페이지
// ============================================================
// - 사이드바 "검수" 메뉴 → 이 페이지로 진입
// - 차수별 검수 진행률 한눈에 표시 (대기 / 진행중 / 완료)
// - 차수 클릭 → 의뢰 관리 페이지에서 해당 차수 상세로 이동
//   (실제 검수 체크는 기존 의뢰 상세의 시편종류 헤더에서 수행)
// - 사이드바 뱃지: 검수 대기 차수 수 자동 표시
// ============================================================

let INSPECTION_FILTER = 'pending'; // 'all' | 'pending' | 'done'

// ─────────────────────────────────────────────────────
// 메뉴 클릭 시 진입
// ─────────────────────────────────────────────────────
function inspectionInit() {
  inspectionRender();
}

function inspectionSetFilter(f) {
  INSPECTION_FILTER = f;
  inspectionRender();
}

// ─────────────────────────────────────────────────────
// 페이지 렌더링
// ─────────────────────────────────────────────────────
function inspectionRender() {
  const body = document.getElementById('inspection-body');
  if (!body) return;

  const db = (typeof activeDB === 'function') ? activeDB() : null;
  if (!db) {
    body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--tx3)">데이터를 불러올 수 없습니다</div>';
    return;
  }

  const orders = db.orders[CY] || [];

  const stats = orders.map(o => {
    const allSecs = (o.specimens || []).flatMap(sp => sp.sections || []);
    const total = allSecs.length;
    const done = allSecs.filter(s => s.receiptOk).length;
    let status;
    if (total === 0) status = 'empty';
    else if (done === total) status = 'done';
    else if (done === 0) status = 'pending';
    else status = 'partial';
    return { order: o, total, done, status };
  });

  // 정렬: 진행중 → 대기 → 완료 → 빈 차수, 같은 상태 내에서는 날짜 역순
  const statusOrder = { partial: 0, pending: 1, done: 2, empty: 3 };
  stats.sort((a, b) => {
    const sd = statusOrder[a.status] - statusOrder[b.status];
    if (sd !== 0) return sd;
    return (b.order.date || '').localeCompare(a.order.date || '');
  });

  // 필터
  let filtered = stats;
  if (INSPECTION_FILTER === 'pending') {
    filtered = stats.filter(s => s.status === 'pending' || s.status === 'partial');
  } else if (INSPECTION_FILTER === 'done') {
    filtered = stats.filter(s => s.status === 'done');
  } else {
    filtered = stats.filter(s => s.status !== 'empty');
  }

  // 카운트
  const counts = {
    all: stats.filter(s => s.status !== 'empty').length,
    pending: stats.filter(s => s.status === 'pending' || s.status === 'partial').length,
    done: stats.filter(s => s.status === 'done').length,
  };

  // 사이드바 뱃지 갱신
  updateInspectionBadge(counts.pending);

  // 렌더
  body.innerHTML = `
    <div style="display:flex;gap:6px;margin-bottom:16px">
      ${renderFilterBtn('pending', '검수 대기', counts.pending)}
      ${renderFilterBtn('done', '검수 완료', counts.done)}
      ${renderFilterBtn('all', '전체', counts.all)}
    </div>
    ${filtered.length === 0
      ? `<div style="text-align:center;padding:60px;color:var(--tx3);font-size:13px">
           ${INSPECTION_FILTER === 'pending' ? '검수 대기 중인 차수가 없습니다 ✓' : '해당 항목이 없습니다'}
         </div>`
      : `<div style="display:flex;flex-direction:column;gap:8px">
          ${filtered.map(renderInspectionRow).join('')}
        </div>`
    }
  `;
}

function renderFilterBtn(filter, label, count) {
  const active = INSPECTION_FILTER === filter;
  return `<button onclick="inspectionSetFilter('${filter}')" 
    class="btn ${active ? 'primary' : ''}"
    style="font-size:12px;padding:6px 12px">
    ${label} 
    <span style="margin-left:4px;font-family:var(--mono);font-weight:700">${count}</span>
  </button>`;
}

function renderInspectionRow(s) {
  const o = s.order;
  const total = s.total;
  const done = s.done;
  const percent = total > 0 ? Math.round(done / total * 100) : 0;

  const statusInfo = {
    'done':    { color: 'var(--g)', label: '✓ 검수완료',  bg: 'rgba(45,164,78,.08)' },
    'partial': { color: 'var(--o)', label: '검수 진행 중', bg: 'rgba(154,103,0,.06)' },
    'pending': { color: 'var(--r)', label: '검수 대기',    bg: 'rgba(217,72,57,.05)' },
    'empty':   { color: 'var(--tx3)', label: '시편 없음',   bg: 'var(--bg2)' },
  }[s.status];

  // 시편 요약: 업체 수, 시편 수
  const makers = [...new Set((o.specimens || []).map(sp => sp.maker))];
  const specCount = (o.specimens || []).length;

  return `
    <div onclick="inspectionOpenOrder('${o.id}')" 
         style="background:${statusInfo.bg};border:1px solid var(--border);border-radius:8px;padding:14px 16px;cursor:pointer;transition:all .15s"
         onmouseover="this.style.transform='translateY(-1px)';this.style.borderColor='var(--border2)'" 
         onmouseout="this.style.transform='';this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-weight:700;font-size:15px;color:var(--tx)">${CY}년 ${escapeHtml(o.cha || '?')}</span>
        <span style="font-size:11px;color:${statusInfo.color};font-weight:700;padding:2px 8px;background:${statusInfo.bg};border:1px solid ${statusInfo.color}40;border-radius:10px">
          ${statusInfo.label}
        </span>
        <span style="margin-left:auto;font-family:var(--mono);font-size:13px;color:var(--tx2);font-weight:600">
          ${done} / ${total} 시편종류
        </span>
      </div>
      <div style="font-size:11px;color:var(--tx3);margin-bottom:8px;line-height:1.5">
        ${escapeHtml(o.purpose || '(평가목적 없음)')}
        <br>
        의뢰일 <span style="font-family:var(--mono)">${o.date || '-'}</span>
        · 담당자 ${escapeHtml(o.mgr || '-')}
        · 업체 <span style="color:var(--tx2);font-weight:600">${makers.length}개사</span>
        · 시편 <span style="font-family:var(--mono);color:var(--tx2);font-weight:600">${specCount}건</span>
      </div>
      <div style="background:var(--bg3);height:5px;border-radius:3px;overflow:hidden">
        <div style="width:${percent}%;height:100%;background:${statusInfo.color};transition:width .3s"></div>
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────
// 차수 클릭 → 의뢰 관리 페이지로 이동 + 차수 선택
// ─────────────────────────────────────────────────────
function inspectionOpenOrder(orderId) {
  // 의뢰 관리 페이지 표시
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-orders').classList.add('active');
  const ordersNav = document.querySelector("button.nav-item[onclick*=\"nav('orders'\"]");
  if (ordersNav) ordersNav.classList.add('active');

  // 차수 선택
  if (typeof selectedOrderId !== 'undefined') window.selectedOrderId = orderId;
  if (typeof renderOrderList === 'function') renderOrderList();
  if (typeof renderOrderDetail === 'function') renderOrderDetail(orderId);
  if (typeof updateYearCost === 'function') updateYearCost();
}

// ─────────────────────────────────────────────────────
// 사이드바 뱃지 갱신 (검수 대기 수)
// ─────────────────────────────────────────────────────
function updateInspectionBadge(pendingCount) {
  const badge = document.getElementById('inspection-pending-badge');
  if (!badge) return;

  // 외부에서 호출 시 인자 없으면 직접 계산
  if (pendingCount === undefined) {
    const db = (typeof activeDB === 'function') ? activeDB() : null;
    if (!db) return;
    const orders = db.orders[CY] || [];
    pendingCount = 0;
    orders.forEach(o => {
      const allSecs = (o.specimens || []).flatMap(sp => sp.sections || []);
      if (allSecs.length > 0 && allSecs.some(s => !s.receiptOk)) {
        pendingCount++;
      }
    });
  }

  if (pendingCount > 0) {
    badge.textContent = pendingCount;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────
// 초기화: 페이지 로드 후 뱃지 카운트
// ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // 다른 스크립트가 데이터 로드할 때까지 대기 후 뱃지 갱신
  const wait = setInterval(() => {
    if (typeof activeDB === 'function' && typeof CY !== 'undefined') {
      clearInterval(wait);
      try { updateInspectionBadge(); } catch (e) { }
    }
  }, 300);
  setTimeout(() => clearInterval(wait), 8000);
});

// 다른 곳에서 호출할 수 있도록 export
window.inspectionInit = inspectionInit;
window.inspectionRender = inspectionRender;
window.inspectionSetFilter = inspectionSetFilter;
window.inspectionOpenOrder = inspectionOpenOrder;
window.updateInspectionBadge = updateInspectionBadge;
