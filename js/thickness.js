// ======================================================
// // thickness.js — 중간결과(도막두께·광택·ATR) — 차체도장 전용
// 의존: common.js
// ======================================================


// ══════════════════════════════════════════════════════
// 도막두께 페이지
// ══════════════════════════════════════════════════════

// 층별 기준 스펙
// ══════════════════════════════════════════════════════
// 도막두께 — 스펙 정의
// ══════════════════════════════════════════════════════
// 스펙: {min, max, label} / min·max=null이면 측정치(기록만)
const TK_SPEC = {
  '전착':        {min:14, max:18, label:'16±2'},
  '전착(측정치)':{min:null,max:null,label:'측정치'},
  '중도':        {min:33, max:37, label:'35±2'},
  '중도(35±2)':  {min:33, max:37, label:'35±2'},
  '중도(30±2)':  {min:28, max:32, label:'30±2'},
  '중도(20±2)':  {min:18, max:22, label:'20±2'},
  '중도(측정치)':{min:null,max:null,label:'측정치'},
  'BASE':        {min:null,max:null,label:'측정치'},
  'BASE(측정치)':{min:null,max:null,label:'측정치'},
  'CLEAR':       {min:38, max:42, label:'40±2'},
  'CLEAR(40±2)': {min:38, max:42, label:'40±2'},
  'CLEAR 1':     {min:38, max:42, label:'40±2'},
  'CLEAR 2':     {min:38, max:42, label:'40±2'},
  '광택(유광)':  {min:88, max:null,label:'88 이상'},
  '광택(무광)':  {min:null,max:30, label:'30 이하'},
};

function tkGetSpec(layerName){
  // 층 이름에서 스펙 찾기 (부분 매칭)
  if(TK_SPEC[layerName]) return TK_SPEC[layerName];
  for(const [k,v] of Object.entries(TK_SPEC)){
    if(layerName.includes(k)||k.includes(layerName.split('(')[0])) return v;
  }
  return {min:null,max:null,label:'—'};
}

function tkJudge(val, spec){
  if(spec.min==null&&spec.max==null) return 'na';
  if(spec.min!=null&&val<spec.min) return 'ng';
  if(spec.max!=null&&val>spec.max) return 'ng';
  return 'ok';
}

// ── 계산 핵심: 누적 스텝 → 실제 두께
// rawVals = [step1_cumul, step2_cumul, step3_cumul, ...]
// 반환: [actual1, actual2, actual3, ...]
function tkStepToActual(rawVals){
  return rawVals.map((v,i)=> i===0 ? v : Math.round((v - rawVals[i-1])*10)/10);
}

// ══════════════════════════════════════════════════════
// 도막두께 — 앱 상태
// ══════════════════════════════════════════════════════
let tkCurrentOrder = null;
let tkActiveMaker  = null;
let tkActiveColor  = null;

// ══════════════════════════════════════════════════════
// 도막두께 — 페이지 초기화
// ══════════════════════════════════════════════════════
function tkInit(){
  const sel = document.getElementById('tk-year-sel');
  sel.innerHTML = '';
  Object.keys(activeDB().orders).sort().reverse().forEach(yr=>{
    const opt=document.createElement('option');
    opt.value=yr; opt.textContent=yr+'년';
    if(yr===CY) opt.selected=true;
    sel.appendChild(opt);
  });
  tkChangeYear(CY);
  if(selectedOrderId){
    const oSel=document.getElementById('tk-order-sel');
    [...oSel.options].forEach(o=>{ if(o.value===selectedOrderId) o.selected=true; });
    tkSelectOrder(selectedOrderId);
  }
}

function tkSwitchMaker(maker, btn){
  tkActiveMaker = maker;
  // 탭 활성화
  btn.closest('.tk-maker-tabs').querySelectorAll('.maker-tab')
    .forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  // 패널 전환
  document.querySelectorAll('[id^="tk-mp-"]').forEach(p=>{
    p.style.display = p.id === `tk-mp-${maker}` ? 'block' : 'none';
  });
}

function tkChangeYear(yr){
  const sel=document.getElementById('tk-order-sel');
  sel.innerHTML='<option value="">-- 차수 선택 --</option>';
  (activeDB().orders[yr]||[]).forEach(o=>{
    const opt=document.createElement('option');
    opt.value=o.id;
    opt.textContent=`${o.cha} — ${(o.purpose||'').slice(0,18)}`;
    sel.appendChild(opt);
  });
  tkCurrentOrder=null;
  document.getElementById('tk-body').innerHTML=`<div style="text-align:center;padding:60px 20px;color:var(--tx3)"><div>차수를 선택하세요</div></div>`;
}

function tkSelectOrder(orderId){
  if(!orderId){tkCurrentOrder=null;return;}
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(!order) return;
  tkCurrentOrder=order;
  if(!order.tkData) order.tkData={};
  tkActiveMaker=null; tkActiveColor=null;
  tkRenderBody(order);
}

