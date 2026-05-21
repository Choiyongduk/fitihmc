// ============================================================
// admin.js — 회원관리 (FITI 관리자 전용)
// ============================================================

let ADMIN_PROFILES = [];
let ADMIN_REALTIME = null;

// ─────────────────────────────────────────────────────────
// 메뉴에서 회원관리 클릭 시 호출
// ─────────────────────────────────────────────────────────
async function adminInit() {
  if (!window.isFitiAdmin?.()) {
    document.getElementById('admin-body').innerHTML =
      '<div style="text-align:center;padding:60px 20px;color:var(--r)">관리자만 접근 가능합니다</div>';
    return;
  }
  await adminRefresh();
  adminSubscribe();
}

// ─────────────────────────────────────────────────────────
// 프로필 목록 새로고침
// ─────────────────────────────────────────────────────────
async function adminRefresh() {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .order('status', { ascending: true })  // pending 먼저
    .order('created_at', { ascending: false });

  if (error) {
    document.getElementById('admin-body').innerHTML =
      `<div style="color:var(--r);padding:20px">로드 실패: ${error.message}</div>`;
    return;
  }
  ADMIN_PROFILES = data;
  adminRender();
  adminUpdateBadge();
}

// ─────────────────────────────────────────────────────────
// 렌더링
// ─────────────────────────────────────────────────────────
function adminRender() {
  const body = document.getElementById('admin-body');
  const meId = window.CURRENT_PROFILE?.id;

  const pending   = ADMIN_PROFILES.filter(p => p.status === 'pending');
  const active    = ADMIN_PROFILES.filter(p => p.status === 'approved');
  const suspended = ADMIN_PROFILES.filter(p => p.status === 'suspended');

  body.innerHTML = `
    ${renderSection('승인 대기', pending, 'pending', meId)}
    ${renderSection('활성 회원', active, 'active', meId)}
    ${suspended.length ? renderSection('정지된 회원', suspended, 'suspended', meId) : ''}
    ${ADMIN_PROFILES.length === 0 ? '<div style="text-align:center;color:var(--tx3);padding:40px">아직 가입자가 없습니다</div>' : ''}
  `;
}

function renderSection(title, profiles, type, meId) {
  if (!profiles.length) return '';

  const cardBg = type === 'pending'
    ? 'background:linear-gradient(180deg,rgba(154,103,0,.04),transparent);'
    : '';
  const cardBorder = type === 'pending'
    ? 'border-color:rgba(154,103,0,.3);'
    : '';

  return `
    <div class="card" style="${cardBg}${cardBorder}">
      <div class="card-title">
        ${title}
        <span style="background:var(--bg4);color:var(--tx2);padding:1px 8px;border-radius:10px;font-family:var(--mono);font-size:11px">${profiles.length}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${profiles.map(p => renderProfileRow(p, type, meId)).join('')}
      </div>
    </div>
  `;
}

