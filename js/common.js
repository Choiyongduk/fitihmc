// ======================================================
// common.js — 공통: 단가표·DB·저장·switchSystem·헬퍼
// ======================================================

// ══════════════════════════════════════════════════════
// 단가표 (단가표 시트 기반)
// ══════════════════════════════════════════════════════
const PRICE_MAP = {
  '도막두께':6700,'광택':6700,'경도':6700,'내충격성':6700,
  '부착성':13500,'내수성':30000,'내습성':30000,
  '내스크래치성':30000,'내치핑성':30000,'내염수분무성':30000,'ATR분석':30000,
  '재도장성':13500,'층간부착성':13500,'O/B층간부착성':13500,
};

// ── 휠도장 단가표 (2026년 견적서 기준)
const PRICE_MAP_WHEEL = {
  '도막두께':       25000,   // 포인트당 (등록 시 포인트 수로 계산)
  '도막두께-전처리':200000,  // 종당 고정
  '부착성':         20000,
  '내수성':         480000,
  '내습성':         480000,
  '내치핑성':       100000,
  '내염수분무성':   750000,
  'CASS시험':       3600000,
  'CASS 시험':      3600000,
  'IR분석':         50000,
};

// ── 휠도장 기본 시편 항목 (도막두께-전처리는 의뢰 등록 시만 체크, 시험결과 별도)
const DEFAULT_ITEMS_WHEEL = {
  '완성도막': ['도막두께','부착성','내수성','내습성','내치핑성','내염수분무성','CASS시험','IR분석'],
};

// ── DGU(접착제) 단가표 (MS715-25 기준 — 추후 업데이트 예정)
// ── DGU(접착제) 단가표 (2025년 현대자동차 용역 견적서 기준)
// 구조: 시험항목 단가 + 노화조건 추가비용 조합
const PRICE_MAP_DGU = {
  // ── 노화조건비 (차수당 1회 고정)
  '내열':         400000,
  '내수':        1000000,
  '내약품':        47500,
  '내열CYCLE':    780000,
  '시료제작비':   190000,   // 차수당 1회

  // ── 피착제 조합 × 조건 횟수 (KNIFE CUT / 전단강도 / 경도)
  'KNIFE CUT':     19000,
  '전단강도':      19000,
  '전단모듈러스':   9500,   // 각 조합의 상태조건에서만
  '경도':           9500,

  // ── 실러업체 수 × 단가 (인장강도 / 신율 / 인열강도)
  '인장강도':      23000,
  '신율':           9500,
  '인열강도':       9500,
};

// ── DGU 노화조건 목록
const DGU_CONDITIONS = ['상태','내열','내수','내약품','내열CYCLE'];

// ── DGU 기본 시험항목 (섹션 구조: 항목_조건 형식)
// '피착제' 섹션으로 구분 (GLASS종류, 도장색상 등)
const DEFAULT_ITEMS_DGU = {
  // KNIFE CUT: 피착제×조건 횟수만큼 단가 × 회수, 노화조건비 1회
  'KNIFE CUT': ['KNIFE CUT','내열','내수','내약품','내열CYCLE'],
  // 전단강도: 피착제×조건 횟수, 전단모듈러스는 상태조건 조합만
  '전단강도': ['전단강도','전단모듈러스','내열','내수','내약품','내열CYCLE'],
  // 경도: 피착제 조합×조건
  '경도': ['경도','내열','내수'],
  // 실러물성: 실러업체 수 곱하기
  '실러물성': ['인장강도','신율','인열강도'],
  // 시료제작비: 차수당 1회
  '기타': ['시료제작비'],
};

// ── 현재 활성 시스템 ('body' | 'wheel' | 'dgu')
let CUR_SYS = 'body';