// ══════════════════════════════════════════════════════
// 도막두께 — 렌더링
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// 도막두께 — 사진처럼 표 형태 렌더링
// 행=시편종류+층, 열=색상
// ══════════════════════════════════════════════════════

// 시편종류별 층 구성 결정
function tkGetLayers(secName){
  const n=(secName||'').toLowerCase();
  if(/내판|후드|도어|중도 단독|중도단독/.test(n)){
    return ['전착','중도'];
  }
  // 기본: 4층
  return ['전착','중도','BASE','CLEAR'];
}

// 층 스펙 (스펙 없으면 측정치만)
function tkLayerSpec(layerName, secName){
  const s=(secName||'').toLowerCase();
  // 중도 스펙: 섹션에서 추출 (20±2, 30±2, 35±2)
  if(/중도/.test(layerName)){
    if(/20/.test(s)) return {min:18,max:22,label:'20±2'};
    if(/30/.test(s)) return {min:28,max:32,label:'30±2'};
    return {min:33,max:37,label:'35±2'};
  }
  const specs={
    '전착':  {min:null,max:null,label:'측정치'},
    'BASE':  {min:null,max:null,label:'측정치'},
    'CLEAR': {min:38,max:42,label:'40±2'},
    'CLEAR(40±2)':{min:38,max:42,label:'40±2'},
    '광택(유광)':{min:88,max:null,label:'88↑ (20°)'},
    '광택(무광)':{min:23,max:27,label:'25±2 (60°)'},
  };
  return specs[layerName]||{min:null,max:null,label:'—'};
}

function tkJudgeVal(v, spec){
  if(spec.min==null&&spec.max==null) return 'na';
  if(spec.min!=null&&v<spec.min) return 'ng';
  if(spec.max!=null&&v>spec.max) return 'ng';
  return 'ok';
}

function tkRenderBody(order){
  if(!order.tkData) order.tkData={};
  const makers=[...new Set(order.specimens.map(sp=>sp.maker))];
  if(!tkActiveMaker||!makers.includes(tkActiveMaker)) tkActiveMaker=makers[0];

  const makerTabsHtml=makers.map(m=>
    `<button class="maker-tab${m===tkActiveMaker?' active':''}" onclick="tkSwitchMaker('${m}',this)">${m}</button>`
  ).join('');

  const panels=makers.map(m=>{
    const sps=order.specimens.filter(sp=>sp.maker===m);
    return `<div id="tk-mp-${m}" style="display:${m===tkActiveMaker?'block':'none'}">
      ${tkRenderMakerTable(order,m,sps)}
    </div>`;
  }).join('');

  document.getElementById('tk-body').innerHTML=`
    <div class="tk-maker-tabs" style="margin-bottom:16px">${makerTabsHtml}</div>
    ${panels}`;
}

