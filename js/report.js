// ======================================================
// report.js — 보고서
// ======================================================

// ══════════════════════════════════════════════════════
let rpCurrentOrder = null;

function rpInit(){
  const sel = document.getElementById('rp-year-sel');
  if(!sel) return;
  sel.innerHTML = '';
  Object.keys(activeDB().orders).sort().reverse().forEach(yr=>{
    const opt=document.createElement('option');
    opt.value=yr; opt.textContent=yr+'년';
    if(yr===CY) opt.selected=true;
    sel.appendChild(opt);
  });
  rpChangeYear(CY);
  if(selectedOrderId){
    const oSel=document.getElementById('rp-order-sel');
    [...(oSel?.options||[])].forEach(o=>{ if(o.value===selectedOrderId) o.selected=true; });
    rpSelectOrder(selectedOrderId);
  }
}

function rpChangeYear(yr){
  const sel=document.getElementById('rp-order-sel');
  if(!sel) return;
  sel.innerHTML='<option value="">-- 차수 선택 --</option>';
  (activeDB().orders[yr]||[]).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.id;
    opt.textContent=`${o.cha} — ${(o.purpose||'').slice(0,20)}`;
    sel.appendChild(opt);
  });
  rpCurrentOrder=null;
  document.getElementById('rp-body').innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--tx3)"><div>차수를 선택하면 보고서가 생성됩니다</div></div>`;
}

