// ============================================================
// new-order-page.js — 신규 차수 등록을 모달에서 페이지로 변환
// ============================================================
// 동작:
//  1. 페이지 로드 시 모달 안의 STEP2 폼을 새 페이지 컨테이너로 이동
//  2. openNewOrderModal() 오버라이드: 차체는 페이지로, 휠/DGU는 모달 유지
//  3. 등록 성공 후(closeModal 호출 시) 의뢰 관리 페이지로 자동 복귀
// ============================================================

(function () {

  // ─────────────────────────────────────────────────────
  // 1. 모달 안의 STEP2 폼을 페이지로 이동
  // ─────────────────────────────────────────────────────
  function migrateFormToPage() {
    const pageBody = document.getElementById('page-new-order-content');
    const step2 = document.getElementById('no-step2');

    if (!pageBody || !step2) {
      console.warn('[new-order-page] 페이지 컨테이너 또는 STEP2 못 찾음');
      return;
    }

    // STEP2를 페이지로 이동 + 항상 표시
    step2.style.display = 'block';
    pageBody.appendChild(step2);

    // STEP1 (메일 파싱 영역) 완전 제거
    const step1 = document.getElementById('no-step1');
    if (step1) step1.remove();

    // "← 다시 파싱" 버튼 제거 (dead link)
    const backBtn = step2.querySelector('button[onclick*="noBackToStep1"]');
    if (backBtn) backBtn.remove();

    // 푸터 정렬을 오른쪽으로
    const footerDiv = step2.querySelector('div[style*="justify-content:space-between"]');
    if (footerDiv) {
      footerDiv.style.justifyContent = 'flex-end';
      // 내부의 wrapping div 풀기
      const innerWrap = footerDiv.querySelector('div[style*="display:flex"][style*="gap:8px"]');
      if (innerWrap) {
        while (innerWrap.firstChild) footerDiv.appendChild(innerWrap.firstChild);
        innerWrap.remove();
      }
    }

    // 모달의 "취소" 버튼을 페이지 복귀로 변경
    const cancelBtns = step2.querySelectorAll('button[onclick*="closeModal"][onclick*="new-order-modal"]');
    cancelBtns.forEach(b => b.setAttribute('onclick', 'goBackFromNewOrder()'));
  }

  // ─────────────────────────────────────────────────────
  // 2. 신규 등록 페이지로 이동
  // ─────────────────────────────────────────────────────
  window.goToNewOrderPage = function () {
    // 모든 페이지 숨기고, 메뉴 active 제거
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // 신규 등록 페이지 활성화
    document.getElementById('page-new-order').classList.add('active');

    // 폼 필드 초기화
    const today = new Date().toISOString().slice(0, 10);
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('no-date', today);
    const dueEl = document.getElementById('no-due-date');
    if (dueEl) {
      const dt = new Date(); dt.setDate(dt.getDate() + 30);
      dueEl.value = dt.toISOString().slice(0, 10);
    }
    setVal('no-cha', '');
    setVal('no-purpose', '');
    setVal('no-maker', '');
    setVal('no-colors', '');
    setVal('no-cnt', '');
    const colorRows = document.getElementById('no-color-rows');
    if (colorRows) colorRows.innerHTML = '';

    // 투톤 초기화
    if (typeof noTwoToneData !== 'undefined') window.noTwoToneData = [];
    const ttChk = document.getElementById('no-twotone-enable');
    if (ttChk) ttChk.checked = false;
    const ttWrap = document.getElementById('no-twotone-wrap');
    if (ttWrap) ttWrap.style.display = 'none';
    const ttRows = document.getElementById('no-twotone-rows');
    if (ttRows) ttRows.innerHTML = '';

    // 시스템 칩
    const chip = document.getElementById('no-sys-chip');
    if (chip) {
      chip.textContent = ({ dgu: 'DGU', wheel: '휠도장', body: '차체도장' })[window.CUR_SYS] || '차체도장';
    }

    // 차수 필드 포커스
    setTimeout(() => document.getElementById('no-cha')?.focus(), 100);
  };

  // ─────────────────────────────────────────────────────
  // 3. 의뢰 관리 페이지로 복귀
  // ─────────────────────────────────────────────────────
  window.goBackFromNewOrder = function () {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-orders').classList.add('active');

    // 의뢰 관리 메뉴 active 처리
    const ordersNav = document.querySelector("button.nav-item[onclick*=\"nav('orders'\"]");
    if (ordersNav) ordersNav.classList.add('active');

    try { localStorage.setItem('fiti_last_page', 'orders'); } catch (e) { }
  };

  // ─────────────────────────────────────────────────────
  // 4. openNewOrderModal 오버라이드
  //    차체 → 페이지 / 휠 → 휠 모달 / DGU → DGU 모달
  // ─────────────────────────────────────────────────────
  let _origOpen = null;

  function installOpenOverride() {
    if (_origOpen || typeof window.openNewOrderModal !== 'function') return false;
    _origOpen = window.openNewOrderModal;

    window.openNewOrderModal = function () {
      const sys = window.CUR_SYS;
      if (sys === 'wheel') {
        // 휠은 원본의 휠 분기 (openNewOrderModalWheel) 사용
        return _origOpen();
      }
      if (sys === 'body' || !sys) {
        return goToNewOrderPage();
      }
      if (sys === 'dgu') {
        // DGU는 STEP2-DGU 모달
        const s2d = document.getElementById('no-step2-dgu');
        if (s2d) s2d.style.display = 'block';
        const dateEl = document.getElementById('no-date-dgu');
        if (dateEl) dateEl.value = new Date().toISOString().slice(0, 10);
        if (typeof openModal === 'function') openModal('new-order-modal');
      }
    };
    return true;
  }

  // ─────────────────────────────────────────────────────
  // 5. closeModal 오버라이드
  //    new-order-modal 닫기 → 페이지 모드면 복귀
  // ─────────────────────────────────────────────────────
  function installCloseOverride() {
    if (typeof window.closeModal !== 'function') return false;
    const _origClose = window.closeModal;
    window.closeModal = function (id) {
      _origClose(id);
      if (id === 'new-order-modal') {
        const page = document.getElementById('page-new-order');
        if (page && page.classList.contains('active')) {
          goBackFromNewOrder();
        }
      }
    };
    return true;
  }

  // ─────────────────────────────────────────────────────
  // 6. 페이지 로드 시 실행
  // ─────────────────────────────────────────────────────
  function init() {
    migrateFormToPage();

    // body.js 로드 후 오버라이드 설치 (재시도)
    let tries = 0;
    const wait = setInterval(() => {
      if (installOpenOverride() && installCloseOverride()) {
        clearInterval(wait);
      }
      if (++tries > 50) clearInterval(wait); // 5초 후 포기
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
