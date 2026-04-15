// ======================================================
// ng.js — NG알림·발송·설정
// ======================================================

// ══════════════════════════════════════════════════════
// 설정 모달 — API 키 관리
// ══════════════════════════════════════════════════════
const API_KEY_STORAGE = 'fiti_anthropic_key';

function settingsGetKey(){ return localStorage.getItem(API_KEY_STORAGE)||''; }

function settingsOnOpen(){
  const k = settingsGetKey();
  const input = document.getElementById('settings-api-key');
  if(input) input.value = k;
  settingsUpdateKeyStatus();
  settingsContractRefresh();
}

function settingsUpdateKeyStatus(){
  const input = document.getElementById('settings-api-key');
  const status = document.getElementById('api-key-status');
  if(!input||!status) return;
  const val = input.value.trim() || settingsGetKey();
  if(val.startsWith('sk-ant-') && val.length > 20){
    status.textContent = '✓ 유효';
    status.style.cssText = 'font-size:10px;font-weight:400;padding:1px 7px;border-radius:10px;background:var(--gbg);color:var(--g)';
  } else if(val.length > 0){
    status.textContent = '형식 확인';
    status.style.cssText = 'font-size:10px;font-weight:400;padding:1px 7px;border-radius:10px;background:var(--obg);color:var(--o)';
  } else {
    status.textContent = '미설정';
    status.style.cssText = 'font-size:10px;font-weight:400;padding:1px 7px;border-radius:10px;background:var(--bg3);color:var(--tx3)';
  }
}

function settingsSaveApiKey(){
  const input = document.getElementById('settings-api-key');
  const msg = document.getElementById('settings-key-msg');
  const val = input.value.trim();
  if(!val){ msg.innerHTML='<span style="color:var(--r)">키를 입력해주세요</span>'; return; }
  if(!val.startsWith('sk-ant-')){ msg.innerHTML='<span style="color:var(--o)">Anthropic API 키는 sk-ant- 로 시작합니다</span>'; }
  localStorage.setItem(API_KEY_STORAGE, val);
  settingsUpdateKeyStatus();
  msg.innerHTML='<span style="color:var(--g)">✓ 저장됐습니다</span>';
  setTimeout(()=>msg.innerHTML='', 2000);
}

function settingsClearApiKey(){
  if(!confirm('API 키를 삭제하시겠습니까?')) return;
  localStorage.removeItem(API_KEY_STORAGE);
  document.getElementById('settings-api-key').value = '';
  settingsUpdateKeyStatus();
  const msg = document.getElementById('settings-key-msg');
  msg.innerHTML='<span style="color:var(--tx3)">삭제됐습니다</span>';
  setTimeout(()=>msg.innerHTML='', 2000);
}

function settingsToggleKeyVisible(){
  const input = document.getElementById('settings-api-key');
  input.type = input.type==='password' ? 'text' : 'password';
}

function settingsContractRefresh(){
  const el = document.getElementById('settings-contract-list');
  if(!el) return;
  const years = [...new Set([
    ...Object.keys(CONTRACT), ...Object.keys(CONTRACT_WHEEL), ...Object.keys(CONTRACT_DGU)
  ])].sort().reverse();
  el.innerHTML = years.map(yr=>{
    const body  = CONTRACT[yr]||0;
    const wheel = CONTRACT_WHEEL[yr]||0;
    const dgu   = CONTRACT_DGU[yr]||0;
    return `<div style="padding:8px;background:var(--bg3);border-radius:6px;border:1px solid var(--border);margin-bottom:4px">
      <div style="font-size:12px;font-weight:600;color:var(--tx);margin-bottom:6px">${yr}년</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <label style="font-size:11px;color:var(--tx3);display:flex;align-items:center;gap:4px">
          차체
          <input type="number" value="${body}" step="100000" placeholder="0"
            style="width:100px;padding:3px 6px;font-size:11px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none"
            onchange="CONTRACT['${yr}']=parseInt(this.value)||0;autoSave();updateYearCost()">원
        </label>
        <label style="font-size:11px;color:var(--tx3);display:flex;align-items:center;gap:4px">
          휠
          <input type="number" value="${wheel}" step="100000" placeholder="0"
            style="width:100px;padding:3px 6px;font-size:11px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none"
            onchange="CONTRACT_WHEEL['${yr}']=parseInt(this.value)||0;autoSave();updateYearCost()">원
        </label>
        <label style="font-size:11px;color:var(--tx3);display:flex;align-items:center;gap:4px">
          DGU
          <input type="number" value="${dgu}" step="100000" placeholder="0"
            style="width:100px;padding:3px 6px;font-size:11px;font-family:var(--mono);background:var(--bg2);border:1px solid var(--border2);border-radius:4px;color:var(--tx);outline:none"
            onchange="CONTRACT_DGU['${yr}']=parseInt(this.value)||0;autoSave();updateYearCost()">원
        </label>
      </div>
    </div>`;
  }).join('') || '<div style="font-size:12px;color:var(--tx3)">등록된 연도 없음</div>';
}
// ══════════════════════════════════════════════════════