function tkRenderMakerTable(order,maker,sps){
  // 시편종류 목록 (도막두께가 있는 섹션 우선, 없으면 재도장/층간 제외)
  const secNames=[...new Set(sps.flatMap(sp=>{
    const hasTk=sp.sections.filter(sec=>{
      if(!sec.items||!sec.items.length) return false;
      return sec.items.some(it=>it&&it.name&&/두께|도막/.test(it.name));
    });
    if(hasTk.length) return hasTk.map(s=>s.name);
    return sp.sections.filter(s=>!['재도장','층간부착','O/B층간부착','O/B 층간부착'].includes(s.name)).map(s=>s.name);
  }))];

  if(!secNames.length) return '<div style="color:var(--tx3);padding:30px;text-align:center">도막두께 섹션 없음</div>';

  // 색상 목록
  const colors=sps.map(sp=>sp.color);

  // 표 헤더: 색상
  const colHeader=`<thead><tr>
    <th style="background:var(--bg4);padding:6px 10px;font-size:11px;font-weight:700;color:var(--tx3);border:1px solid var(--border);text-align:left;white-space:nowrap;min-width:80px">시편종류</th>
    <th style="background:var(--bg4);padding:6px 8px;font-size:11px;font-weight:700;color:var(--tx3);border:1px solid var(--border);text-align:center;white-space:nowrap;min-width:60px">층</th>
    ${colors.map(c=>`<th style="background:var(--bg4);padding:6px 8px;font-size:12px;font-weight:700;color:var(--b);border:1px solid var(--border);text-align:center;min-width:90px;font-family:var(--mono)">${c}</th>`).join('')}
  </tr></thead>`;

  // 표 바디: 시편종류×층
  const rows=secNames.flatMap((secName,si)=>{
    const layers=tkGetLayers(secName);
    return layers.map((layer,li)=>{
      const isFirstLayer=(li===0);
      const secCell=isFirstLayer
        ?`<td rowspan="${layers.length}" style="background:var(--bg3);padding:6px 10px;font-size:12px;font-weight:700;color:var(--tx);border:1px solid var(--border);vertical-align:middle;text-align:left;white-space:nowrap">${secName}</td>`
        :'';
      const spec=tkLayerSpec(layer,secName);
      const layerCell=`<td style="background:var(--bg3);padding:4px 8px;font-size:11px;color:var(--tx2);border:1px solid var(--border);text-align:center;white-space:nowrap">
        ${layer}${spec.label!=='—'&&spec.label!=='측정치'?`<span style="font-size:9px;color:var(--tx3);display:block">${spec.label}</span>`:''}
      </td>`;

      const valueCells=colors.map(color=>{
        const sp=sps.find(s=>s.color===color);
        const spIdx=sp?order.specimens.indexOf(sp):-1;
        const key=`tk_${maker}_${color}_${secName}_${layer}`;
        if(!order.tkData[key]) order.tkData[key]='';
        const val=order.tkData[key];

        // 판정
        let judgeHtml='';
        if(val.trim()){
          // 슬래시 구분으로 여러 점 or 단일값 지원
          const nums=val.split('/').map(v=>parseFloat(v.trim())).filter(v=>!isNaN(v));
          if(nums.length){
            const avg=+(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1);
            const j=tkJudgeVal(avg,spec);
            const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx3)';
            judgeHtml=`<div style="font-size:10px;font-family:var(--mono);color:${c};margin-top:2px">${nums.length>1?'avg ':''}<b>${avg}</b> ${j==='ng'?'⚠':j==='ok'&&spec.min!=null?'✓':''}</div>`;
          }
        }

        return `<td style="padding:3px 4px;border:1px solid var(--border);vertical-align:middle">
          ${spIdx>=0?`<input value="${val}" placeholder="예: 16 또는 16/17/15"
            style="width:100%;padding:3px 5px;font-size:12px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--tx);outline:none;text-align:center;box-sizing:border-box"
            onfocus="this.style.borderColor='var(--b)'" onblur="this.style.borderColor='var(--border)'"
            oninput="tkCellInput('${order.id}','${key}',this.value,this)">${judgeHtml}` : '<span style="color:var(--tx3);font-size:11px">—</span>'}
        </td>`;
      }).join('');

      return `<tr>${secCell}${layerCell}${valueCells}</tr>`;
    });
  });

  // 광택 행 (유광 20°법 / 무광 60°법) — 유무광 토글 포함
  const glossDefs=[
    {key:'유광', label:'유광', method:'20°법', spec:{min:88,max:null,label:'88 이상'}},
    {key:'무광', label:'무광', method:'60°법', spec:{min:23,max:27,label:'25±2'}},
  ];
  const glossRows=sps.length?glossDefs.map((gd,gi)=>{
    const valueCells=colors.map(color=>{
      const dataKey=`gloss_${maker}_${color}_${gd.key}`;
      // 현재 이 색상이 유광인지 무광인지 (저장된 타입 확인)
      const glossTypeKey=`glosstype_${maker}_${color}`;
      const currentType=order.tkData[glossTypeKey]||'유광';
      if(!order.tkData) order.tkData={};
      if(!order.tkData[dataKey]) order.tkData[dataKey]='';
      const val=order.tkData[dataKey];
      const num=parseFloat(val);
      let judgeHtml='';
      if(!isNaN(num)&&val.trim()){
        const j=tkJudgeVal(num,gd.spec);
        const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx3)';
        judgeHtml=`<div style="font-size:10px;font-family:var(--mono);color:${c};margin-top:2px"><b>${num}</b>${j==='ng'?'⚠':j==='ok'?'✓':''}</div>`;
      }
      return `<td style="padding:3px 4px;border:1px solid var(--border);vertical-align:middle">
        <input value="${val}" placeholder="예: 89.5"
          style="width:100%;padding:3px 5px;font-size:12px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border);border-radius:3px;color:var(--tx);outline:none;text-align:center;box-sizing:border-box"
          onfocus="this.style.borderColor='var(--b)'" onblur="this.style.borderColor='var(--border)'"
          oninput="tkCellInput('${order.id}','${dataKey}',this.value,this)">${judgeHtml}
      </td>`;
    }).join('');
    const isFirst=gi===0;
    // 첫번째 색상에 대해 유광/무광 토글 표시
    const firstColor=colors[0];
    const glossTypeKey=`glosstype_${maker}_${firstColor}`;
    const currentType=order.tkData[glossTypeKey]||'유광';
    return `<tr>
      ${isFirst?`<td rowspan="2" style="background:var(--bg3);padding:6px 10px;font-size:12px;font-weight:700;color:var(--tx);border:1px solid var(--border);vertical-align:middle;text-align:left">
        <div>광택</div>
        <div style="margin-top:6px;display:flex;gap:3px">
          ${['유광','무광'].map(t=>`<button onclick="tkSetGlossType('${order.id}','${maker}','${t}')"
            style="padding:2px 6px;font-size:10px;border-radius:3px;cursor:pointer;font-family:var(--sans);
            background:${currentType===t?'var(--bbg)':'var(--bg4)'};border:1px solid ${currentType===t?'rgba(56,139,253,.4)':'var(--border)'};
            color:${currentType===t?'var(--b)':'var(--tx3)'}">${t}</button>`).join('')}
        </div>
      </td>`:''}
      <td style="background:var(--bg3);padding:4px 8px;font-size:11px;color:var(--tx2);border:1px solid var(--border);text-align:center;white-space:nowrap;line-height:1.4">
        <span style="font-weight:600;color:var(--tx)">${gd.label}</span><br>
        <span style="font-size:10px;color:var(--tx3)">${gd.method}</span><br>
        <span style="font-size:10px;color:var(--b)">${gd.spec.label}</span>
      </td>
      ${valueCells}
    </tr>`;
  }).join('') : '';

  // ATR/IR 행 — 휠도장은 IR 표기
  const isWheel = CUR_SYS === 'wheel';
  const atrLabel = isWheel ? 'IR' : 'ATR';
  const atrRow=`<tr>
    <td style="background:var(--bg3);padding:6px 10px;font-size:12px;font-weight:700;color:var(--tx);border:1px solid var(--border);vertical-align:middle;text-align:left">${atrLabel}</td>
    <td style="background:var(--bg3);padding:4px 8px;font-size:11px;color:var(--tx2);border:1px solid var(--border);text-align:center;line-height:1.4">${isWheel?'TR<br>모드':'업체<br>대표<br>1종'}</td>
    ${colors.map(color=>{
      const sp=sps.find(s=>s.color===color);
      const spIdx=sp?order.specimens.indexOf(sp):-1;
      const atrKey=`atr_${maker}_${color}`;
      if(!order.tkData[atrKey]) order.tkData[atrKey]=[];
      const cnt=order.tkData[atrKey].length;
      return `<td style="padding:4px;border:1px solid var(--border);text-align:center;vertical-align:middle">
        ${spIdx>=0?`
          <button onclick="tkAtrModal('${order.id}','${atrKey}','${color}')"
            style="background:${cnt>0?'var(--gbg)':'var(--bg3)'};border:1px solid ${cnt>0?'rgba(45,164,78,.4)':'var(--border2)'};border-radius:5px;padding:4px 8px;cursor:pointer;font-size:11px;color:${cnt>0?'var(--g)':'var(--tx3)'};font-family:var(--sans);display:block;width:100%;text-align:center">
            ${cnt>0?` ${cnt}개`:' 업로드'}
          </button>
        `:'<span style="color:var(--tx3);font-size:11px">—</span>'}
      </td>`;
    }).join('')}
  </tr>`;

  return `<div style="overflow-x:auto">
    <table class="tk-table" style="border-collapse:collapse;min-width:max-content">
      ${colHeader}
      <tbody>${rows.join('')}${isWheel?'':glossRows}${atrRow}</tbody>
    </table>
  </div>`;
}

