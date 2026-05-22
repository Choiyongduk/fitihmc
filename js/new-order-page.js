// ============================================================
// new-order-page.js v4 — 신규 차수 등록 페이지 + 시편/항목 선택
// ============================================================
// v4 변경:
//  - 시편 종류별 시험 항목 아코디언 UI (▶ 클릭으로 펼침/접기)
//  - 등록 시 선택된 시편 종류 + 시험 항목 적용
//  - DEFAULT_ITEMS는 common.js 원본 그대로 사용 (수정 없음)
// ============================================================

(function () {

  // ─────────────────────────────────────────────────────
  // DEFAULT_ITEMS 보정 — 중도도막만 추가 (나머지는 common.js 원본 유지)
  // ─────────────────────────────────────────────────────
  function patchDefaultItems() {
    if (typeof DEFAULT_ITEMS === 'undefined') return;
    // 중도도막: 도막두께, 경도, 내충격성, 부착성, 내수성, 내습성
    if (!DEFAULT_ITEMS['중도도막']) {
      DEFAULT_ITEMS['중도도막'] = ['도막두께', '경도', '내충격성', '부착성', '내수성', '내습성'];
    }
  }

  // 디폴트 체크 시편 종류
  const DEFAULT_CHECKED_SECTIONS = [
    '완성도막', 'OVER BAKE', 'UNDER BAKE',
    '재도장', '층간부착', 'O/B층간부착'
  ];

  // UI에 표시할 시편 종류 목록 (common.js의 DEFAULT_ITEMS 기준)
  const SECTION_OPTIONS = [
    { value: '완성도막',     label: '완성도막' },
    { value: 'OVER BAKE',    label: 'OVER BAKE (O/B)' },
    { value: 'UNDER BAKE',   label: 'UNDER BAKE (U/B)' },
    { value: '재도장',       label: '재도장' },
    { value: '층간부착',     label: '층간부착' },
    { value: 'O/B층간부착',  label: 'O/B층간부착' },
    { value: '투톤도막',     label: '투톤도막' },
    { value: '중도도막',     label: '중도도막' },
    { value: '내판도막',     label: '내판도막' },
    { value: '중도 삭제',    label: '중도 삭제 도막' },
  ];

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

    const step1 = document.getElementById('no-step1');
    if (step1) step1.remove();

    const backBtn = step2.querySelector('button[onclick*="noBackToStep1"]');
    if (backBtn) backBtn.remove();

    const footerDiv = step2.querySelector('div[style*="justify-content:space-between"]');
    if (footerDiv) {
      footerDiv.style.justifyContent = 'flex-end';
      const innerWrap = footerDiv.querySelector('div[style*="display:flex"][style*="gap:8px"]');
      if (innerWrap) {
        while (innerWrap.firstChild) footerDiv.appendChild(innerWrap.firstChild);
        innerWrap.remove();
      }
    }

    const cancelBtns = step2.querySelectorAll('button[onclick*="closeModal"][onclick*="new-order-modal"]');
    cancelBtns.forEach(b => b.setAttribute('onclick', 'goBackFromNewOrder()'));
  }

  // ─────────────────────────────────────────────────────
  // 2. 폼 커스터마이즈
  // ─────────────────────────────────────────────────────
  function customizeForm() {
    const step2 = document.getElementById('no-step2');
    if (!step2) return;

    hideParseSummary(step2);
    addYear2026(step2);
    rearrangeAndAddDueDate(step2);
    replaceMakerUI(step2);
    addSectionTypeSelector(step2);
  }

  function hideParseSummary(step2) {
    const ps = step2.querySelector('#no-parse-summary');
    if (ps) ps.style.display = 'none';
  }

  function addYear2026(step2) {
    const yearSel = step2.querySelector('#no-year');
    if (!yearSel || yearSel.querySelector('option[value="2026"]')) return;
    const opt = document.createElement('option');
    opt.value = '2026';
    opt.textContent = '2026';
    yearSel.insertBefore(opt, yearSel.firstChild);
    yearSel.value = '2026';
  }

  function rearrangeAndAddDueDate(step2) {
    if (step2.querySelector('#no-due-date')) return;

    const dateInput = step2.querySelector('#no-date');
    const mgrInput = step2.querySelector('#no-mgr');
    if (!dateInput) return;

    const dateField = dateInput.closest('.field');
    const mgrField = mgrInput?.closest('.field');
    const grid = dateField?.closest('.grid2');

    const dueField = document.createElement('div');
    dueField.className = 'field';
    dueField.innerHTML = `
      <label>평가 요청 일정 <span style="font-size:11px;color:var(--tx3);font-weight:400">(완료예정일)</span></label>
      <input id="no-due-date" type="date">
    `;

    if (grid && mgrField && mgrField.parentElement === grid) {
      grid.insertAdjacentElement('beforebegin', mgrField);
      mgrField.style.marginBottom = '10px';
      grid.appendChild(dueField);
    } else {
      (dateField || dateInput.parentElement).insertAdjacentElement('afterend', dueField);
    }
  }

  function replaceMakerUI(step2) {
    const oldMakerInput = step2.querySelector('#no-maker');
    if (!oldMakerInput || oldMakerInput.type === 'hidden') return;

    const oldField = oldMakerInput.closest('.field');
    if (!oldField) return;

    const newField = document.createElement('div');
    newField.className = 'field';
    newField.style.marginBottom = '10px';
    newField.innerHTML = `
      <label>업체 · 색상 <span style="font-size:11px;color:var(--tx3);font-weight:400">(업체별로 색상 입력 — 색상은 쉼표로 구분)</span></label>
      <div id="np-maker-list" style="display:flex;flex-direction:column;gap:6px"></div>
      <button class="btn sm" type="button" onclick="npAddMakerRow()" style="margin-top:8px">+ 업체 추가</button>
    `;
    oldField.replaceWith(newField);

    const hMaker = document.createElement('input');
    hMaker.id = 'no-maker';
    hMaker.type = 'hidden';
    newField.appendChild(hMaker);

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

  function addSectionTypeSelector(step2) {
    if (step2.querySelector('#np-sec-list')) return;

    const cntInput = step2.querySelector('#no-cnt');
    if (!cntInput) return;
    const cntField = cntInput.closest('.field');
    if (!cntField) return;

    const rowsHtml = SECTION_OPTIONS.map(opt => {
      const items = (typeof DEFAULT_ITEMS !== 'undefined' && DEFAULT_ITEMS[opt.value]) || [];
      const checked = DEFAULT_CHECKED_SECTIONS.includes(opt.value);
      const itemCount = items.length;

      const itemChips = items.map(item => `
        <label class="np-item-chip" style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;color:var(--tx);padding:3px 8px;background:var(--bg);border:1px solid var(--border);border-radius:12px;user-select:none">
          <input type="checkbox" class="np-item-chk" data-sec="${escapeAttr(opt.value)}" value="${escapeAttr(item)}" checked style="margin:0;width:11px;height:11px;cursor:pointer">
          ${escapeHtml(item)}
        </label>
      `).join('');

      return `
        <div class="np-sec-row" data-sec="${escapeAttr(opt.value)}" style="background:var(--bg2);border:1px solid var(--border);border-radius:6px;margin-bottom:4px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;font-size:13px">
            <input type="checkbox" class="np-sec-chk" value="${escapeAttr(opt.value)}" ${checked ? 'checked' : ''} style="margin:0;width:16px;height:16px;cursor:pointer;flex-shrink:0">
            <div ${itemCount > 0 ? 'onclick="npToggleItems(this)"' : ''} style="flex:1;display:flex;align-items:center;gap:8px;${itemCount > 0 ? 'cursor:pointer' : ''}">
              <span style="font-weight:600;flex:1">${escapeHtml(opt.label)}</span>
              <span style="font-size:11px;color:var(--tx3);font-family:var(--mono)">${itemCount > 0 ? itemCount + '개 항목' : '항목 없음'}</span>
              ${itemCount > 0 ? `<span class="np-sec-chev" style="color:var(--tx3);font-size:11px">▾</span>` : ''}
            </div>
          </div>
          ${itemCount > 0 ? `<div class="np-sec-items" style="display:none;flex-wrap:wrap;gap:4px;padding:4px 10px 10px 30px">${itemChips}</div>` : ''}
        </div>
      `;
    }).join('');

    const newField = document.createElement('div');
    newField.className = 'field';
    newField.style.marginBottom = '10px';
    newField.innerHTML = `
      <label>시편 종류 <span style="font-size:11px;color:var(--tx3);font-weight:400">(체크박스로 종류 선택 · 이름 클릭으로 시험 항목 펼치기)</span></label>
      <div id="np-sec-list" style="background:var(--bg3);padding:8px;border-radius:8px;border:1px solid var(--border)">
        ${rowsHtml}
      </div>
      <input id="np-sec-custom" placeholder="기타 시편종류 추가 (쉼표 구분, 선택사항)" style="width:100%;margin-top:8px">
    `;

    cntField.insertAdjacentElement('beforebegin', newField);
  }

  // ─────────────────────────────────────────────────────
  // 3. 아코디언 토글
  // ─────────────────────────────────────────────────────
  window.npToggleItems = function (el) {
    const row = el.closest('.np-sec-row');
    const items = row?.querySelector('.np-sec-items');
    if (!items) return;
    const isOpen = items.style.display !== 'none';
    items.style.display = isOpen ? 'none' : 'flex';
    const chev = row.querySelector('.np-sec-chev');
    if (chev) chev.textContent = isOpen ? '▾' : '▴';
  };

  // ─────────────────────────────────────────────────────
  // 4. 업체 행 추가/동기화
  // ─────────────────────────────────────────────────────
  window.npAddMakerRow = function (maker = '', colors = '') {
    const list = document.getElementById('np-maker-list');
    if (!list) return;

    const row = document.createElement('div');
    row.className = 'np-maker-row';
    row.style.cssText = 'display:flex;gap:6px;align-items:center';
    row.innerHTML = `
      <input class="np-maker-name" placeholder="업체" value="${escapeAttr(maker)}" 
             style="width:120px;flex-shrink:0" oninput="npSync()">
      <input class="np-maker-colors" placeholder="색상 (쉼표 구분, 예: YAC, R2T, R8N, CRP)" value="${escapeAttr(colors)}" 
             style="flex:1;min-width:0" oninput="npSync()">
      <button type="button" onclick="this.closest('.np-maker-row').remove();npSync()" 
              style="background:none;border:none;color:var(--tx3);font-size:20px;cursor:pointer;padding:4px 10px;line-height:1;flex-shrink:0"
              title="이 업체 삭제">×</button>
    `;
    list.appendChild(row);
    npSync();
    setTimeout(() => row.querySelector('.np-maker-name')?.focus(), 50);
  };

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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s);
  }

  // ─────────────────────────────────────────────────────
  // 5. 페이지로 이동 / 복귀
  // ─────────────────────────────────────────────────────
  window.goToNewOrderPage = function () {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-new-order').classList.add('active');

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

    const yearSel = document.getElementById('no-year');
    if (yearSel) {
      const target = window.CY || '2026';
      if (yearSel.querySelector(`option[value="${target}"]`)) yearSel.value = target;
      else yearSel.value = '2026';
    }

    // 시편 종류 체크박스 + 항목 체크박스 초기화
    document.querySelectorAll('.np-sec-chk').forEach(c => {
      c.checked = DEFAULT_CHECKED_SECTIONS.includes(c.value);
    });
    document.querySelectorAll('.np-item-chk').forEach(c => { c.checked = true; });
    document.querySelectorAll('.np-sec-items').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.np-sec-chev').forEach(b => b.textContent = '▾');
    const customSec = document.getElementById('np-sec-custom');
    if (customSec) customSec.value = '';

    // 업체·색상 UI 초기화
    const npList = document.getElementById('np-maker-list');
    if (npList) {
      npList.innerHTML = '';
      window.npAddMakerRow();
    }
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

    const chip = document.getElementById('no-sys-chip');
    if (chip) {
      chip.textContent = ({ dgu: 'DGU', wheel: '휠도장', body: '차체도장' })[window.CUR_SYS] || '차체도장';
    }

    setTimeout(() => document.getElementById('no-cha')?.focus(), 100);
  };

  window.goBackFromNewOrder = function () {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-orders').classList.add('active');
    const ordersNav = document.querySelector("button.nav-item[onclick*=\"nav('orders'\"]");
    if (ordersNav) ordersNav.classList.add('active');
    try { localStorage.setItem('fiti_last_page', 'orders'); } catch (e) { }
  };

  // ─────────────────────────────────────────────────────
  // 6. 함수 오버라이드
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

  let _origRegister = null;
  function installRegisterOverride() {
    if (_origRegister || typeof window.registerOrder !== 'function') return false;
    _origRegister = window.registerOrder;
    window.registerOrder = function () {
      const onPage = document.getElementById('page-new-order')?.classList.contains('active');
      if (!onPage) return _origRegister();

      // 사용자 선택 수집
      const selectedSections = [];
      const sectionItems = {};

      document.querySelectorAll('.np-sec-row').forEach(row => {
        const chk = row.querySelector('.np-sec-chk');
        if (!chk?.checked) return;
        const sec = chk.value;
        selectedSections.push(sec);
        const items = [...row.querySelectorAll('.np-item-chk:checked')].map(c => c.value);
        sectionItems[sec] = items;
      });

      // 기타 시편종류 (DEFAULT_ITEMS에 있으면 그 항목들, 없으면 빈 섹션)
      const customStr = document.getElementById('np-sec-custom')?.value?.trim();
      if (customStr) {
        const customs = customStr.split(/[,，]+/).map(s => s.trim()).filter(Boolean);
        customs.forEach(name => {
          selectedSections.push(name);
          sectionItems[name] = (typeof DEFAULT_ITEMS !== 'undefined' && DEFAULT_ITEMS[name])
            ? [...DEFAULT_ITEMS[name]]
            : [];
        });
      }

      if (selectedSections.length === 0) {
        alert('시편 종류를 1개 이상 선택해주세요');
        return;
      }

      // 차수(cha) 정규화: 끝의 "차"/"차수" 제거 → "1차" 입력해도 "1차차" 방지
      const chaEl = document.getElementById('no-cha');
      if (chaEl) chaEl.value = chaEl.value.trim().replace(/\s*차수?\s*$/,'');

      // 등록 전 모든 차수 ID 스냅샷 (연도 무관)
      const _dbOrders = (typeof activeDB === 'function') ? activeDB().orders : {};
      const allBefore = new Set();
      Object.values(_dbOrders).forEach(arr => (arr || []).forEach(o => allBefore.add(o.id)));

      // body.js의 registerOrder()가 읽는 noParsedData.sectionItems에 주입
      // (let noParsedData가 body.js에서 선언되어 있음 — 같은 스크립트 스코프 공유)
      const prev = (typeof noParsedData !== 'undefined') ? noParsedData : null;
      try {
        const tmp = {
          makers: [],
          colorsByMaker: {},
          sectionItems: sectionItems,
          sectionEA: {},
        };
        if (typeof noParsedData !== 'undefined') {
          noParsedData = tmp;
        } else {
          window.noParsedData = tmp;
        }
        _origRegister();
      } finally {
        if (typeof noParsedData !== 'undefined') {
          noParsedData = prev;
        }
      }

      // 등록 성공 시 → 새로 생긴 차수를 찾아 워크플로우로 즉시 이동 (빈 의뢰관리 대신)
      const dbNow = (typeof activeDB === 'function') ? activeDB().orders : {};
      let created = null;
      Object.values(dbNow).forEach(arr => (arr || []).forEach(o => { if (!allBefore.has(o.id)) created = o; }));
      if (created && typeof wfOpenOrder === 'function') {
        wfOpenOrder(created.id);
      }
    };
    return true;
  }

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
  // 7. 초기화
  // ─────────────────────────────────────────────────────
  function init() {
    patchDefaultItems();
    migrateFormToPage();
    customizeForm();

    let tries = 0;
    const wait = setInterval(() => {
      const ok1 = installOpenOverride();
      const ok2 = installCloseOverride();
      const ok3 = installRegisterOverride();
      if (ok1 && ok2 && ok3) clearInterval(wait);
      if (++tries > 50) clearInterval(wait);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