// NG 읽음 처리 저장: DB에 ngRead = {orderId_key_secName_itemName: true}
function ngInit(){
  const sel = document.getElementById('ng-year-sel');
  if(!sel) return;
  sel.innerHTML = '<option value="all">전체 연도</option>';
  Object.keys(DB.orders).sort().reverse().forEach(yr=>{
    const opt=document.createElement('option');
    opt.value=yr; opt.textContent=yr+'년';
    if(yr===CY) opt.selected=true;
    sel.appendChild(opt);
  });
  ngRefresh();
}

function ngRefresh(){
  const yr = document.getElementById('ng-year-sel')?.value || 'all';
  const bodyYears  = yr==='all' ? Object.keys(DB.orders)       : [yr];
  const wheelYears = yr==='all' ? Object.keys(DB_WHEEL.orders) : [yr];
  const dguYears   = yr==='all' ? Object.keys(DB_DGU.orders)   : [yr];

  // 전체 NG 항목 수집 (차체 + 휠 합산)
  const ngItems = [];
  const collectNG = (orders, y, sysLabel)=>{
    (orders||[]).forEach(order=>{
      if(!order.rsData) return;
      order.specimens.forEach(sp=>{
        const key=`${sp.maker}_${sp.color}`;
        const spData=order.rsData[key]||{};
        sp.sections.forEach(sec=>{
          const secData=spData[sec.name]||{};
          sec.items.filter(it=>it.checked).forEach(it=>{
            const d=secData[it.name];
            if(d?.judge==='fail'){
              const id=`${order.id}_${key}_${sec.name}_${it.name}`;
              ngItems.push({
                id, year:y, order, maker:sp.maker, color:sp.color,
                secName:sec.name, itemName:it.name, value:d.value||{},
                note:d.note||'', read:!!(order.ngRead?.[id]), sys:sysLabel
              });
            }
          });
        });
      });
    });
  };
  bodyYears.forEach(y=>collectNG(DB.orders[y],       y, '차체'));
  wheelYears.forEach(y=>collectNG(DB_WHEEL.orders[y], y, '휠'));
  dguYears.forEach(y=>collectNG(DB_DGU.orders[y],   y, 'DGU'));

  // 뱃지 업데이트
  const unread = ngItems.filter(n=>!n.read).length;
  ngUpdateBadge(unread);

  if(!ngItems.length){
    document.getElementById('ng-body').innerHTML=`
      <div style="text-align:center;padding:60px 20px;color:var(--tx3)">
        
        <div style="font-size:15px;font-weight:600;color:var(--tx2)">NG 항목 없음</div>
        <div style="font-size:12px;margin-top:6px">모든 시험 항목이 합격했거나 아직 결과가 입력되지 않았습니다</div>
      </div>`;
    return;
  }

  // 차수별 그룹핑
  const grouped = {};
  ngItems.forEach(ng=>{
    const gKey=`${ng.year}_${ng.order.id}`;
    if(!grouped[gKey]) grouped[gKey]={year:ng.year, order:ng.order, items:[]};
    grouped[gKey].items.push(ng);
  });

  let html = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;flex-wrap:wrap">
      <span style="font-size:13px;font-weight:700;color:var(--r)">NG ${ngItems.length}건</span>
      ${unread>0?`<span style="font-size:12px;color:var(--tx3)">(미확인 ${unread}건)</span>`:''}
    </div>`;

  Object.values(grouped).forEach(g=>{
    const order=g.order;
    const unreadInGroup=g.items.filter(n=>!n.read).length;
    html+=`
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden">
        <div style="padding:10px 16px;background:var(--bg3);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:11px;font-family:var(--mono);font-weight:700;color:var(--b)">${g.year}년</span>
          <span style="font-size:14px;font-weight:700;color:var(--tx)">${order.cha}</span>
          <span style="font-size:12px;color:var(--tx2)">${(order.purpose||'').slice(0,30)}</span>
          <span style="background:var(--rbg);border:1px solid rgba(248,81,73,.3);border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;color:var(--r);margin-left:auto">NG ${g.items.length}건</span>
          ${unreadInGroup>0?`<span style="background:var(--r);border-radius:10px;padding:2px 8px;font-size:11px;font-weight:700;color:#fff">미확인 ${unreadInGroup}</span>`:''}
        </div>
        <div style="padding:12px 16px">
          ${g.items.map(ng=>ngBuildCard(ng, order)).join('')}
        </div>
      </div>`;
  });

  document.getElementById('ng-body').innerHTML=html;
}

function ngBuildCard(ng, order){
  const isRead=ng.read;
  const valStr=ngFormatValue(ng.itemName, ng.value);
  const sysTag=ng.sys==='휠'?`<span style="font-size:9px;font-weight:700;background:var(--bbg);color:var(--b);border-radius:3px;padding:1px 4px">휠</span>`:'';
  return `<div id="ng-card-${ng.id}" onclick="ngMarkRead('${order.id}','${ng.id}')"
    style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border-radius:8px;margin-bottom:6px;cursor:pointer;border:1px solid ${isRead?'var(--border)':'rgba(248,81,73,.3)'};background:${isRead?'var(--bg3)':'var(--rbg)'};transition:.15s">
    <div style="flex-shrink:0;width:8px;height:8px;border-radius:50%;background:${isRead?'var(--tx3)':'var(--r)'};margin-top:4px"></div>
    <div style="flex:1;min-width:0">
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px">
        ${sysTag}
        <span style="font-family:var(--mono);font-size:12px;font-weight:700;color:${isRead?'var(--tx2)':'var(--tx)'}">${ng.maker}</span>
        <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${isRead?'var(--tx2)':'var(--b)'}">${ng.color}</span>
        <span style="font-size:11px;color:var(--tx3)">›</span>
        <span style="font-size:12px;color:var(--tx2)">${ng.secName}</span>
        <span style="font-size:11px;color:var(--tx3)">›</span>
        <span style="font-size:13px;font-weight:700;color:${isRead?'var(--tx2)':'var(--r)'}">${ng.itemName}</span>
        <span style="font-size:11px;font-weight:700;color:var(--r);background:var(--rbg);border:1px solid rgba(248,81,73,.3);border-radius:4px;padding:1px 6px">FAIL</span>
      </div>
      ${valStr?`<div style="font-size:11px;color:var(--tx2);font-family:var(--mono)">측정값: ${valStr}</div>`:''}
      ${ng.note?`<div style="font-size:11px;color:var(--o);margin-top:2px">비고: ${ng.note}</div>`:''}
    </div>
    <div style="font-size:10px;color:var(--tx3);flex-shrink:0">${isRead?'확인됨':'클릭해서 확인'}</div>
  </div>`;
}

function ngFormatValue(itemName, v){
  if(!v||typeof v!=='object') return '';
  const type=RS_INPUT[itemName]?.type;
  switch(type){
    case 'adhesion':       return v.grade||'';
    case 'impact':         return v.val?v.val+'cm':'';
    case 'hardness':       return v.grade||'';
    case 'water':          return [v.appearance, v.adhesion].filter(Boolean).join(' / ');
    case 'scratch':        return v.retention?`유지율 ${v.retention}%`:'';
    case 'chipping':       return v.grade||'';
    case 'saltspray':      return [v.appearance, v.peeling?`편측 ${v.peeling}mm`:null].filter(Boolean).join(' / ');
    case 'cass':           return [v.mid?`120Hr:${v.mid}`:'', v.final?`240Hr:${v.final}`:''].filter(Boolean).join(' / ');
    case 'wheelThickness': return ['전착','하도','중도','상도','클리어'].map(l=>v[l]?`${l}:${v[l]}µm`:'').filter(Boolean).join(' ');
    // DGU
    case 'knifecut':       return v.cf!==undefined&&v.cf!=='' ? `Cf ${v.cf}%` + (v.saf!==undefined&&v.saf!==''?` / SAf ${v.saf}%`:'') : '';
    case 'shear':
    case 'tear':
    case 'tensile':
    case 'elongation':
    case 'shearModulus':   return v.avg!==undefined&&v.avg!=='' ? `평균 ${v.avg}` : '';
    case 'dguHardness':    return v.avg!==undefined&&v.avg!=='' ? `${v.avg} Hs` : '';
    default: return '';
  }
}

function ngMarkRead(orderId, ngId){
  const yr = document.getElementById('ng-year-sel')?.value;
  const years = yr==='all' ? [...Object.keys(DB.orders), ...Object.keys(DB_WHEEL.orders), ...Object.keys(DB_DGU.orders)] : [yr];
  let order = null;
  years.forEach(y=>{
    if(!order) order=(DB.orders[y]||[]).find(o=>o.id===orderId);
    if(!order) order=(DB_WHEEL.orders[y]||[]).find(o=>o.id===orderId);
    if(!order) order=(DB_DGU.orders[y]||[]).find(o=>o.id===orderId);
  });
  if(!order) return;
  if(!order.ngRead) order.ngRead={};
  order.ngRead[ngId]=true;
  autoSave();
  // 해당 카드만 읽음 처리 (전체 재렌더 X)
  const card=document.getElementById(`ng-card-${ngId}`);
  if(card){
    card.style.background='var(--bg3)';
    card.style.borderColor='var(--border)';
    card.querySelector('div').style.background='var(--tx3)'; // 점 색상
    const lastEl=card.querySelector('div:last-child');
    if(lastEl) lastEl.textContent='확인됨';
  }
  // 뱃지 업데이트
  const allUnread = ngCountUnread();
  ngUpdateBadge(allUnread);
}

function ngMarkAllRead(){
  const yr = document.getElementById('ng-year-sel')?.value || 'all';
  const years = yr==='all' ? Object.keys(DB.orders) : [yr];
  years.forEach(y=>{
    (activeDB().orders[y]||[]).forEach(order=>{
      if(!order.rsData) return;
      order.specimens.forEach(sp=>{
        const key=`${sp.maker}_${sp.color}`;
        sp.sections.forEach(sec=>{
          (order.rsData[key]||{})[sec.name] && sec.items.filter(it=>it.checked).forEach(it=>{
            const d=(order.rsData[key][sec.name]||{})[it.name];
            if(d?.judge==='fail'){
              const id=`${order.id}_${key}_${sec.name}_${it.name}`;
              if(!order.ngRead) order.ngRead={};
              order.ngRead[id]=true;
            }
          });
        });
      });
    });
  });
  autoSave();
  ngRefresh();
  showToast('모든 NG 알림을 확인 처리했습니다','g',2000);
}

function ngCountUnread(){
  let count=0;
  const allOrders=[
    ...Object.values(DB.orders).flat(),
    ...Object.values(DB_WHEEL.orders).flat(),
    ...Object.values(DB_DGU.orders).flat(),
  ];
  allOrders.forEach(order=>{
    if(!order.rsData) return;
    order.specimens.forEach(sp=>{
      const key=`${sp.maker}_${sp.color}`;
      sp.sections.forEach(sec=>{
        sec.items.filter(it=>it.checked).forEach(it=>{
          const d=(order.rsData?.[key]?.[sec.name]||{})[it.name];
          if(d?.judge==='fail'){
            const id=`${order.id}_${key}_${sec.name}_${it.name}`;
            if(!(order.ngRead?.[id])) count++;
          }
        });
      });
    });
  });
  return count;
}

function ngUpdateBadge(count){
  const badge=document.getElementById('ng-badge');
  if(badge){
    badge.textContent=count>0?count:'';
    badge.style.display=count>0?'':'none';
  }
}

// 시험결과 FAIL 입력할 때마다 뱃지 실시간 업데이트
function ngSyncBadge(){
  ngUpdateBadge(ngCountUnread());
}
// Firebase FCM 연동 전: 발송 기록만 로컬 저장 + 토스트 안내
// ══════════════════════════════════════════════════════
function sendNotification(type){
  // 현재 선택된 차수 확인
  let order = null;
  let typeName = '';

  if(type==='middle'){
    order = tkCurrentOrder;
    typeName = '중간결과 (도막두께·광택·ATR)';
  } else if(type==='result'){
    order = rsCurrentOrder;
    typeName = '최종 시험결과';
  } else if(type==='ng'){
    // NG 발송: 전체 NG 요약
    const ngCount = ngCountUnread();
    const totalNg = (() => {
      let c=0;
      Object.values(DB.orders).flat().forEach(o=>{
        if(!o.rsData) return;
        o.specimens.forEach(sp=>{
          const key=`${sp.maker}_${sp.color}`;
          sp.sections.forEach(sec=>{
            sec.items.filter(it=>it.checked).forEach(it=>{
              if((o.rsData?.[key]?.[sec.name]||{})[it.name]?.judge==='fail') c++;
            });
          });
        });
      });
      return c;
    })();
    typeName = `NG 알림 (총 ${totalNg}건)`;
    // NG는 order 없이 전체 발송
    document.getElementById('send-modal-body').innerHTML=`
      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:var(--r);margin-bottom:6px">${typeName}</div>
        <div style="font-size:12px;color:var(--tx2);line-height:1.8">
          <div>미확인 NG: <span style="font-weight:600;color:var(--r)">${ngCount}건</span></div>
          <div>발송 시각: <span style="font-family:var(--mono);color:var(--b)">${new Date().toLocaleString('ko-KR')}</span></div>
        </div>
      </div>
      <div style="background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--o)">
        Firebase 연동 전 단계입니다. 발송 이력만 기록됩니다.
      </div>`;
    document.getElementById('send-modal-confirm').onclick=()=>{
      closeModal('send-notification-modal');
      showToast(` NG 알림 발송 이력이 기록됐습니다. (Firebase 연동 후 실제 발송 가능)`,'b',4000);
    };
    openModal('send-notification-modal');
    return;
  }

  if(!order){
    showToast('먼저 차수를 선택하세요','o',2500);
    return;
  }

  const cha = order.cha || '';
  const purpose = (order.purpose||'').slice(0,30);
  const now = new Date();
  const nowStr = now.toLocaleString('ko-KR');

  if(!order.sendLog) order.sendLog=[];
  const logEntry = {type, typeName, sentAt: now.toISOString(), sentBy:'시험담당자', status:'pending'};

  document.getElementById('send-modal-body').innerHTML=`
    <div style="margin-bottom:16px">
      <div style="font-size:14px;font-weight:700;color:var(--tx);margin-bottom:6px">${typeName}</div>
      <div style="font-size:12px;color:var(--tx2);line-height:1.8">
        <div>차수: <span style="font-weight:600;color:var(--tx)">${cha}</span></div>
        <div>내용: <span style="color:var(--tx)">${purpose}</span></div>
        <div>발송 시각: <span style="font-family:var(--mono);color:var(--b)">${nowStr}</span></div>
      </div>
    </div>
    <div style="background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:6px;padding:10px 12px;font-size:12px;color:var(--o)">
      Firebase 연동 전 단계입니다. 발송 이력만 기록됩니다.
    </div>`;

  document.getElementById('send-modal-confirm').onclick=()=>{
    order.sendLog.push(logEntry);
    autoSave();
    closeModal('send-notification-modal');
    showToast(` ${typeName} 발송 이력이 기록됐습니다. (Firebase 연동 후 실제 발송 가능)`,'b',4000);
  };

  openModal('send-notification-modal');
}

// ══════════════════════════════════════════════════════
// 대시보드
