// ============================================================
// auth.js — 로그인/회원가입/세션/로그아웃
// ============================================================

let AUTH_MODE = 'login';  // 'login' | 'signup'

// ─────────────────────────────────────────────────────────
// 1. 로그인 오버레이 UI 주입
// ─────────────────────────────────────────────────────────
function authInjectLoginUI() {
  if (document.getElementById('auth-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.innerHTML = `
    <style>
      #auth-overlay {
        position: fixed; inset: 0; background: var(--bg, #f0f2f5);
        z-index: 99999; display: flex; align-items: center; justify-content: center;
        font-family: var(--sans, -apple-system, 'Noto Sans KR', sans-serif);
      }
      .auth-card {
        background: var(--bg2, #fff); border: 1px solid var(--border, #dde1e7);
        border-radius: 16px; padding: 32px; width: 380px; max-width: 90vw;
        box-shadow: 0 8px 32px rgba(0,0,0,.08);
      }
      .auth-logo {
        font-size: 10px; font-family: var(--mono); color: var(--g, #1a7f37);
        background: var(--gbg, rgba(26,127,55,.1));
        border: 1px solid rgba(45,164,78,.3);
        border-radius: 4px; padding: 3px 8px; display: inline-block;
        margin-bottom: 12px;
      }
      .auth-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; color: var(--tx, #1a1d23); }
      .auth-sub { font-size: 13px; color: var(--tx2, #5a6070); margin-bottom: 24px; }
      .auth-tabs { display: flex; gap: 0; margin-bottom: 20px; border-bottom: 1px solid var(--border, #dde1e7); }
      .auth-tab {
        flex: 1; padding: 10px; background: none; border: none;
        font-size: 13px; cursor: pointer; color: var(--tx3, #9aa0ad);
        border-bottom: 2px solid transparent; margin-bottom: -1px;
        font-family: inherit;
      }
      .auth-tab.active { color: var(--g, #1a7f37); border-bottom-color: var(--g, #1a7f37); font-weight: 600; }
      .auth-field { margin-bottom: 12px; }
      .auth-field label { font-size: 12px; color: var(--tx2, #5a6070); display: block; margin-bottom: 4px; }
      .auth-field input, .auth-field select {
        width: 100%; background: var(--bg3, #f7f8fa); border: 1px solid var(--border, #dde1e7);
        border-radius: 6px; padding: 8px 12px; font-size: 13px; color: var(--tx, #1a1d23);
        font-family: inherit; outline: none; box-sizing: border-box;
      }
      .auth-field input:focus, .auth-field select:focus { border-color: var(--b, #0969da); }
      .auth-btn {
        width: 100%; padding: 11px; background: var(--g, #1a7f37); color: white;
        border: none; border-radius: 6px; font-size: 14px; font-weight: 600;
        cursor: pointer; margin-top: 8px; font-family: inherit; transition: .15s;
      }
      .auth-btn:hover { background: var(--g2, #116329); }
      .auth-btn:disabled { opacity: .5; cursor: not-allowed; }
      .auth-msg { font-size: 12px; padding: 8px 12px; border-radius: 6px; margin-top: 12px; line-height: 1.5; }
      .auth-msg.err { background: var(--rbg, rgba(207,44,39,.1)); color: var(--r, #cf2c27); border: 1px solid rgba(207,44,39,.3); }
      .auth-msg.info { background: var(--bbg, rgba(9,105,218,.1)); color: var(--b, #0969da); border: 1px solid rgba(9,105,218,.3); }
      .auth-msg.ok { background: var(--gbg, rgba(26,127,55,.1)); color: var(--g, #1a7f37); border: 1px solid rgba(26,127,55,.3); }
    </style>
    <div class="auth-card">
      <span class="auth-logo">FITI × HMC</span>
      <div class="auth-title">도장평가 시스템</div>
      <div class="auth-sub" id="auth-sub">로그인이 필요합니다</div>

      <div class="auth-tabs">
        <button class="auth-tab active" data-mode="login" onclick="authSwitchMode('login')">로그인</button>
        <button class="auth-tab" data-mode="signup" onclick="authSwitchMode('signup')">회원가입</button>
      </div>

      <div class="auth-field" id="auth-name-field" style="display:none">
        <label>이름</label>
        <input id="auth-name" type="text" placeholder="홍길동">
      </div>
      <div class="auth-field" id="auth-role-field" style="display:none">
        <label>소속</label>
        <select id="auth-role">
          <option value="hmc_user">현대차 담당자</option>
          <option value="fiti_tester">FITI 시험자</option>
        </select>
      </div>
      <div class="auth-field">
        <label>이메일</label>
        <input id="auth-email" type="email" placeholder="user@example.com" autocomplete="email">
      </div>
      <div class="auth-field">
        <label>비밀번호</label>
        <input id="auth-password" type="password" placeholder="6자 이상" autocomplete="current-password">
      </div>
      <button class="auth-btn" id="auth-submit" onclick="authSubmit()">로그인</button>
      <div id="auth-msg" style="display:none"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 엔터키로 제출
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') authSubmit();
  });
}

// ─────────────────────────────────────────────────────────
// 2. 모드 전환 (로그인 ↔ 회원가입)
// ─────────────────────────────────────────────────────────
function authSwitchMode(mode) {
  AUTH_MODE = mode;
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.getElementById('auth-name-field').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('auth-role-field').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('auth-submit').textContent = mode === 'signup' ? '회원가입' : '로그인';
  authMsg('');
}

function authMsg(text, type = 'err') {
  const el = document.getElementById('auth-msg');
  if (!el) return;
  if (!text) { el.style.display = 'none'; return; }
  el.textContent = text;
  el.className = 'auth-msg ' + type;
  el.style.display = 'block';
}

// ─────────────────────────────────────────────────────────
// 3. 제출 처리 (로그인 / 회원가입)
// ─────────────────────────────────────────────────────────
async function authSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const pw = document.getElementById('auth-password').value;
  if (!email || !pw) { authMsg('이메일과 비밀번호를 입력하세요'); return; }
  if (pw.length < 6) { authMsg('비밀번호는 6자 이상이어야 합니다'); return; }

  const btn = document.getElementById('auth-submit');
  btn.disabled = true;
  btn.textContent = '처리 중...';

  try {
    if (AUTH_MODE === 'login') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) throw error;
      await authOnSignedIn(data.user);
    } else {
      const name = document.getElementById('auth-name').value.trim();
      const role = document.getElementById('auth-role').value;
      if (!name) { authMsg('이름을 입력하세요'); return; }
      const { data, error } = await sb.auth.signUp({
        email, password: pw,
        options: { data: { name, role } }
      });
      if (error) throw error;
      authMsg('가입 완료! 관리자 승인 후 사용 가능합니다.', 'ok');
      setTimeout(() => { authSwitchMode('login'); }, 2500);
    }
  } catch (e) {
    const msg = e.message || '오류가 발생했습니다';
    // Supabase 한국어화
    const ko = msg.includes('Invalid login') ? '이메일 또는 비밀번호가 올바르지 않습니다'
             : msg.includes('User already')  ? '이미 가입된 이메일입니다'
             : msg.includes('rate limit')    ? '너무 자주 시도했어요. 잠시 후 다시 시도해주세요'
             : msg;
    authMsg(ko);
  } finally {
    btn.disabled = false;
    btn.textContent = AUTH_MODE === 'signup' ? '회원가입' : '로그인';
  }
}

// ─────────────────────────────────────────────────────────
// 4. 로그인 성공 후 처리
// ─────────────────────────────────────────────────────────
async function authOnSignedIn(user) {
  window.CURRENT_USER = user;

  // 프로필 로드
  const { data: profile, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    authMsg('프로필 로드 실패: ' + error.message);
    await sb.auth.signOut();
    return;
  }

  window.CURRENT_PROFILE = profile;

  // 승인 상태 체크
  if (profile.status === 'pending') {
    authMsg('관리자 승인 대기 중입니다. 잠시만 기다려주세요.', 'info');
    await sb.auth.signOut();
    return;
  }
  if (profile.status === 'suspended') {
    authMsg('계정이 정지되었습니다. 관리자에게 문의하세요.');
    await sb.auth.signOut();
    return;
  }

  // ✅ 승인됨 → 오버레이 제거하고 앱 진입
  authHideOverlay();
  authShowUserBadge();
  applyRoleBasedUI();
}

function authHideOverlay() {
  const overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.remove();
}

// ─────────────────────────────────────────────────────────
// 5. 사이드바 푸터에 로그인 정보 표시
// ─────────────────────────────────────────────────────────
function authShowUserBadge() {
  const footer = document.querySelector('.sidebar-footer');
  if (!footer || !window.CURRENT_PROFILE) return;

  const p = window.CURRENT_PROFILE;
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

  const initial = (p.name || p.email || '?')[0].toUpperCase();

  footer.innerHTML = `
    <div class="ava" style="background:${roleColor}1a;color:${roleColor}">${initial}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:var(--tx);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name || p.email}</div>
      <div style="font-size:10px;color:${roleColor};font-weight:600">${roleLabel}</div>
    </div>
    <button onclick="authLogout()" title="로그아웃"
      style="background:none;border:none;cursor:pointer;color:var(--tx3);padding:6px;border-radius:4px;display:flex"
      onmouseover="this.style.background='var(--bg3)';this.style.color='var(--r)'"
      onmouseout="this.style.background='none';this.style.color='var(--tx3)'">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 2H2v10h3M9 4l3 3-3 3M12 7H5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  `;
}

// ─────────────────────────────────────────────────────────
// 6. 권한별 UI 조정 (현대차 담당자에게 일부 메뉴 숨김)
// ─────────────────────────────────────────────────────────
function applyRoleBasedUI() {
  if (!window.CURRENT_PROFILE) return;

  // 현대차 담당자에게는 시험결과/NG 입력 메뉴 숨김 → 추후 단계에서
  // 일단 1단계에서는 표시만 하고 실제 차단은 2단계에서
  if (window.isHmc?.()) {
    // 향후: 시험결과/NG 알림 메뉴 readonly 처리
    console.log('[auth] HMC 사용자 — 조회 모드');
  }
  if (window.isFitiAdmin?.()) {
    console.log('[auth] FITI 관리자 — 전체 권한');
  }
}

// ─────────────────────────────────────────────────────────
// 7. 로그아웃
// ─────────────────────────────────────────────────────────
async function authLogout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  await sb.auth.signOut();
  location.reload();
}

// ─────────────────────────────────────────────────────────
// 8. 페이지 로드 시 자동 실행
// ─────────────────────────────────────────────────────────
async function authInit() {
  // 즉시 오버레이 표시 (앱은 뒤에서 계속 init)
  authInjectLoginUI();

  // 세션 체크 (이미 로그인되어 있으면 자동 진입)
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await authOnSignedIn(session.user);
  }
}

// 가장 먼저 실행
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', authInit);
} else {
  authInit();
}
