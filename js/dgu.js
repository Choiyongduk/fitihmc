// ======================================================
// // dgu.js — DGU 전용: 의뢰관리·파싱·결과·보고서
// 의존: common.js, body.js
// ======================================================

// ══ DGU 전용 STEP2 함수들 ══

function noDguBackToStep1(){
  document.getElementById('no-step1').style.display='block';
  document.getElementById('no-step2-dgu').style.display='none';
}

// 피착제 계층을 편집 가능한 행들로 렌더
function noDguRenderSubstrates(catData){
  const wrap = document.getElementById('no-dgu-substrate-wrap');
  if(!wrap) return;
  const rows = [];
  Object.entries(catData).forEach(([cat, subs])=>{
    Object.entries(subs).forEach(([sub, codes])=>{
      const key = `${cat}__${sub}`;
      const codesStr = codes.join(', ');
      rows.push({cat, sub, codes: codesStr});
    });
  });
  wrap.innerHTML = rows.map((r,i)=>`
    <div data-dgu-row="${i}" style="display:grid;grid-template-columns:70px 1fr 1fr 28px;gap:4px;align-items:center;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px">
      <select onchange="this.closest('[data-dgu-row]').dataset.cat=this.value" style="font-size:11px;padding:3px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none">
        ${['GLASS','선루프','도장'].map(c=>`<option value="${c}" ${c===r.cat?'selected':''}>${c}</option>`).join('')}
      </select>
      <input value="${r.sub}" placeholder="업체명" data-field="sub"
        style="font-size:11px;padding:3px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none;width:100%">
      <input value="${r.codes}" placeholder="제품코드 (쉼표 구분)" data-field="codes"
        style="font-size:11px;padding:3px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none;width:100%;font-family:var(--mono)">
      <button onclick="this.closest('[data-dgu-row]').remove()"
        style="width:24px;height:24px;border:none;background:none;color:var(--tx3);cursor:pointer;border-radius:4px;font-size:15px;display:flex;align-items:center;justify-content:center"
        onmouseover="this.style.background='var(--rbg)';this.style.color='var(--r)'"
        onmouseout="this.style.background='none';this.style.color='var(--tx3)'">×</button>
    </div>`).join('');
}

function noDguAddSubstrate(){
  const wrap = document.getElementById('no-dgu-substrate-wrap');
  const idx = wrap.children.length;
  const div = document.createElement('div');
  div.dataset.dguRow = idx;
  div.style.cssText = 'display:grid;grid-template-columns:70px 1fr 1fr 28px;gap:4px;align-items:center;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:5px';
  div.innerHTML = `
    <select style="font-size:11px;padding:3px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none">
      <option value="GLASS">GLASS</option><option value="선루프">선루프</option><option value="도장">도장</option>
    </select>
    <input placeholder="업체명" data-field="sub" style="font-size:11px;padding:3px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none;width:100%">
    <input placeholder="제품코드 (쉼표 구분)" data-field="codes" style="font-size:11px;padding:3px 6px;background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none;width:100%;font-family:var(--mono)">
    <button onclick="this.closest('[data-dgu-row]').remove()" style="width:24px;height:24px;border:none;background:none;color:var(--tx3);cursor:pointer;border-radius:4px;font-size:15px;display:flex;align-items:center;justify-content:center"
      onmouseover="this.style.background='var(--rbg)';this.style.color='var(--r)'" onmouseout="this.style.background='none';this.style.color='var(--tx3)'">×</button>`;
  wrap.appendChild(div);
}