function tkCellInput(orderId,key,val,el){
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  order.tkData[key]=val;
  // 판정 즉시 업데이트
  const nums=val.split('/').map(v=>parseFloat(v.trim())).filter(v=>!isNaN(v));
  if(nums.length){
    const parts=key.split('_');
    const layer=parts[parts.length-1];
    const secName=parts[parts.length-2];
    const spec=tkLayerSpec(layer,secName);
    const avg=+(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1);
    const j=tkJudgeVal(avg,spec);
    const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx3)';
    let judgeEl=el.nextElementSibling;
    if(!judgeEl||judgeEl.tagName==='INPUT'){
      judgeEl=document.createElement('div'); el.parentNode.appendChild(judgeEl);
    }
    judgeEl.style.cssText=`font-size:10px;font-family:var(--mono);color:${c};margin-top:2px`;
    judgeEl.innerHTML=`${nums.length>1?'avg ':''}<b>${avg}</b> ${j==='ng'?'⚠':j==='ok'&&spec.min!=null?'✓':''}`;
  }
  autoSave();
}

function tkCellAtr(orderId,key,files,color){
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  if(!order.tkData[key]) order.tkData[key]=[];
  let loaded=0;
  Array.from(files).forEach(f=>{
    const r=new FileReader();
    r.onload=e2=>{
      order.tkData[key].push({name:f.name,size:f.size,type:f.type,data:e2.target.result,uploadedAt:new Date().toISOString()});
      loaded++;
      if(loaded===files.length){
        autoSave();
        // 버튼 업데이트
        tkAtrUpdateBtn(orderId,key,color,order.tkData[key].length);
        // 모달이 열려있으면 파일 목록 갱신
        const modal=document.getElementById('atr-modal');
        if(modal&&modal.classList.contains('open')) tkAtrModal(orderId,key,color);
      }
    };
    r.readAsDataURL(f);
  });
}

// ── ATR 버튼 즉시 업데이트
function tkAtrUpdateBtn(orderId,key,color,cnt){
  // 테이블 내 ATR 버튼 찾기 (data 속성으로 정확히 식별)
  const btn=document.getElementById(`atr-btn-${key}`);
  if(btn){
    btn.style.background=cnt>0?'var(--gbg)':'var(--bg3)';
    btn.style.borderColor=cnt>0?'rgba(45,164,78,.4)':'var(--border2)';
    btn.style.color=cnt>0?'var(--g)':'var(--tx3)';
    btn.textContent=cnt>0?` ${cnt}개`:' 업로드';
  }
}