// 단가 추정 헬퍼 (이름으로 유추)
function getPrice(n){
  if(CUR_SYS==='wheel'){
    return PRICE_MAP_WHEEL[n]||0;
  }
  if(CUR_SYS==='dgu'){
    return PRICE_MAP_DGU[n]||0;
  }
  if(PRICE_MAP[n]) return PRICE_MAP[n];
  if(n.includes('부착성')) return 13500;
  if(n.includes('내수')||n.includes('내습')||n.includes('내치핑')||n.includes('내스크')||n.includes('내염')||n.includes('ATR')) return 30000;
  return 6700;
}


// ── 시편종류에 따른 항목명 정규화
function normItemName(name, secName){
  if(!name) return name;
  const sec = (secName||'').toLowerCase();
  // 재도장 계열
  if(/재도장/.test(sec) && !(/층간/.test(sec))) {
    if(name==='부착성') return '재도장성';
  }
  // 층간부착 (O/B 포함)
  if(/층간/.test(sec) && /o\/b|오버베이킹|ob/.test(sec)) {
    if(name==='부착성'||name==='층간부착성') return 'O/B층간부착성';
  }
  if(/층간/.test(sec) && !/o\/b|오버베이킹|ob/.test(sec)) {
    if(name==='부착성') return '층간부착성';
  }
  return name;
}

// 시험 구분별 기본 항목 (실제 파일 기반 전체 목록)
const DEFAULT_ITEMS = {
  '완성도막':       ['도막두께','광택','부착성','내충격성','경도','내수성','내습성','내스크래치성','내치핑성','내염수분무성','ATR분석'],
  'OVER BAKE':      ['도막두께','부착성','내충격성','내수성','내치핑성'],
  'UNDER BAKE':     ['도막두께','부착성','내충격성','내수성','내치핑성'],
  '재도장':         ['재도장성'],
  '층간부착':       ['층간부착성'],
  'O/B층간부착':    ['O/B층간부착성'],
  'O/B 층간부착':   ['O/B층간부착성'],
  '내판도막':       ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '내판 도막':      ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '도어 내판':      ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '후드 내판':      ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '후드/테일게이트':['부착성','내충격성','경도','내수성','내습성'],
  '투톤도막':       ['도막두께','부착성','내수성','내습성','내치핑성'],
  '전착도막':       ['내염수분무성'],
  '중도 단독':      ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '중도 삭제':      ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '중도단독':       ['도막두께','부착성','내충격성','경도','내수성','내습성'],
  '치핑프라이머':   ['도막두께','부착성','내충격성','내수성','내습성','내치핑성 (45도)','내치핑성 (90도)'],
};

// ══════════════════════════════════════════════════════
// 앱 상태
// ══════════════════════════════════════════════════════
let CY = '2024';
const CONTRACT = {'2024':127436500, '2025':0, '2023':0};

// 의뢰 DB: {year: [order]}
// order = {id, cha, purpose, mgr, date, maker, colors[], cnt, sections[], specimens[], status, receiptDate}
// specimens = [{maker, color, sections: [{name, items:[{name,price,checked}]}]}]
const DB = {orders:{}};

// ── 휠도장 별도 DB / 계약금액
const DB_WHEEL = {orders:{}};
const CONTRACT_WHEEL = {'2025':0, '2026':0, '2024':0};

// ── DGU(접착제) 별도 DB / 계약금액
const DB_DGU = {orders:{}};
const CONTRACT_DGU = {'2025':0, '2026':0, '2024':0};


// 샘플 데이터
DB.orders['2024'] = [
  buildOrder({id:'o24_1', cha:'1차', purpose:'HAOS 투톤 및 중도 변경 관련 물성평가', mgr:'김환오', date:'2024-06-25',
    maker:'KCC', colors:['A7G'], sections:['완성도막'], cnt:9, status:'done'}),
  buildOrder({id:'o24_13', cha:'13차', purpose:'HMI2 잔여칼라 1KP 적합성 평가', mgr:'전재철', date:'2024-08-27',
    maker:'KCC,NAC', colors:['ACW','ACX','ACY','OVR'], sections:['완성도막','OVER BAKE','UNDER BAKE','재도장','층간부착','O/B층간부착','내판도막'], cnt:92, status:'done'}),
  buildOrder({id:'o24_57', cha:'57차', purpose:'KCC NRB 외 11종 물성평가', mgr:'전재철', date:'2024-12-09',
    maker:'KCC,NAC', colors:['NRB','HT7','SMZ','VET'], sections:['완성도막','OVER BAKE','UNDER BAKE'], cnt:12, status:'ip'}),
  buildOrder({id:'o24_58', cha:'58차', purpose:'울산 신공장 적합성 도막 물성평가', mgr:'김환오', date:'2024-12-19',
    maker:'KCC', colors:['SMZ'], sections:['완성도막'], cnt:6, status:'wait'}),
];
DB.orders['2025'] = [];
DB.orders['2023'] = [];