// DGU 차수 등록
// ══════════════════════════════════════════════════════
// DGU 차수 등록 (독립형 — registerOrder 호출 안 함)
// ══════════════════════════════════════════════════════
function registerOrderDgu(){
  const cha = document.getElementById('no-cha-dgu')?.value.trim()
           || document.getElementById('no-cha')?.value.trim();
  if(!cha){ alert('차수를 입력하세요'); return; }
  const yr  = document.getElementById('no-year-dgu')?.value
           || document.getElementById('no-year')?.value;
  const db  = DB_DGU;
  if(!db.orders[yr]) db.orders[yr] = [];

  const makerStr = document.getElementById('no-maker-dgu')?.value.trim()
               || document.getElementById('no-maker')?.value.trim() || '미지정';
  const makers = makerStr.split(/[,，]+/).map(s=>s.trim()).filter(Boolean);

  // 피착제 계층 구성
  const hierarchy = {};
  makers.forEach(mk=>{ hierarchy[mk] = {}; });
  const mainMaker = makers[0];
  document.querySelectorAll('#no-dgu-substrate-wrap [data-dgu-row]').forEach(row=>{
    const cat   = row.querySelector('select')?.value || 'GLASS';
    const sub   = row.querySelector('[data-field="sub"]')?.value?.trim() || '';
    const codes = row.querySelector('[data-field="codes"]')?.value
                  ? row.querySelector('[data-field="codes"]').value.split(/[,，]+/).map(s=>s.trim()).filter(Boolean)
                  : [];
    if(!sub) return;
    if(!hierarchy[mainMaker][cat]) hierarchy[mainMaker][cat] = {};
    hierarchy[mainMaker][cat][sub] = codes;
  });

  // 선택된 시험항목
  const secs = [];
  if(document.getElementById('dgu-test-knifecut')?.checked) secs.push('KNIFE CUT');
  if(document.getElementById('dgu-test-shear')?.checked)    secs.push('전단강도');
  if(document.getElementById('dgu-test-hardness')?.checked) secs.push('경도');
  if(document.getElementById('dgu-test-sealer')?.checked)   secs.push('실러물성');
  if(!secs.length) secs.push('KNIFE CUT');

  // 피착제 색상 목록 생성
  const colorsByMaker = {};
  makers.forEach(mk=>{
    colorsByMaker[mk] = [];
    Object.entries(hierarchy[mk]||{}).forEach(([cat,subs])=>{
      Object.entries(subs).forEach(([sub,codes])=>{
        if(codes.length) codes.forEach(c=>colorsByMaker[mk].push(`${cat}_${sub}_${c}`));
        else colorsByMaker[mk].push(`${cat}_${sub}`);
      });
    });
    if(!colorsByMaker[mk].length) colorsByMaker[mk] = ['미지정'];
  });
  const allColors = [...new Set(Object.values(colorsByMaker).flat())];

  // DGU specimens 생성
  // 구조: 공통비용 행 + 실러물성 행 + 피착제별 행
  const makerCount = makers.length;
  const specimens  = [];

  // ① 공통비용 (노화조건 + 시료제작비 — 차수당 1회)
  const hasAgingTest = secs.some(s=>['KNIFE CUT','전단강도','경도'].includes(s));
  const fixedItems = [];
  if(hasAgingTest){
    ['내열','내수','내약품','내열CYCLE'].forEach(n=>{
      fixedItems.push({name:n, price:PRICE_MAP_DGU[n]||0, checked:true});
    });
  }
  fixedItems.push({name:'시료제작비', price:PRICE_MAP_DGU['시료제작비']||0, checked:true});
  specimens.push({
    maker:'[공통]', color:'노화조건·시료제작비',
    sections:[{name:'공통비용', receiptEa:1, receiptOk:false, receiptDate:'', receiptNote:'', items:fixedItems}],
    receiptDate:'', receiptCnt:'', receiptOk:false
  });

  // ② 실러물성 (실러업체 수 × 단가)
  if(secs.includes('실러물성')){
    specimens.push({
      maker:'[실러업체]', color:`${makerCount}개사`,
      sections:[{name:'실러물성', receiptEa:1, receiptOk:false, receiptDate:'', receiptNote:'',
        items:['인장강도','신율','인열강도'].map(n=>({name:n, price:(PRICE_MAP_DGU[n]||0)*makerCount, checked:true}))
      }],
      receiptDate:'', receiptCnt:'', receiptOk:false
    });
  }

  // ③ 피착제별 (KNIFE CUT / 전단강도 / 경도)
  const perComboSecs = secs.filter(s=>['KNIFE CUT','전단강도','경도'].includes(s));
  makers.forEach(maker=>{
    (colorsByMaker[maker]||['미지정']).forEach(color=>{
      const sections = perComboSecs.map(sec=>({
        name: sec,
        receiptEa: 1, receiptOk:false, receiptDate:'', receiptNote:'',
        items: (DEFAULT_ITEMS_DGU[sec]||[])
               .filter(n=>!['내열','내수','내약품','내열CYCLE'].includes(n))
               .map(n=>({name:n, price:PRICE_MAP_DGU[n]||0, checked:true}))
      }));
      if(sections.length){
        specimens.push({maker, color, sections, receiptDate:'', receiptCnt:'', receiptOk:false});
      }
    });
  });

  const purpose = document.getElementById('no-purpose-dgu')?.value
               || document.getElementById('no-purpose')?.value || '';
  const mgr     = document.getElementById('no-mgr-dgu')?.value
               || document.getElementById('no-mgr')?.value || '';
  const date    = document.getElementById('no-date-dgu')?.value
               || document.getElementById('no-date')?.value || new Date().toISOString().slice(0,10);
  const cnt     = parseInt(document.getElementById('no-cnt-dgu')?.value
               || document.getElementById('no-cnt')?.value) || 0;

  const order = {
    id: 'd_'+Date.now(),
    cha, purpose, mgr, date,
    maker: makerStr, colors: allColors, cnt,
    status: 'wait', specimens,
    dguHierarchy: hierarchy,
  };
  db.orders[yr].push(order);
  closeModal('new-order-modal');
  autoSave();
  if(yr !== CY){ document.getElementById('year-sel').value=yr; changeYear(yr); }
  else { selectedOrderId=order.id; renderOrderList(); renderOrderDetail(order.id); updateYearCost(); }
}