// ATR 파일 관리 팝업 모달
let _atrModalCtx={orderId:null,key:null,color:null};
function tkAtrModal(orderId,key,color){
  _atrModalCtx={orderId,key,color};
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  if(!order.tkData[key]) order.tkData[key]=[];
  const files=order.tkData[key];

  const fileListHtml=files.length?files.map((f,i)=>{
    const isImg=f.type&&f.type.startsWith('image');
    const isPdf=f.type&&f.type.includes('pdf');
    const kb=(f.size/1024).toFixed(0);
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin-bottom:6px">
      ${isImg?`<img src="${f.data}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;border:1px solid var(--border)">`
              :`<div style="width:48px;height:48px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${isPdf?'':''}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--tx);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:2px">${kb} KB · ${new Date(f.uploadedAt||Date.now()).toLocaleDateString('ko')}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        <a href="${f.data}" download="${f.name}" style="padding:3px 8px;background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;font-size:11px;color:var(--b);text-decoration:none;text-align:center">⬇ 다운</a>
        <a href="${f.data}" target="_blank" style="padding:3px 8px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;font-size:11px;color:var(--tx2);text-decoration:none;text-align:center"> 보기</a>
        <button onclick="tkAtrDeleteFile('${orderId}','${key}','${color}',${i})" style="padding:3px 8px;background:var(--rbg);border:1px solid rgba(248,81,73,.3);border-radius:4px;font-size:11px;color:var(--r);cursor:pointer;font-family:var(--sans)"> 삭제</button>
      </div>
    </div>`;
  }).join('')
  :`<div style="text-align:center;padding:30px;color:var(--tx3);font-size:13px">업로드된 파일 없음</div>`;

  document.getElementById('atr-modal-title').textContent=`ATR 파일 관리 — ${color}`;
  document.getElementById('atr-modal-files').innerHTML=fileListHtml;
  openModal('atr-file-modal');
}

function tkAtrDeleteFile(orderId,key,color,idx){
  if(!confirm('이 파일을 삭제할까요?')) return;
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  order.tkData[key].splice(idx,1);
  autoSave();
  tkAtrUpdateBtn(orderId,key,color,order.tkData[key].length);
  tkAtrModal(orderId,key,color);
}

function tkAtrModalUpload(files){
  const {orderId,key,color}=_atrModalCtx;
  if(!orderId) return;
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  if(!order.tkData[key]) order.tkData[key]=[];
  const fileArr=Array.from(files);
  if(!fileArr.length) return;
  let done=0;
  fileArr.forEach(f=>{
    const r=new FileReader();
    r.onload=e2=>{
      order.tkData[key].push({name:f.name,size:f.size,type:f.type||'image/jpeg',data:e2.target.result,uploadedAt:new Date().toISOString()});
      done++;
      if(done===fileArr.length){
        autoSave();
        tkAtrUpdateBtn(orderId,key,color,order.tkData[key].length);
        tkAtrModal(orderId,key,color); // 모달 내 목록 갱신
      }
    };
    r.readAsDataURL(f);
  });
}

// ══════════════════════════════════════════════════════
// 도막두께 계산기 — 색상+시편종류 선택 방식으로 재설계
// ══════════════════════════════════════════════════════
let calcPanelOpen=false;
let calcDefs=[
  {name:'전착', spec:'전착', sortOrder:1, cumul:''},
  {name:'중도', spec:'중도', sortOrder:2, cumul:''},
  {name:'BASE', spec:'BASE', sortOrder:3, cumul:''},
  {name:'CLEAR',spec:'CLEAR(40±2)',sortOrder:4,cumul:''},
];
// 현재 선택된 적용 대상
let calcTarget={maker:'',color:'',sec:''};

function tkToggleCalcPanel(){
  calcPanelOpen=!calcPanelOpen;
  document.getElementById('tk-calc-panel').classList.toggle('open',calcPanelOpen);
  document.getElementById('tk-calc-toggle').classList.toggle('active',calcPanelOpen);
  if(calcPanelOpen) tkRenderCalcPanel();
}

function tkRenderCalcPanel(){
  // 적용 대상 선택기 옵션 생성
  let targetSelHtml='<option value="">-- 적용 안 함 --</option>';
  if(tkCurrentOrder){
    const order=tkCurrentOrder;
    order.specimens.forEach(sp=>{
      const secNames=sp.sections
        .filter(sec=>sec.items&&sec.items.some(it=>it&&it.name&&/두께|도막/.test(it.name)))
        .map(s=>s.name);
      if(!secNames.length) return;
      secNames.forEach(sec=>{
        const val=JSON.stringify({maker:sp.maker,color:sp.color,sec});
        const label=`${sp.maker} · ${sp.color} · ${sec}`;
        const sel=(calcTarget.maker===sp.maker&&calcTarget.color===sp.color&&calcTarget.sec===sec)?'selected':'';
        targetSelHtml+=`<option value='${val}' ${sel}>${label}</option>`;
      });
    });
  }

  const layerRows=calcDefs.map((def,i)=>{
    const spec=tkLayerSpec(def.name,'');
    const curr=parseFloat(def.cumul);
    const prev=i>0?parseFloat(calcDefs[i-1].cumul):null;
    const actual=isNaN(curr)||def.cumul===''?null:(i===0?curr:(!isNaN(prev)&&prev!=null?Math.round((curr-prev)*10)/10:null));
    const j=actual!=null&&actual>=0?tkJudgeVal(actual,spec):'na';
    const actualStr=actual!=null&&actual>=0?actual+'µm':'—';
    const jColor=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx3)';
    return `<tr>
      <td style="padding:4px 2px;width:24px;text-align:center;font-size:11px;font-weight:700;color:var(--tx3);font-family:var(--mono)">${i+1}</td>
      <td style="padding:3px 4px">
        <input value="${def.name}" placeholder="층 이름" oninput="calcUpdateName(${i},this.value)"
          style="width:100%;padding:3px 5px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--tx);outline:none">
        <div style="font-size:9px;color:var(--tx3);text-align:center;margin-top:1px">${spec.label} µm</div>
      </td>
      <td style="padding:3px 4px">
        <input id="calc-val-${i}" type="text" inputmode="decimal" value="${def.cumul}" placeholder="누적값"
          oninput="calcUpdateVal(${i},this.value)"
          style="width:100%;padding:3px 5px;font-size:12px;font-family:var(--mono);background:var(--bg3);border:1px solid var(--border);border-radius:3px;color:var(--tx);outline:none;text-align:center">
      </td>
      <td id="calc-a-${i}" style="padding:3px;text-align:center;font-size:11px;font-family:var(--mono);font-weight:700;color:${j==='na'?'var(--tx3)':jColor}">${actualStr}</td>
      <td id="calc-j-${i}" style="padding:3px;text-align:center;font-size:11px;font-weight:700;color:${jColor}">${j==='ok'?'OK':j==='ng'?'NG':'—'}</td>
      <td style="padding:3px 2px;text-align:center">
        <button onclick="calcRemoveLayer(${i})" style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:13px;padding:0">×</button>
      </td>
    </tr>`;
  }).join('');

  // 결과 계산
  const sorted=[...calcDefs].map((def,i)=>{
    const curr=parseFloat(def.cumul);
    const prev=i>0?parseFloat(calcDefs[i-1].cumul):null;
    const actual=isNaN(curr)||def.cumul===''?null:(i===0?curr:(!isNaN(prev)&&prev!=null?Math.round((curr-prev)*10)/10:null));
    return {...def,actual};
  }).sort((a,b)=>a.sortOrder-b.sortOrder);
  const hasRes=sorted.some(d=>d.actual!=null&&d.actual>=0);
  const resultRows=sorted.map(def=>{
    if(def.actual==null||def.actual<0) return `<tr><td style="font-size:11px;padding:3px 6px;color:var(--tx2);font-weight:600">${def.name}</td><td colspan="2" style="text-align:center;color:var(--tx3);font-size:11px">—</td></tr>`;
    const spec=tkLayerSpec(def.name,'');
    const j=tkJudgeVal(def.actual,spec);
    const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx2)';
    return `<tr><td style="font-size:11px;padding:3px 6px;color:var(--tx2);font-weight:600">${def.name}</td><td style="font-family:var(--mono);font-size:12px;text-align:center;color:${c};font-weight:700">${def.actual} µm</td><td style="font-size:11px;text-align:center;color:${c};font-weight:700">${j==='ok'?'OK':j==='ng'?'NG':'—'}</td></tr>`;
  }).join('');

  document.getElementById('tk-calc-panel').innerHTML=`
    <div class="calc-panel-head">
      <span style="font-size:14px"></span>
      <span style="font-size:13px;font-weight:700">도막두께 계산기</span>
      <button onclick="tkToggleCalcPanel()" style="margin-left:auto;background:none;border:none;color:var(--tx3);cursor:pointer;font-size:18px;padding:0">×</button>
    </div>
    <div class="calc-panel-body">

      <!-- 적용 대상 선택 -->
      <div style="margin-bottom:12px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px">
        <div style="font-size:11px;font-weight:700;color:var(--tx2);margin-bottom:6px">📌 적용 대상 선택</div>
        <select id="calc-target-sel" onchange="calcSetTarget(this.value)"
          style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:5px;padding:5px 8px;font-size:12px;color:var(--tx);outline:none">
          ${targetSelHtml}
        </select>
        ${calcTarget.color?`<div style="font-size:11px;color:var(--b);margin-top:5px">선택됨: <b>${calcTarget.maker} · ${calcTarget.color} · ${calcTarget.sec}</b></div>`:'<div style="font-size:11px;color:var(--tx3);margin-top:4px">차수 선택 후 대상을 고르세요</div>'}
      </div>

      <!-- 안내 -->
      <div style="background:var(--bg3);border:1px solid var(--border);border-radius:5px;padding:8px 10px;margin-bottom:10px;font-size:11px;color:var(--tx3);line-height:1.6">
        💡 <b style="color:var(--tx2)">계단형 누적값</b> 순서대로 입력<br>
        1층=전착, 2층=전착+중도, 3층=+BASE, 4층=+CLEAR
      </div>

      <!-- 층 입력 테이블 -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="font-size:10px;color:var(--tx3);padding:3px 2px;width:24px">#</th>
          <th style="font-size:10px;color:var(--tx3);padding:3px 4px;text-align:left">층</th>
          <th style="font-size:10px;color:var(--tx3);padding:3px 4px;text-align:center">누적값</th>
          <th style="font-size:10px;color:var(--tx3);padding:3px 3px;text-align:center">실제</th>
          <th style="font-size:10px;color:var(--tx3);padding:3px 3px;text-align:center">판정</th>
          <th style="width:20px"></th>
        </tr></thead>
        <tbody>${layerRows}</tbody>
      </table>
      <button onclick="calcAddLayer()" style="width:100%;padding:5px;background:var(--bg3);border:1px dashed var(--border2);border-radius:4px;font-size:12px;color:var(--tx3);cursor:pointer;font-family:var(--sans);margin-bottom:10px">+ 층 추가</button>

      <!-- 결과 (표준 순서) -->
      <div id="calc-result-table" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:10px;margin-bottom:10px;display:${hasRes?'block':'none'}">
        <div style="font-size:11px;font-weight:700;color:var(--tx2);margin-bottom:6px"> 결과 (표준 순서)</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="font-size:10px;color:var(--tx3);padding:2px 6px;text-align:left">층</th>
            <th style="font-size:10px;color:var(--tx3);padding:2px 6px;text-align:center">두께</th>
            <th style="font-size:10px;color:var(--tx3);padding:2px 6px;text-align:center">판정</th>
          </tr></thead>
          <tbody>${resultRows}</tbody>
        </table>
      </div>

      <!-- 적용 버튼 -->
      <button onclick="calcApply()"
        style="width:100%;padding:8px;background:${calcTarget.color?'var(--g)':'var(--bg3)'};border:1px solid ${calcTarget.color?'var(--g2)':'var(--border2)'};border-radius:5px;font-size:13px;font-weight:600;color:${calcTarget.color?'#fff':'var(--tx3)'};cursor:pointer;font-family:var(--sans);margin-bottom:8px">
        ${calcTarget.color?`✓ ${calcTarget.maker} · ${calcTarget.color} · ${calcTarget.sec} 에 적용`:'대상을 먼저 선택하세요'}
      </button>
      <button onclick="calcClearAll()" style="width:100%;padding:6px;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;font-size:12px;color:var(--tx3);cursor:pointer;font-family:var(--sans)">초기화</button>
    </div>`;
}