let selectedOrderId = 'o24_57';
let addItemTarget = {orderId:null, spIdx:null, secIdx:null};

// ══════════════════════════════════════════════════════
// order 생성 헬퍼
function calcSpCost(sp){
  return sp.sections.reduce((s,sec)=>s+sec.items.filter(it=>it.checked).reduce((a,it)=>a+it.price,0),0);
}
function calcOrderCost(order){
  return order.specimens.reduce((s,sp)=>s+calcSpCost(sp),0);
}

// 비용 요약 (시험항목 탭 하단에 노출)
function buildCostSummaryHtml(order){
  const total = calcOrderCost(order);
  // 시편별 소계
  const spRows = order.specimens.map(sp=>{
    const cost = calcSpCost(sp);
    const allDone = sp.sections.length>0 && sp.sections.every(s=>s.receiptOk);
    return `<div style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-family:var(--mono);font-weight:700;color:var(--b);width:40px;flex-shrink:0">${sp.maker}</span>
      <span style="font-family:var(--mono);color:var(--tx);width:45px;flex-shrink:0">${sp.color}</span>
      ${allDone ? `<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.3);border-radius:4px;padding:1px 6px;font-size:10px;color:var(--g);flex-shrink:0">검수완료</span>` : ''}
      <span style="flex:1;color:var(--tx3);font-size:11px">${sp.sections.map(s=>s.name).join(' · ')}${(()=>{const tkItem=sp.sections.flatMap(s=>s.items).find(it=>normItemName(it.name,'')==='도막두께'&&it.price>0&&it.checked);return tkItem&&CUR_SYS==='wheel'?` <span style="color:var(--b);font-size:10px">(${tkItem.price/25000|0}pt)</span>`:''})()}</span>
      <span style="font-family:var(--mono);color:var(--o);font-weight:700">${cost.toLocaleString()}원</span>
    </div>`;
  }).join('');

  return `<div style="border-top:2px solid var(--border);padding-top:12px">
    <div style="font-size:11px;font-weight:700;color:var(--tx3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">비용 요약</div>
    ${spRows}
    <div style="display:flex;justify-content:flex-end;align-items:center;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
      <span style="font-size:12px;color:var(--tx2)">차수 합계</span>
      <span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--o)">${total.toLocaleString()}원</span>
    </div>
    <div style="margin-top:8px;text-align:right">
      <button class="btn sm" onclick="exportCostCsv('${order.id}')">CSV</button>
    </div>
  </div>`;
}

function updateYearCost(){
  // 시스템별 사용 비용 각각 계산
  const usedBody  = (DB.orders[CY]||[]).reduce((s,o)=>s+calcOrderCost(o),0);
  const usedWheel = (DB_WHEEL.orders[CY]||[]).reduce((s,o)=>s+calcOrderCost(o),0);
  const usedDgu   = (DB_DGU.orders[CY]||[]).reduce((s,o)=>s+calcOrderCost(o),0);
  const usedTotal = usedBody + usedWheel + usedDgu;

  const contract = CONTRACT[CY]||0;
  const remain = contract - usedTotal;
  const pct = contract ? Math.min(100, Math.round(usedTotal/contract*100)) : 0;

  const fmt = v => v.toLocaleString()+'원';

  // 시스템별 세부
  const elBody  = document.getElementById('used-body');
  const elWheel = document.getElementById('used-wheel');
  const elDgu   = document.getElementById('used-dgu');
  if(elBody)  elBody.textContent  = fmt(usedBody);
  if(elWheel) elWheel.textContent = fmt(usedWheel);
  if(elDgu)   elDgu.textContent   = fmt(usedDgu);

  // 합계
  const usedEl    = document.getElementById('used-cost');
  const remainEl  = document.getElementById('remain-cost');
  const barEl     = document.getElementById('cost-bar');
  const pctEl     = document.getElementById('cost-pct');
  const contractEl= document.getElementById('contract-total');

  if(usedEl) usedEl.textContent = fmt(usedTotal);
  if(contract>0){
    if(remainEl){ remainEl.textContent=fmt(remain); remainEl.style.color=remain<0?'var(--r)':'var(--g)'; }
    if(barEl) barEl.style.width=pct+'%';
    if(pctEl) pctEl.textContent=pct+'%';
    if(contractEl) contractEl.textContent=fmt(contract);
  } else {
    if(remainEl){ remainEl.textContent='계약금액 미설정'; remainEl.style.color='var(--tx3)'; }
    if(barEl) barEl.style.width='0%';
    if(pctEl) pctEl.textContent='—';
    if(contractEl) contractEl.textContent='미설정';
  }
}

// ══════════════════════════════════════════════════════
// 신규 차수 등록 (메일 파싱 우선)
// ══════════════════════════════════════════════════════
const STORAGE_KEY = 'fiti_hmc_data_v1';

// 조용한 자동저장 (버튼 피드백 없음)
function autoSave(){
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      orders: DB.orders,
      contract: CONTRACT,
      ordersWheel: DB_WHEEL.orders,
      contractWheel: CONTRACT_WHEEL,
      savedAt: new Date().toISOString()
    }));
  } catch(e) { console.warn('autoSave 실패:', e); }
}

function saveAll(){
  try {
    const payload = {
      orders: DB.orders,
      contract: CONTRACT,
      ordersWheel: DB_WHEEL.orders,
      contractWheel: CONTRACT_WHEEL,
      ordersDgu: DB_DGU.orders,
      contractDgu: CONTRACT_DGU,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    const btn = document.querySelector('.topbar-right .btn.primary');
    if(btn){
      const orig = btn.innerHTML;
      btn.innerHTML = '저장됨';
      btn.style.background = 'var(--g2)';
      setTimeout(()=>{ btn.innerHTML=orig; btn.style.background=''; }, 1500);
    }
  } catch(e) {
    alert('저장 실패: ' + e.message);
  }
}

function loadSaved(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return false;
    const payload = JSON.parse(raw);
    if(payload.orders) Object.assign(DB.orders, payload.orders);
    if(payload.contract) Object.assign(CONTRACT, payload.contract);
    if(payload.ordersWheel) Object.assign(DB_WHEEL.orders, payload.ordersWheel);
    if(payload.contractWheel) Object.assign(CONTRACT_WHEEL, payload.contractWheel);
    if(payload.ordersDgu) Object.assign(DB_DGU.orders, payload.ordersDgu);
    if(payload.contractDgu) Object.assign(CONTRACT_DGU, payload.contractDgu);

    // 저장된 연도를 year-sel <select>에 복원
    const sel = document.getElementById('year-sel');
    if(sel && payload.orders){
      const existingOpts = [...sel.options].map(o=>o.value);
      Object.keys(payload.orders).sort().reverse().forEach(yr=>{
        if(!existingOpts.includes(yr)){
          const opt = document.createElement('option');
          opt.value = yr; opt.textContent = yr+'년';
          sel.insertBefore(opt, sel.firstChild);
        }
      });
      if(payload.contract){
        Object.keys(payload.contract).forEach(yr=>{
          if(![...sel.options].find(o=>o.value===yr)){
            const opt = document.createElement('option');
            opt.value = yr; opt.textContent = yr+'년';
            sel.insertBefore(opt, sel.firstChild);
          }
        });
      }
    }
    return true;
  } catch(e) {
    console.warn('저장 데이터 복원 실패:', e);
    return false;
  }
}

// ══════════════════════════════════════════════════════
// 유틸
// ══════════════════════════════════════════════════════
function reRenderDetail(orderId){
  renderOrderDetail(orderId);
  renderOrderList();
  updateYearCost();
  // 탭 위치 복원
  restoreTabState(orderId);
}
function openModal(id){
  document.getElementById(id).classList.add('open');
  if(id==='settings-modal') settingsOnOpen();
}
function closeModal(id){document.getElementById(id).classList.remove('open');}

// ══════════════════════════════════════════════════════
// 시스템 전환 (차체도장 ↔ 휠도장)
// ══════════════════════════════════════════════════════
function switchSystem(sys){
  CUR_SYS = sys;
  const isWheel = sys === 'wheel';
  const isDgu   = sys === 'dgu';

  // 데스크톱 탭 스타일 헬퍼
  const tabStyle = (active) =>
    `flex:1;padding:4px 6px;font-size:10px;font-weight:700;border-radius:4px;cursor:pointer;font-family:var(--sans);border:1px solid ${active?'var(--b)':'var(--border2)'};background:${active?'var(--bbg)':'var(--bg3)'};color:${active?'var(--b)':'var(--tx3)'}`;
  document.getElementById('sys-tab-body').style.cssText  = tabStyle(!isWheel&&!isDgu);
  document.getElementById('sys-tab-wheel').style.cssText = tabStyle(isWheel);
  const dguBtn = document.getElementById('sys-tab-dgu');
  if(dguBtn) dguBtn.style.cssText = tabStyle(isDgu);

  // 모바일 탭 스타일
  const mStyle = (active) =>
    `padding:2px 5px;font-size:8px;font-weight:700;border-radius:3px;cursor:pointer;font-family:var(--sans);border:1px solid ${active?'var(--b)':'var(--border2)'};background:${active?'var(--bbg)':'var(--bg3)'};color:${active?'var(--b)':'var(--tx3)'};width:38px`;
  const mbBody  = document.getElementById('sys-tab-body-m');
  const mbWheel = document.getElementById('sys-tab-wheel-m');
  const mbDgu   = document.getElementById('sys-tab-dgu-m');
  if(mbBody)  mbBody.style.cssText  = mStyle(!isWheel&&!isDgu);
  if(mbWheel) mbWheel.style.cssText = mStyle(isWheel);
  if(mbDgu)   mbDgu.style.cssText   = mStyle(isDgu);

  // 로고 텍스트
  document.getElementById('sys-title').textContent = isWheel ? '도장 평가 시스템' : '도장 평가 시스템';
  document.getElementById('sys-sub').textContent = isWheel ? '휠도장 용역 관리' : isDgu ? 'DGU 접착제 평가 관리' : '차체도장 용역 관리';

  // 연도 selector 재초기화
  const yearSel = document.getElementById('year-sel');
  if(yearSel){
    const dbRef = isWheel ? DB_WHEEL : isDgu ? DB_DGU : DB;
    const contractRef = isWheel ? CONTRACT_WHEEL : isDgu ? CONTRACT_DGU : CONTRACT;
    yearSel.innerHTML = '';
    const years = [...new Set([...Object.keys(dbRef.orders), ...Object.keys(contractRef)])].sort().reverse();
    if(!years.length) years.push('2025','2026');
    years.forEach(yr=>{
      const opt = document.createElement('option');
      opt.value = yr; opt.textContent = yr+'년';
      if(yr === CY) opt.selected = true;
      yearSel.appendChild(opt);
    });
  }

  syncNavBySystem();
  // 현재 페이지 새로고침
  const activePage = document.querySelector('.page.active');
  if(activePage){
    const pageId = activePage.id.replace('page-','');
    if(pageId==='orders') wlOrdersInit();
    else if(pageId==='dashboard') dbInit();
    else if(pageId==='thickness') (isWheel||isDgu) ? wlThicknessInit() : tkInit();
    else if(pageId==='results')   (isWheel||isDgu) ? wlResultsInit()   : rsInit();
    else if(pageId==='notifications') ngInit();
    else if(pageId==='report')    (isWheel||isDgu) ? wlReportInit()    : rpInit();
  }
}

// ── 현재 시스템의 DB/CONTRACT 참조 헬퍼
function activeDB(){ return CUR_SYS==='wheel' ? DB_WHEEL : CUR_SYS==='dgu' ? DB_DGU : DB; }
function activeCONTRACT(){ return CONTRACT; }  // 차체/휠/DGU 모두 동일 계약총액 공유
function activePRICE_MAP(){ return CUR_SYS==='wheel' ? PRICE_MAP_WHEEL : PRICE_MAP; }
function activeDEFAULT_ITEMS(){
  if(CUR_SYS==='wheel') return DEFAULT_ITEMS_WHEEL;
  if(CUR_SYS==='dgu')   return DEFAULT_ITEMS_DGU;
  return DEFAULT_ITEMS;
}

// ── 합산 비용 (대시보드용: 차체+휠 모두 합산)
function calcTotalUsed(yr){
  const bodyOrders = (DB.orders[yr]||[]);
  const wheelOrders = (DB_WHEEL.orders[yr]||[]);
  const dguOrders = (DB_DGU.orders[yr]||[]);
  const bodyUsed = bodyOrders.reduce((s,o)=>s+calcOrderCostForSys(o,'body'),0);
  const wheelUsed = wheelOrders.reduce((s,o)=>s+calcOrderCostForSys(o,'wheel'),0);
  const dguUsed = dguOrders.reduce((s,o)=>s+calcOrderCostForSys(o,'dgu'),0);
  return {bodyUsed, wheelUsed, dguUsed, total: bodyUsed+wheelUsed+dguUsed};
}
function calcOrderCostForSys(order, sys){
  return order.specimens.reduce((s,sp)=>
    s+sp.sections.reduce((ss,sec)=>
      ss+sec.items.filter(it=>it.checked).reduce((a,it)=>a+it.price,0),0),0);
}

// ══════════════════════════════════════════════════════
// 휠도장 의뢰 관리
// ══════════════════════════════════════════════════════

// 휠도장용 buildOrder (차체도장 buildOrder와 분리)
function buildOrderWheel(o){
  const sections = (o.sections||['완성도막']).map(sname=>({
    name: sname,
    items: (DEFAULT_ITEMS_WHEEL[sname]||DEFAULT_ITEMS_WHEEL['완성도막']).map(iname=>({
      name: iname,
      price: PRICE_MAP_WHEEL[iname]||0,
      checked: true
    })),
    receiptOk: false, receiptDate:'', receiptEa:'', receiptNote:''
  }));
  const specimenList = (o.colors||[]).map(color=>({
    maker: o.maker||'', color,
    sections: JSON.parse(JSON.stringify(sections))
  }));
  return {
    id: o.id||('w_'+Date.now()),
    cha: o.cha||'',
    purpose: o.purpose||'',
    mgr: o.mgr||'',
    date: o.date||'',
    maker: o.maker||'',
    colors: o.colors||[],
    cnt: o.cnt||1,
    status: o.status||'wait',
    specimens: specimenList,
    tkData: {},
    rsData: {},
    ngRead: {},
    noteRead: {},
    sendLog: []
  };
}

// 휠도장 의뢰관리 init — 차체도장과 공유하되 activeDB() 참조
function wlOrdersInit(){
  // 기존 의뢰관리 탭 함수들이 activeDB()를 쓰도록 이미 되어있음
  // 연도 selector 동기화 후 renderOrderList 호출
  const sel = document.getElementById('year-sel');
  const db = activeDB();
  CY = sel?.value || Object.keys(db.orders).sort().reverse()[0] || '2025';
  renderOrderList();
  renderOrderDetail(null);
  updateYearCost();
}

// 휠도장 중간결과 탭 (현재는 placholder — 차체와 동일 UI 재활용 예정)
function wlThicknessInit(){
  tkInit(); // 동일 UI, activeDB() 참조로 자동 분리
}

// 휠도장 시험결과 탭
function wlResultsInit(){
  rsInit();
}

// 휠도장 보고서 탭
function wlReportInit(){
  rpInit();
}

function editContractAmount(){
  const current = activeCONTRACT()[CY] || 0;
  // 인라인 입력 필드로 교체
  const el = document.getElementById('contract-total');
  if(!el) return;
  const input = document.createElement('input');
  input.type = 'number';
  input.value = current;
  input.style.cssText = 'width:120px;padding:2px 6px;font-size:13px;font-family:var(--mono);font-weight:700;background:var(--bg3);border:1px solid var(--b);border-radius:4px;color:var(--tx);outline:none;text-align:right';
  el.replaceWith(input);
  input.focus();
  input.select();

  const commit = ()=>{
    const val = parseInt(input.value) || 0;
    activeCONTRACT()[CY] = val;
    // 저장
    autoSave();
    updateYearCost();
    showToast(`${CY}년 계약 총액이 ${val.toLocaleString()}원으로 설정됐습니다.`, 'b', 2500);
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', e=>{ if(e.key==='Enter') input.blur(); if(e.key==='Escape'){ activeCONTRACT()[CY]=current; updateYearCost(); }});
}

// ── 토스트 알림
function showToast(msg, type='g', duration=3000){
  const colors = {
    g: {bg:'var(--gbg)', border:'rgba(45,164,78,.4)', text:'var(--g)'},
    b: {bg:'var(--bbg)', border:'rgba(56,139,253,.4)', text:'var(--b)'},
    o: {bg:'var(--obg)', border:'rgba(210,153,34,.4)', text:'var(--o)'},
    r: {bg:'var(--rbg)', border:'rgba(248,81,73,.4)',  text:'var(--r)'},
  };
  const c = colors[type]||colors.g;
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:24px;right:24px;max-width:360px;
    background:${c.bg};border:1px solid ${c.border};border-radius:8px;
    padding:12px 16px;font-size:13px;color:${c.text};z-index:9999;
    box-shadow:0 4px 16px rgba(0,0,0,.12);animation:sup .25s ease;
    display:flex;align-items:flex-start;gap:10px;line-height:1.5`;
  el.innerHTML = `<span style="flex:1">${msg}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:${c.text};cursor:pointer;font-size:16px;line-height:1;flex-shrink:0">×</button>`;
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, duration);
}