function renderProfileRow(p, type, meId) {
  const isMe = p.id === meId;
  const roleLabel = {
    fiti_admin:  'FITI 관리자',
    fiti_tester: 'FITI 시험자',
    hmc_user:    '현대차 담당자'
  }[p.role] || p.role;
  const roleColor = {
    fiti_admin:  'var(--r)',
    fiti_tester: 'var(--g)',
    hmc_user:    'var(--b)'
  }[p.role] || 'var(--tx3)';

  const date = new Date(p.created_at).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  // 액션 영역
  let actions = '';
  if (isMe) {
    actions = '<span style="font-size:11px;color:var(--tx3);font-style:italic;padding:0 8px">본인</span>';
  } else if (type === 'pending') {
    actions = `
      <button class="btn sm primary" onclick="adminApprove('${p.id}')">승인</button>
      <button class="btn sm danger"  onclick="adminReject('${p.id}')">거절</button>
    `;
  } else if (type === 'active') {
    actions = `
      <select onchange="adminChangeRole('${p.id}', this.value, this)"
              style="font-size:12px;padding:3px 8px;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;cursor:pointer">
        <option value="hmc_user"    ${p.role === 'hmc_user'    ? 'selected' : ''}>현대차</option>
        <option value="fiti_tester" ${p.role === 'fiti_tester' ? 'selected' : ''}>FITI 시험자</option>
        <option value="fiti_admin"  ${p.role === 'fiti_admin'  ? 'selected' : ''}>FITI 관리자</option>
      </select>
      <button class="btn sm danger" onclick="adminSuspend('${p.id}')">정지</button>
    `;
  } else if (type === 'suspended') {
    actions = `
      <button class="btn sm primary" onclick="adminUnsuspend('${p.id}')">해제</button>
    `;
  }

  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:8px">
      <div class="ava" style="width:36px;height:36px;background:${roleColor}1a;color:${roleColor};font-size:14px;flex-shrink:0">
        ${(p.name || p.username || '?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--tx)">
          ${p.name || '(이름 없음)'}
          <span style="color:var(--tx3);font-weight:400;font-size:12px;margin-left:4px">@${p.username || '—'}</span>
        </div>
        <div style="font-size:11px;color:var(--tx3);margin-top:2px;font-family:var(--mono)">
          <span style="color:${roleColor};font-weight:600">${roleLabel}</span> · ${p.email} · ${date}
        </div>
      </div>
      <div style="display:flex;gap:4px;align-items:center;flex-shrink:0">
        ${actions}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────
// CRUD 액션
// ─────────────────────────────────────────────────────────
async function adminApprove(id) {
  const p = ADMIN_PROFILES.find(x => x.id === id);
  if (!confirm(`${p?.name || '이 회원'}님을 승인하시겠습니까?`)) return;
  const { error } = await sb.from('profiles').update({ status: 'approved' }).eq('id', id);
  if (error) return alert('승인 실패: ' + error.message);
  showToast?.(`${p?.name} 승인 완료`, 'g', 2500);
  await adminRefresh();
}

async function adminReject(id) {
  const p = ADMIN_PROFILES.find(x => x.id === id);
  if (!confirm(`${p?.name || '이 회원'}의 가입을 거절하시겠습니까?\n계정은 정지 상태가 됩니다.`)) return;
  const { error } = await sb.from('profiles').update({ status: 'suspended' }).eq('id', id);
  if (error) return alert('거절 실패: ' + error.message);
  await adminRefresh();
}

async function adminChangeRole(id, role, selectEl) {
  const p = ADMIN_PROFILES.find(x => x.id === id);
  const roleName = { fiti_admin:'FITI 관리자', fiti_tester:'FITI 시험자', hmc_user:'현대차 담당자' }[role];
  if (!confirm(`${p?.name}의 역할을 [${roleName}](으)로 변경하시겠습니까?`)) {
    // 셀렉트 원복
    if (selectEl) selectEl.value = p.role;
    return;
  }
  const { error } = await sb.from('profiles').update({ role: role }).eq('id', id);
  if (error) return alert('변경 실패: ' + error.message);
  showToast?.(`역할 변경: ${p?.name} → ${roleName}`, 'b', 2500);
  await adminRefresh();
}

async function adminSuspend(id) {
  const p = ADMIN_PROFILES.find(x => x.id === id);
  if (!confirm(`${p?.name}을(를) 정지시키겠습니까?`)) return;
  const { error } = await sb.from('profiles').update({ status: 'suspended' }).eq('id', id);
  if (error) return alert('정지 실패: ' + error.message);
  await adminRefresh();
}

async function adminUnsuspend(id) {
  const { error } = await sb.from('profiles').update({ status: 'approved' }).eq('id', id);
  if (error) return alert('해제 실패: ' + error.message);
  await adminRefresh();
}

// ─────────────────────────────────────────────────────────
// 실시간 구독 — 새 가입/변경 시 자동 갱신
// ─────────────────────────────────────────────────────────
function adminSubscribe() {
  if (ADMIN_REALTIME) return;
  ADMIN_REALTIME = sb.channel('admin-profiles')
    .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => { adminRefresh(); })
    .subscribe();
}

// ─────────────────────────────────────────────────────────
// 사이드바 배지 (승인 대기 카운트)
// ─────────────────────────────────────────────────────────
function adminUpdateBadge() {
  const badge = document.getElementById('admin-pending-badge');
  if (!badge) return;
  const pending = ADMIN_PROFILES.filter(p => p.status === 'pending').length;
  if (pending > 0) {
    badge.textContent = pending;
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────
// 로그인 직후: 관리자면 메뉴 노출 + 배지 카운트 + 실시간 구독
// ─────────────────────────────────────────────────────────
async function adminBootstrap() {
  if (!window.isFitiAdmin?.()) return;

  const adminNav = document.getElementById('nav-sec-admin');
  if (adminNav) adminNav.style.display = '';

  // pending 카운트 미리 가져와서 배지 표시
  const { count } = await sb
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');

  const badge = document.getElementById('admin-pending-badge');
  if (badge && count > 0) {
    badge.textContent = count;
    badge.style.display = '';
  }

  adminSubscribe();
}

// auth가 끝나길 기다렸다가 부트스트랩
window.addEventListener('DOMContentLoaded', () => {
  const wait = setInterval(() => {
    if (window.CURRENT_PROFILE) {
      clearInterval(wait);
      adminBootstrap();
    }
  }, 200);
  // 10초 후엔 포기
  setTimeout(() => clearInterval(wait), 10000);
});
