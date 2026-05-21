// ============================================================
// new-order-page.js v2 — 신규 차수 등록 페이지화 + UI 개선
// ============================================================
// 변경:
//  - 연도 2026 추가 + 기본 선택
//  - 업체·색상 입력 UI 개선: 업체별 한 행씩 직접 입력 (× 삭제)
//  - "+ 업체 추가" 버튼
//  - 레거시 호환: registerOrder()는 그대로 사용 (hidden 필드로 동기화)
// ============================================================

(function () {

  // ─────────────────────────────────────────────────────
  // 1. 모달의 STEP2 폼을 페이지로 이동
  // ─────────────────────────────────────────────────────
  function migrateFormToPage() {
    const pageBody = document.getElementById('page-new-order-content');
    const step2 = document.getElementById('no-step2');
    if (!pageBody || !step2) {
      console.warn('[new-order-page] 페이지 또는 STEP2 못 찾음');
      return;
    }

    step2.style.display = 'block';
    pageBody.appendChild(step2);

    // STEP1 (메일 파싱) 제거
    const step1 = document.getElementById('no-step1');
    if (step1) step1.remove();

    // "← 다시 파싱" 버튼 제거
    const backBtn = step2.querySelector('button[onclick*="noBackToStep1"]');
    if (backBtn) backBtn.remove();

    // 푸터 정렬 정리
    const footerDiv = step2.querySelector('div[style*="justify-content:space-between"]');
    if (footerDiv) {
      footerDiv.style.justifyContent = 'flex-end';
      const innerWrap = footerDiv.querySelector('div[style*="display:flex"][style*="gap:8px"]');
      if (innerWrap) {
        while (innerWrap.firstChild) footerDiv.appendChild(innerWrap.firstChild);
        innerWrap.remove();
      }
    }

    // 취소 버튼 → 페이지 복귀
    const cancelBtns = step2.querySelectorAll('button[onclick*="closeModal"][onclick*="new-order-modal"]');
    cancelBtns.forEach(b => b.setAttribute('onclick', 'goBackFromNewOrder()'));
  }

  // ─────────────────────────────────────────────────────
  // 2. 폼 커스터마이즈: 2026 연도 + 업체·색상 UI 교체
  // ─────────────────────────────────────────────────────
  function customizeForm() {
    const step2 = document.getElementById('no-step2');
    if (!step2) return;

    // (1) 연도 드롭다운에 2026 추가 (없으면)
    const yearSel = step2.querySelector('#no-year');
    if (yearSel && !yearSel.querySelector('option[value="2026"]')) {
      const opt2026 = document.createElement('option');
      opt2026.value = '2026';
      opt2026.textContent = '2026';
      yearSel.insertBefore(opt2026, yearSel.firstChild);
      yearSel.value = '2026';
    }

    // (2) 업체·색상 입력 UI 교체
    //     기존: 쉼표 입력 + "차종 분리" 버튼 + 동적 행
    //     변경: 처음부터 업체별 행으로 직접 입력
    const oldMakerInput = step2.querySelector('#no-maker');
    if (!oldMakerInput || oldMakerInput.type === 'hidden') return; // 이미 변환됨

    const oldField = oldMakerInput.closest('.field');
    if (!oldField) return;

    // 새 필드 생성
    const newField = document.createElement('div');
    newField.className = 'field';
    newField.style.marginBottom = '10px';
    newField.innerHTML = `
      <label>업체 · 색상 <span style="font-size:11px;color:var(--tx3);font-weight:400">(업체별로 색상 입력 — 색상은 쉼표로 구분)</span></label>
      <div id="np-maker-list" style="display:flex;flex-direction:column;gap:6px"></div>
      <button class="btn sm" type="button" onclick="npAddMakerRow()" style="margin-top:8px">+ 업체 추가</button>
    `;
    oldField.replaceWith(newField);

    // 레거시 호환 hidden 필드 (registerOrder가 읽음)
    const hMaker = document.createElement('input');
    hMaker.id = 'no-maker';
    hMaker.type = 'hidden';
    newField.appendChild(hMaker);

    // 기존 #no-color-rows 이동 또는 생성 (registerOrder가 querySelector로 읽음)
    let oldColorRows = step2.querySelector('#no-color-rows');
    if (oldColorRows) {
      oldColorRows.style.display = 'none';
      newField.appendChild(oldColorRows);
    } else {
      const cr = document.createElement('div');
      cr.id = 'no-color-rows';
      cr.style.display = 'none';
      newField.appendChild(cr);
    }
  }

  // ─────────────────────────────────────────────────────
  // 3. 업체 행 추가 (전역)
  // ─────────────────────────────────────────────────────
  window.npAddMakerRow = function (maker = '', colors = '') {
    const list = document.getElementById('np-maker-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'np-maker-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center';
    row.innerHTML = `
      <input class="np-maker-name" placeholder="업체" value="${escapeHtml(maker)}" 
             style="width:120px;flex-shrink:0" oninput="npSync()">
      <input class="np-maker-colors" placeholder="색상 (쉼표 구분, 예: YAC, R2T, R8N, CRP)" value="${escapeHtml(colors)}" 
             style="flex:1;min-width:0" oninput="npSync()">
      <button type="button" onclick="this.closest('.np-maker-row').remove();npSync()" 
              style="background:none;border:none;color:var(--tx3);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1;flex-shrink:0"
              title="이 업체 삭제">×</button>
    `;
    list.appendChild(row);
    npSync();
    setTimeout(() => row.querySelector('.np-maker-name')?.focus(), 50);
  };

  // ─────────────────────────────────────────────────────
  // 4. 새 UI → 레거시 hidden 필드 동기화
  //    registerOrder()는 #no-maker, [data-maker-row]에서 값을 읽으므로
  //    여기에 맞춰 hidden 영역을 채워줘야 함
  // ─────────────────────────────────────────────────────
  window.npSync = function () {
    const rows = document.querySelectorAll('.np-maker-row');
    const makers = [];
    const legacy = document.getElementById('no-color-rows');
    if (legacy) legacy.innerHTML = '';

    rows.forEach(row => {
      const name = row.querySelector('.np-maker-name').value.trim();
      const colors = row.querySelector('.np-maker-colors').value.trim();
      if (name) {
        makers.push(name);
        if (legacy) {
          const legacyRow = document.createElement('div');
          legacyRow.setAttribute('data-maker-row', name);
          const input = document.createElement('input');
          input.value = colors;
          legacyRow.appendChild(input);
          legacy.appendChild(legacyRow);
        }
      }
    });

    const hMaker = document.getElementById('no-maker');
    if (hMaker) hMaker.value = makers.join(', ');
  };

  // HTML 이스케이프 (입력값을 value 속성에 안전하게 넣기 위함)
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─────────────────────────────────────────────────────
  // 5. 페이지로 이동
  // ─────────────────────────────────────────────────────
  window.goToNewOrderPage = function () {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-new-order').classList.add('active');

    // 폼 초기화
    const today = new Date().toISOString().slice(0, 10);
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('no-cha', '');
    setVal('no-purpose', '');
    setVal('no-cnt', '');
    setVal('no-date', today);
    const dueEl = document.getElementById('no-due-date');
    if (dueEl) {
      const dt = new Date(); dt.setDate(dt.getDate() + 30);
      dueEl.value = dt.toISOString().slice(0, 10);
    }

    // 연도: 현재 보고있는 연도(CY) 우선, 없으면 2026
    const yearSel = document.getElementById('no-year');
    if (yearSel) {
      const target = window.CY || '2026';
      if (yearSel.querySelector(`option[value="${target}"]`)) yearSel.value = target;
      else yearSel.value = '2026';
    }

    // 업체·색상 UI 초기화 (빈 행 1개로 시작)
    const npList = document.getElementById('np-maker-list');
    if (npList) {
      npList.innerHTML = '';
      window.npAddMakerRow();
    }
    // 레거시 hidden 비우기
    setVal('no-maker', '');
    setVal('no-colors', '');

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

    // 차수 필드에 포커스
    setTimeout(() => document.getElementById('no-cha')?.focus(), 100);
  };

  // ─────────────────────────────────────────────────────
  // 6. 의뢰 관리로 복귀
  // ─────────────────────────────────────────────────────
  window.goBackFromNewOrder = function () {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-orders').classList.add('active');
    const ordersNav = document.querySelector("button.nav-item[onclick*=\"nav('orders'\"]");
    if (ordersNav) ordersNav.classList.add('active');
    try { localStorage.setItem('fiti_last_page', 'orders'); } catch (e) { }
  };

  // ─────────────────────────────────────────────────────
  // 7. openNewOrderModal 오버라이드
  //    차체 → 페이지 / 휠 → 휠 모달 / DGU → DGU 모달
  // ─────────────────────────────────────────────────────
  let _origOpen = null;
  function installOpenOverride() {
    if (_origOpen || typeof window.openNewOrderModal !== 'function') return false;
    _origOpen = window.openNewOrderModal;
    window.openNewOrderModal = function () {
      const sys = window.CUR_SYS;
      if (sys === 'wheel') return _origOpen();
      if (sys === 'body' || !sys) return goToNewOrderPage();
      if (sys === 'dgu') {
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
  // 8. closeModal 오버라이드 — 등록 후 페이지에서 자동 복귀
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
  // 9. 초기화
  // ─────────────────────────────────────────────────────
  function init() {
    migrateFormToPage();
    customizeForm();

    let tries = 0;
    const wait = setInterval(() => {
      if (installOpenOverride() && installCloseOverride()) {
        clearInterval(wait);
      }
      if (++tries > 50) clearInterval(wait);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