function calcSetTarget(jsonStr){
  if(!jsonStr){ calcTarget={maker:'',color:'',sec:''}; tkRenderCalcPanel(); return; }
  try{
    const t=JSON.parse(jsonStr);
    calcTarget={maker:t.maker,color:t.color,sec:t.sec};
    // 적용 버튼만 업데이트 (전체 재렌더 X → 포커스 유지 안 되지만 여기선 select 조작이라 OK)
    tkRenderCalcPanel();
  }catch(e){ console.error(e); }
}

function calcApply(){
  if(!calcTarget.color){ showToast('적용 대상을 먼저 선택하세요','o',2000); return; }
  if(!tkCurrentOrder){ showToast('차수를 먼저 선택하세요','o',2000); return; }
  const order=tkCurrentOrder;
  if(!order.tkData) order.tkData={};
  const {maker,color,sec}=calcTarget;

  calcDefs.forEach((def,i)=>{
    const curr=parseFloat(def.cumul);
    const prev=i>0?parseFloat(calcDefs[i-1].cumul):null;
    const actual=isNaN(curr)||def.cumul===''?null:(i===0?curr:(!isNaN(prev)&&prev!=null?Math.round((curr-prev)*10)/10:null));
    if(actual==null||actual<0) return;
    const key=`tk_${maker}_${color}_${sec}_${def.name}`;
    order.tkData[key]=String(actual);
    // 테이블 DOM 즉시 업데이트
    const inp=document.querySelector(`input[oninput*="'${key}'"]`);
    if(inp){ inp.value=String(actual); inp.dispatchEvent(new Event('input')); }
  });
  autoSave();
  showToast(` ${maker} · ${color} · ${sec} 에 적용됐습니다`,'g',2500);
}