// ══════════════════════════════════════════════════════
// 초기화
// ══════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded',()=>{
  syncNavBySystem();
  const hasSaved = loadSaved();
  // 저장된 데이터가 있으면 복원, 없으면 샘플 데이터 유지
  const defaultYear = Object.keys(activeDB().orders).find(y=>activeDB().orders[y]?.length) || '2024';
  changeYear(defaultYear);
  const firstOrder = activeDB().orders[defaultYear]?.[0];
  if(firstOrder) selectOrder(firstOrder.id);
  if(hasSaved){
    const banner = document.createElement('div');
    banner.style.cssText='position:fixed;top:10px;left:50%;transform:translateX(-50%);background:var(--gbg);border:1px solid rgba(45,164,78,.4);border-radius:6px;padding:8px 16px;font-size:12px;color:var(--g);z-index:999;pointer-events:none';
    banner.textContent='✓ 저장된 데이터를 불러왔습니다';
    document.body.appendChild(banner);
    setTimeout(()=>banner.remove(), 2500);
  }
  // NG 뱃지 초기화
  setTimeout(()=>ngSyncBadge(), 100);
});

// ══════════════════════════════════════════════════════
// 시스템 전환 시 중간결과 탭 show/hide
// ══════════════════════════════════════════════════════
function syncNavBySystem(){
  const isBody = CUR_SYS === 'body';
  document.querySelectorAll('[data-nav="thickness"]').forEach(el=>{
    el.style.display = isBody ? '' : 'none';
  });
}