function rpSelectOrder(orderId){
  if(!orderId){ rpCurrentOrder=null; return; }
  const yr=document.getElementById('rp-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(!order) return;
  rpCurrentOrder=order;
  rpRender(order);
}

function rpRender(order){
  const body=document.getElementById('rp-body');
  if(!body) return;

  const today=new Date().toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'});
  const makers=[...new Set(order.specimens.map(sp=>sp.maker))];
  const allColors=[...new Set(order.specimens.map(sp=>sp.color))];

  // ── 표지
  const coverHtml=`<div class="rp-page">
    <div style="text-align:center;margin-bottom:6mm">
      <div style="font-size:9pt;color:#555">FITI시험연구원 | Korea Testing Laboratory</div>
    </div>
    <div class="rp-title">평 가 결 과 보 고 서</div>
    <div class="rp-subtitle">TEST REPORT</div>
    <table class="rp-meta-table">
      <tr><td>접수일자</td><td>${order.date||today}</td></tr>
      <tr><td>발급일자</td><td>${today}</td></tr>
      <tr><td>의 뢰 자</td><td>현대자동차㈜ — ${order.mgr||''} 책임연구원</td></tr>
      <tr><td>보고서발행인</td><td>(재)FITI시험연구원</td></tr>
      <tr><td>평가목적</td><td>${order.purpose||''}</td></tr>
      <tr><td>평가업체</td><td>${makers.join(', ')}</td></tr>
      <tr><td>평가대상</td><td>${allColors.join(', ')}</td></tr>
      <tr><td>평가시편종류</td><td>${[...new Set(order.specimens.flatMap(sp=>sp.sections.map(s=>s.name)))].join(', ')}</td></tr>
      <tr><td>평가항목</td><td>${[...new Set(order.specimens.flatMap(sp=>sp.sections.flatMap(s=>s.items.filter(it=>it.checked).map(it=>it.name))))].join(', ')}</td></tr>
      <tr><td>평가결과</td><td>${rpSummaryResult(order)}</td></tr>
    </table>
    <div class="rp-footer">
      본 보고서는 FITI시험연구원이 발행한 공식 평가결과 보고서입니다.<br>
      (재)FITI시험연구원 | 경기도 안산시 단원구 광덕4로 67
    </div>
  </div>`;

  // ── 결과 본문: 업체별 → 색상 2개씩 묶어서 페이지 분리
  const resultPages = [];
  let pageNum = 2; // 표지가 1페이지

  // 전체 페이지 수 먼저 계산 (표지 + 업체별 2컬러씩 묶음)
  const totalPages = 1 + makers.reduce((sum, maker)=>{
    const cnt = order.specimens.filter(sp=>sp.maker===maker).length;
    return sum + Math.ceil(cnt/2);
  }, 0);

  makers.forEach(maker=>{
    const sps = order.specimens.filter(sp=>sp.maker===maker);
    const secNames = [...new Set(sps.flatMap(sp=>sp.sections.map(s=>s.name)))];

    // 2개씩 슬라이스
    for(let i=0; i<sps.length; i+=2){
      const chunk = sps.slice(i, i+2);
      const colors = chunk.map(sp=>sp.color);
      const colSpan = colors.length;

      // 테이블 빌드
      let tableHtml=`<table class="rp-result-table">
        <thead>
          <tr>
            <th rowspan="2" style="min-width:18mm;width:14%">구분</th>
            <th rowspan="2" style="min-width:18mm;width:14%">항목</th>
            <th rowspan="2" style="min-width:20mm;width:18%">시험방법</th>
            <th rowspan="2" style="min-width:20mm;width:18%">요구사항</th>
            <th colspan="${colSpan}" style="background:#dce8f8">${maker}</th>
          </tr>
          <tr>
            ${colors.map(c=>`<th style="min-width:22mm;background:#dce8f8">${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>`;

      secNames.forEach(secName=>{
        const items=[...new Set(sps.flatMap(sp=>{
          const sec=sp.sections.find(s=>s.name===secName);
          return sec?sec.items.filter(it=>it.checked).map(it=>it.name):[];
        }))];
        if(!items.length) return;

        items.forEach((itemName,idx)=>{
          const isFirst=idx===0;
          const spec=rpGetSpec(itemName,secName);
          const method=rpGetMethod(itemName);

          const cells=colors.map(color=>{
            const key=`${maker}_${color}`;
            const d=order.rsData?.[key]?.[secName]?.[itemName];
            const judge=d?.judge;
            const val=rpFormatVal(itemName,d?.value,order,maker,color,secName);
            const jClass=judge==='pass'?'rp-pass':judge==='fail'?'rp-fail':'rp-na';
            return `<td>
              <div style="font-size:8.5pt">${val||'—'}</div>
              ${judge?`<div class="${jClass}" style="font-size:7.5pt;margin-top:1px">${judge==='pass'?'합격':'불합격'}</div>`:''}
            </td>`;
          }).join('');

          tableHtml+=`<tr>
            ${isFirst?`<td class="left" rowspan="${items.length}" style="font-weight:600;background:#f8f8f8;font-size:8.5pt">${secName}</td>`:''}
            <td class="left" style="font-size:8.5pt">${itemName}</td>
            <td style="font-size:8pt;color:#444">${method}</td>
            <td style="font-size:7.5pt;color:#333">${spec}</td>
            ${cells}
          </tr>`;
        });
      });

      tableHtml+=`</tbody></table>`;

      const colorLabel = colors.join(', ');
      resultPages.push(`<div class="rp-page">
        <div style="display:flex;align-items:baseline;gap:8mm;margin-bottom:3mm;border-bottom:2px solid #000;padding-bottom:2mm">
          <div style="font-size:11pt;font-weight:700">평 가 결 과</div>
          <div style="font-size:9pt;color:#333">${maker} — ${colorLabel}</div>
          <div style="font-size:9pt;color:#777;margin-left:auto">${order.cha} · ${(order.purpose||'').slice(0,30)}</div>
        </div>
        ${tableHtml}
        <div class="rp-footer">페이지 ${pageNum} / ${totalPages}</div>
      </div>`);
      pageNum++;
    }
  });

  body.innerHTML = coverHtml + resultPages.join('');
}


function rpSummaryResult(order){
  let pass=0,fail=0,total=0;
  if(order.rsData){
    order.specimens.forEach(sp=>{
      const key=`${sp.maker}_${sp.color}`;
      sp.sections.forEach(sec=>{
        sec.items.filter(it=>it.checked).forEach(it=>{
          const d=order.rsData?.[key]?.[sec.name]?.[it.name];
          if(d?.judge){ total++; if(d.judge==='pass') pass++; else fail++; }
        });
      });
    });
  }
  if(!total) return '결과 미입력';
  if(fail===0) return `전 항목 요구사항 만족 (${pass}/${total})`;
  return `일부 NG 발생 — 불합격 ${fail}건 / 합격 ${pass}건 / 전체 ${total}건`;
}

function rpGetSpec(itemName, secName){
  const specs={
    // 차체도장
    '도막두께':'도장재료 설계안에 따를 것','광택':'유광 88↑ (20°법) / 무광 25±2 (60°법)',
    '부착성':'M-2.5 이하','재도장성':'M-2.5 이하','층간부착성':'M-2.5 이하','O/B층간부착성':'M-2.5 이하',
    '내충격성':'20cm 이상','경도':'B 이상',
    '내수성':'외관 이상없음 / 부착성 M-2.5 이하','내습성':'외관 이상없음 / 부착성 M-2.5 이하',
    '내스크래치성':'광택 유지율 기준 이상','내치핑성':'3급 이하','내염수분무성':'편측 3mm 미만',
    'ATR분析':'IR 그래프 제출',
    // 휠도장
    '도막두께-전처리':'층별 도막두께 (사양별 제공)',
    'CASS시험':'240Hr 후 균열·박리·부식·부풀음 없을 것',
    'IR분析':'IR PEAK 위치 표시 그래프 제출',
    // DGU
    'KNIFE CUT_상태':'Cf 90% 이상 (응집파괴)','KNIFE CUT_내열':'Cf 90% 이상',
    'KNIFE CUT_내수':'Cf 90% 이상','KNIFE CUT_내약품':'Cf 90% 이상','KNIFE CUT_내열CYCLE':'Cf 90% 이상',
    '전단강도_상태':'3 MPa 이상','전단강도_내열':'3 MPa 이상','전단강도_내수':'3 MPa 이상',
    '전단강도_내약품':'3 MPa 이상','전단강도_내열CYCLE':'3 MPa 이상',
    '전단모듈러스':'참고치',
    '경도_상태':'45~70 Hs','경도_내열':'45~70 Hs','경도_내수':'45~70 Hs',
    '인열강도':'15 N/mm 이상','인장강도':'참고치','신율':'참고치',
  };
  return specs[itemName]||'—';
}

function rpGetMethod(itemName){
  if(CUR_SYS==='dgu'){
    const dm={
      'KNIFE CUT_상태':'상태 (20±2℃, 65±5%RH, 168Hr)',
      'KNIFE CUT_내열':'내열 (90℃, 336Hr → 상온 1Hr)',
      'KNIFE CUT_내수':'내수 (40℃ 수중, 336Hr → 상온 1Hr)',
      'KNIFE CUT_내약품':'내약품 (워셔용액, 336Hr → 상온 1Hr)',
      'KNIFE CUT_내열CYCLE':'내열사이클 (10cycle)',
      '전단강도_상태':'UTM / 상태','전단강도_내열':'UTM / 내열',
      '전단강도_내수':'UTM / 내수','전단강도_내약품':'UTM / 내약품','전단강도_내열CYCLE':'UTM / 내열사이클',
      '전단모듈러스':'UTM 전단모듈러스 (상온)',
      '경도_상태':'Shore A (5회 평균) / 상태','경도_내열':'Shore A / 내열','경도_내수':'Shore A / 내수',
      '인열강도':'UTM (인열강도 시편)','인장강도':'UTM (3호형 시편)','신율':'UTM 표선거리 20mm',
    };
    if(dm[itemName]) return dm[itemName];
  }
  if(CUR_SYS==='wheel'){
    const wm={
      '도막두께':'밴드쏘+마운팅+폴리싱+광학현미경','도막두께-전처리':'밴드쏘+마운팅+폴리싱+광학현미경',
      '부착성':'바둑판 눈금법 (Nichiban 테이프)',
      '내수성':'40℃ 순수 120Hr 침적','내습성':'50℃ / RH98% / 120Hr',
      '내치핑성':'Gravelometer (-30℃, 150g, 4bar)','내염수분무성':'SST 720Hr (5% NaCl)',
      'CASS시험':'KS D 9502 CASS 240Hr (120Hr 중간점검)',
      'IR분析':'FT-IR Spectrometer',
    };
    if(wm[itemName]) return wm[itemName];
  }
  const methods={
    '도막두께':'도막두께 측정기','광택':'ISO 2813 (광택계)',
    '부착성':'바둑판 눈금법 (Nichiban 테이프)','재도장성':'바둑판 눈금법',
    '층간부착성':'바둑판 눈금법','O/B층간부착성':'바둑판 눈금법',
    '내충격성':'DuPont식 충격시험기','경도':'연필경도 시험기',
    '내수성':'40℃ 순수 240Hr 침적','내습성':'50℃ / RH98% / 96Hr',
    '내스크래치성':'AMTEC-KISTLER 세차성 시험기','내치핑성':'Gravelometer (-20℃)',
    '내염수분무성':'염수분무 500Hr (SST)','ATR분析':'IR Spectrometer',
  };
  return methods[itemName]||'—';
}

function rpFormatVal(itemName,v,order,maker,color,secName){
  if(!v||typeof v!=='object') {
    // 도막두께/광택은 중간결과에서
    if(itemName==='도막두께'){
      const tkKeys=Object.keys(order.tkData||{}).filter(k=>k.startsWith(`tk_${maker}_${color}_`)&&k.endsWith('_CLEAR'));
      const vals=tkKeys.flatMap(k=>(order.tkData[k]||'').split('/').map(n=>parseFloat(n)).filter(n=>!isNaN(n)));
      if(vals.length){ const avg=(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1); return `${avg} µm`; }
      return '—';
    }
    if(itemName==='광택'){
      const gv=order.tkData?.[`gloss_${maker}_${color}_유광`];
      return gv?`${gv} GU`:'—';
    }
    if(itemName==='ATR분析'||itemName==='ATR분析'){
      const cnt=(order.tkData?.[`atr_${maker}_${color}`]||[]).length;
      return cnt?`${cnt}개 파일`:'미제출';
    }
    return '—';
  }
  const type=RS_INPUT[itemName]?.type;
  switch(type){
    case 'adhesion':  return v.grade||'—';
    case 'impact':    return v.val?v.val+'cm':'—';
    case 'hardness':  return v.grade||'—';
    case 'water':     return [v.appearance,v.adhesion].filter(Boolean).join(' / ')||'—';
    case 'scratch':   return v.retention?`유지율 ${v.retention}%`:(v.before?`초기 ${v.before}GU`:'—');
    case 'chipping':  return v.grade||'—';
    case 'saltspray': return [v.appearance,v.peeling?`편측 ${v.peeling}mm`:null].filter(Boolean).join(' / ')||'—';
    default: return v.text||'—';
  }
}

function rpPrint(){
  if(!rpCurrentOrder){ showToast('차수를 먼저 선택하세요','o',2000); return; }
  window.print();
}