function calcUpdateName(idx,name){
  calcDefs[idx].name=name;
  // 스펙 추론
  const n=name.toLowerCase();
  if(/전착/.test(n)) calcDefs[idx].spec='전착';
  else if(/clear|클리어/.test(n)) calcDefs[idx].spec='CLEAR(40±2)';
  else if(/중도/.test(n)) calcDefs[idx].spec='중도';
  else calcDefs[idx].spec='BASE';
  tkRenderCalcPanel();
}
function calcUpdateVal(idx,val){
  calcDefs[idx].cumul=val;
  calcRefreshResults();
}
function calcAddLayer(){
  const n=calcDefs.length;
  const defaults=['전착','중도','BASE','CLEAR','BASE2','CLEAR2'];
  const nm=defaults[n]||`층${n+1}`;
  const sp=nm.includes('CLEAR')?'CLEAR(40±2)':nm==='전착'?'전착':nm==='중도'?'중도':'BASE';
  calcDefs.push({name:nm,spec:sp,sortOrder:n+1,cumul:''});
  tkRenderCalcPanel();
}
function calcRemoveLayer(idx){
  calcDefs.splice(idx,1);
  calcDefs.forEach((d,i)=>d.sortOrder=i+1);
  tkRenderCalcPanel();
}
function calcClearAll(){
  calcDefs.forEach((d,i)=>{
    d.cumul='';
    const inp=document.getElementById(`calc-val-${i}`);
    if(inp) inp.value='';
  });
  calcRefreshResults();
}
function calcRefreshResults(){
  calcDefs.forEach((def,i)=>{
    const curr=parseFloat(def.cumul);
    const prev=i>0?parseFloat(calcDefs[i-1].cumul):null;
    const actual=isNaN(curr)||def.cumul===''?null:(i===0?curr:(!isNaN(prev)&&prev!=null?Math.round((curr-prev)*10)/10:null));
    const spec=tkLayerSpec(def.name,'');
    const j=actual!=null&&actual>=0?tkJudgeVal(actual,spec):'na';
    const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx3)';
    const aEl=document.getElementById(`calc-a-${i}`);
    const jEl=document.getElementById(`calc-j-${i}`);
    if(aEl){ aEl.textContent=actual!=null&&actual>=0?actual+'µm':'—'; aEl.style.color=j==='na'?'var(--tx3)':c; }
    if(jEl){ jEl.textContent=j==='ok'?'OK':j==='ng'?'NG':'—'; jEl.style.color=c; }
  });
  const resultEl=document.getElementById('calc-result-table');
  if(!resultEl) return;
  const sorted=[...calcDefs].map((def,i)=>{
    const curr=parseFloat(def.cumul);
    const prev=i>0?parseFloat(calcDefs[i-1].cumul):null;
    const actual=isNaN(curr)||def.cumul===''?null:(i===0?curr:(!isNaN(prev)&&prev!=null?Math.round((curr-prev)*10)/10:null));
    return {...def,actual};
  }).sort((a,b)=>a.sortOrder-b.sortOrder);
  const hasRes=sorted.some(d=>d.actual!=null&&d.actual>=0);
  resultEl.style.display=hasRes?'block':'none';
  if(hasRes){
    resultEl.querySelector('tbody').innerHTML=sorted.map(def=>{
      if(def.actual==null||def.actual<0) return `<tr><td style="font-size:11px;padding:3px 6px;color:var(--tx2);font-weight:600">${def.name}</td><td colspan="2" style="text-align:center;color:var(--tx3);font-size:11px">—</td></tr>`;
      const spec=tkLayerSpec(def.name,'');
      const j=tkJudgeVal(def.actual,spec);
      const c=j==='ok'?'var(--g)':j==='ng'?'var(--r)':'var(--tx2)';
      return `<tr><td style="font-size:11px;padding:3px 6px;color:var(--tx2);font-weight:600">${def.name}</td><td style="font-family:var(--mono);font-size:12px;text-align:center;color:${c};font-weight:700">${def.actual} µm</td><td style="font-size:11px;text-align:center;color:${c};font-weight:700">${j==='ok'?'OK':j==='ng'?'NG':'—'}</td></tr>`;
    }).join('');
  }
}

// ── ATR 빠른 업로드
// ── 4. ATR 빠른 업로드 (FileReader → 즉시 처리)

// ── 3. 광택 유무광 선택 (테이블 내 토글)
function tkGlossToggle(orderId,maker,color,oldKey,newType){
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  const oldVal=order.tkData[oldKey]||'';
  const newKey=`gloss_${maker}_${color}_${newType}`;
  order.tkData[newKey]=oldVal;
  autoSave();
  tkRenderBody(order);
}

function tkSetGlossType(orderId,maker,type){
  // 해당 업체 전체 색상 광택 타입 설정
  const yr=document.getElementById('tk-year-sel').value;
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  if(!order.tkData) order.tkData={};
  const colors=[...new Set(order.specimens.filter(s=>s.maker===maker).map(s=>s.color))];
  colors.forEach(color=>{
    order.tkData[`glosstype_${maker}_${color}`]=type;
  });
  autoSave();
  tkRenderBody(order);
}