function noRunParseDgu(){
  const text = document.getElementById('no-mail-text').value.trim();
  if(!text){alert('메일 텍스트를 붙여넣어 주세요');return;}

  const d = {
    makers:[], colorsByMaker:{}, sectionItems:{}, sectionEA:{},
    purpose:'', mgr:'', mailDate:'', totalEa:0, _isDgu:true,
    dguHierarchy:{},
  };

  const lines = text.split(/\r?\n/).map(l => l.trim());

  // ── 평가목적: 표 구조("평가목적\n내용\n실제목적") + 인라인 형태
  for(let i=0; i<lines.length; i++){
    if(/^평가목적$/.test(lines[i])){
      if(i+2 < lines.length && /^내용$/.test(lines[i+1]) && lines[i+2].length >= 5){
        d.purpose = lines[i+2].replace(/^[-•·]\s*/,'').trim(); break;
      }
      if(i+1 < lines.length && lines[i+1].length >= 5 && !/^내용$/.test(lines[i+1])){
        d.purpose = lines[i+1].replace(/^[-•·]\s*/,'').trim(); break;
      }
    }
    const inlineM = lines[i].match(/^평가목적\s*[：:]\s*(.{5,100})$/);
    if(inlineM){ d.purpose = inlineM[1].trim(); break; }
  }

  // ── 날짜
  const sendM = text.match(/시편발송일정[^\d]*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const anyDate = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  const dm = sendM || anyDate;
  if(dm) d.mailDate = `${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}`;

  // ── 담당자
  const STAFF = ['김환오','채종운','전재철','양지원','이재진'];
  for(const n of STAFF){ if(text.includes(n)){d.mgr=n;break;} }

  // ── 실러 업체: "총 N 개사 (SIKA)" 패턴
  const DGU_MAKERS = ['SIKA','Sika','다우','DOW','헨켈','Henkel','3M','PPG','애경','한화'];
  const makerSet = new Set();
  (text.match(/총\s*\d+\s*개사\s*[\(（]([^)）\r\n]+)[\)）]/g)||[]).forEach(m=>{
    const inner = m.replace(/총\s*\d+\s*개사\s*[\(（]/,'').replace(/[\)）]$/,'').trim();
    inner.split(/[,，\s]+/).map(s=>s.trim()).filter(s=>s.length>=2).forEach(mk=>makerSet.add(mk));
  });
  if(!makerSet.size) DGU_MAKERS.forEach(mk=>{ if(text.includes(mk)) makerSet.add(mk); });
  if(!makerSet.size) makerSet.add('미지정');
  const makerList = [...makerSet];
  const maker = makerList[0];

  // ── 피착제 계층 파싱
  const SUBSTRATE_MAKERS = ['FUYAO','KCC','KCC 글라스','KCC글라스','현대첨단소재','현대 첨단소재','BASF','GS칼텍스','GS 칼텍스','KNK','NAC','세하','피티지','마그나'];
  const SUBSTRATE_RE = new RegExp('^(' + SUBSTRATE_MAKERS.map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')(\\s|$)');
  const PRODUCT_CODE_RE = /^(GFRP|CFRP|[A-Z]{2,}\d|[0-9])/i;

  const hierarchy = {};
  makerList.forEach(mk=>{ hierarchy[mk]={}; });

  let inBlock = false, curCat = null, curSub = null;

  for(let i=0; i<lines.length; i++){
    const line = lines[i];
    if(!line) continue;
    if(/시편\s*송부\s*현황/.test(line)){inBlock=true; continue;}
    if(/부자재\s*송부|평가\s*항목|요구\s*사항/.test(line)){inBlock=false; continue;}
    if(!inBlock) continue;

    const catM = line.match(/^(GLASS|선루프|도장)\s*$/i);
    if(catM){ curCat=catM[1]; curSub=null; if(!hierarchy[maker][curCat]) hierarchy[maker][curCat]={}; continue; }

    if(/^\(총\s*\d+/.test(line) || /^총\s*\d+\s*EA\s*$/i.test(line)) continue;
    if(!curCat) continue;

    // "업체 - 코드" 형태 (FUYAO - TDF9324)
    const dashM = line.match(/^([A-Za-z가-힣][A-Za-z가-힣\s]{0,15}?)\s*[-–]\s*([A-Z0-9].+)$/i);
    if(dashM && SUBSTRATE_RE.test(dashM[1].trim())){
      curSub = dashM[1].trim();
      if(!hierarchy[maker][curCat][curSub]) hierarchy[maker][curCat][curSub]=[];
      const code = dashM[2].trim().replace(/[\(（][^)）]*[\)）]/g,'').trim();
      if(code.length>=2) hierarchy[maker][curCat][curSub].push(code);
      continue;
    }

    // 알려진 피착제 업체명 (GFRP/CFRP 같은 제품코드는 제외)
    if(SUBSTRATE_RE.test(line) && !PRODUCT_CODE_RE.test(line)){
      curSub = line.trim();
      if(!hierarchy[maker][curCat][curSub]) hierarchy[maker][curCat][curSub]=[];
      continue;
    }

    // 제품코드 등록
    const isCode = !/EA/i.test(line) && line.length>=2 && !/^\(/.test(line);
    if(isCode){
      const cleanCode = line.replace(/[\(（][^)）]*[\)）]/g,'').replace(/^[-–\s]+/,'').trim();
      if(cleanCode.length<2) continue;
      if(curSub){ hierarchy[maker][curCat][curSub].push(cleanCode); }
      else { if(!hierarchy[maker][curCat]['기타']) hierarchy[maker][curCat]['기타']=[]; hierarchy[maker][curCat]['기타'].push(cleanCode); }
    }
  }

  d.dguHierarchy = hierarchy;

  // ── colorsByMaker 평탄화
  const colorsByMaker = {};
  makerList.forEach(mk=>{
    colorsByMaker[mk]=[];
    Object.entries(hierarchy[mk]||{}).forEach(([cat,subs])=>{
      Object.entries(subs).forEach(([sub,codes])=>{
        if(codes.length) codes.forEach(c=>colorsByMaker[mk].push(`${cat}_${sub}_${c}`));
        else colorsByMaker[mk].push(`${cat}_${sub}`);
      });
    });
  });
  d.makers = makerList;
  d.colorsByMaker = colorsByMaker;

  // ── 시험항목
  const detectedSecs = new Set();
  if(/KNIFE\s*CUT|KNIFECUT/i.test(text)) detectedSecs.add('KNIFE CUT');
  if(/전단강도/i.test(text)) detectedSecs.add('전단강도');
  if(/경도/i.test(text)) detectedSecs.add('경도');
  if(/실러물성|인장강도|신율|인열강도/i.test(text)) detectedSecs.add('실러물성');
  if(!detectedSecs.size) Object.keys(DEFAULT_ITEMS_DGU).forEach(s=>detectedSecs.add(s));
  detectedSecs.forEach(sec=>{
    d.sectionItems[sec]=[...(DEFAULT_ITEMS_DGU[sec]||DEFAULT_ITEMS_DGU['KNIFE CUT'])];
    d.sectionEA[sec]=1;
  });

  const hardM = text.match(/경도\s*[：:]\s*(\d+)[~～](\d+)/);
  if(hardM) d.dguHardnessRange={min:parseInt(hardM[1]),max:parseInt(hardM[2])};

  noParsedData = d;

  const realMakers=makerList.filter(m=>m!=='미지정');
  // ── 파싱 요약
  const mkTag=v=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
  const codeTag=v=>`<span style="background:var(--bg4);border:1px solid var(--border);border-radius:3px;padding:1px 5px;font-size:10px;font-family:var(--mono);color:var(--tx2);margin-right:2px;display:inline-block">${v}</span>`;
  const itTag=v=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.25);border-radius:3px;padding:1px 6px;font-size:11px;margin-right:2px;display:inline-block">${v}</span>`;
  const row=(k,v,pl)=>`<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:3px;padding-left:${pl||0}px"><span style="color:var(--tx3);flex-shrink:0;font-size:11px;min-width:80px">${k}</span><span style="flex:1">${v}</span></div>`;

  let rows='';
  rows+=row('실러 업체',realMakers.length?realMakers.map(mkTag).join(''):`<span style="color:var(--o)">미감지</span>`);
  const catData=hierarchy[maker]||{};
  Object.entries(catData).forEach(([cat,subs])=>{
    rows+=row(`└ ${cat}`,`<span style="font-size:10px;color:var(--tx3)">${Object.keys(subs).length}개사 / ${Object.values(subs).flat().length}종</span>`,4);
    Object.entries(subs).forEach(([sub,codes])=>{
      rows+=row(`  └ ${sub}`,codes.map(codeTag).join('')||`<span style="color:var(--tx3);font-size:10px">—</span>`,8);
    });
  });
  rows+=row('시험항목',[...detectedSecs].map(itTag).join(''));
  if(d.dguHardnessRange) rows+=row('경도 기준',`<span style="font-size:11px;color:var(--b)">${d.dguHardnessRange.min}~${d.dguHardnessRange.max} Hs</span>`);

  const warnings=[];
  if(!d.purpose) warnings.push('평가목적 미감지 — 직접 입력해주세요.');
  if(d.makers.includes('미지정')) warnings.push('실러 업체 미감지 — 업체 필드를 직접 입력해주세요.');
  if(!allColors.length) warnings.push('피착제 코드 미감지 — 색상코드 필드를 직접 입력해주세요.');
  const warnHtml=warnings.map(w=>`<div style="margin-top:5px;padding:6px 10px;background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:4px;font-size:11px;color:var(--o)">${w}</div>`).join('');

  // DGU 전용 STEP2에 파싱 결과 표시
  document.getElementById('no-parse-summary-dgu').innerHTML=`
    <div style="font-size:11px;font-weight:700;color:var(--g);margin-bottom:8px">DGU 파싱 완료</div>
    <div style="font-size:12px">${rows}</div>${warnHtml}`;

  // 필드 채우기
  if(d.purpose) document.getElementById('no-purpose-dgu').value=d.purpose;
  if(d.mailDate) document.getElementById('no-date-dgu').value=d.mailDate;
  else document.getElementById('no-date-dgu').value=new Date().toISOString().slice(0,10);
  if(d.mgr){ const s=document.getElementById('no-mgr-dgu'); [...s.options].forEach(o=>o.selected=o.value===d.mgr); }
  document.getElementById('no-maker-dgu').value=realMakers.join(', ');
  document.getElementById('no-cnt-dgu').value='';

  // 시험항목 체크박스
  document.getElementById('dgu-test-knifecut').checked = [...detectedSecs].includes('KNIFE CUT');
  document.getElementById('dgu-test-hardness').checked  = [...detectedSecs].includes('경도');
  document.getElementById('dgu-test-sealer').checked    = [...detectedSecs].includes('실러물성');
  document.getElementById('dgu-test-shear').checked     = [...detectedSecs].includes('전단강도');

  // 피착제 계층 렌더
  noDguRenderSubstrates(hierarchy[maker]||{});

  document.getElementById('no-step1').style.display='none';
  document.getElementById('no-step2-dgu').style.display='block';
}

