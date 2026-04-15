// ======================================================
// // dashboard.js — 대시보드 (차체·휠·DGU 내부 분기)
// 의존: common.js
// ======================================================

// ══════════════════════════════════════════════════════
// 대시보드
// ══════════════════════════════════════════════════════
function dbInit(){
  const sel=document.getElementById('db-year-sel');
  if(!sel) return;
  sel.innerHTML='';
  Object.keys(DB.orders).sort().reverse().forEach(yr=>{
    const opt=document.createElement('option');
    opt.value=yr; opt.textContent=yr+'년';
    if(yr===CY) opt.selected=true;
    sel.appendChild(opt);
  });
  dbRefresh();
}

function dbRefresh(){
  const yr=document.getElementById('db-year-sel')?.value||CY;

  // ── 계약금액: 차체+휠 합산 (같은 계약)
  const bodyContract = CONTRACT[yr]||0;
  const wheelContract = CONTRACT_WHEEL[yr]||0;
  const dguContract = CONTRACT_DGU[yr]||0;
  const contract = bodyContract + wheelContract + dguContract;
  const {bodyUsed, wheelUsed, dguUsed, total: used} = calcTotalUsed(yr);
  const remain=contract-used;
  const pct=contract?Math.min(100,Math.round(used/contract*100)):0;

  // ── 현재 시스템 차수만 통계 (탭에 따라)
  const orders = activeDB().orders[yr]||[];
  const statusCount={wait:0,ip:0,done:0};
  orders.forEach(o=>{ statusCount[o.status]=(statusCount[o.status]||0)+1; });

  // ── NG 목록
  const ngList=[];
  orders.forEach(o=>{
    o.specimens.forEach(sp=>{
      const key=`${sp.maker}_${sp.color}`;
      sp.sections.forEach(sec=>{
        sec.items.filter(it=>it.checked).forEach(it=>{
          const d=o.rsData?.[key]?.[sec.name]?.[it.name];
          if(d?.judge==='fail') ngList.push({order:o,maker:sp.maker,color:sp.color,sec:sec.name,item:it.name,read:!!(o.ngRead?.[`${o.id}_${key}_${sec.name}_${it.name}`])});
        });
      });
    });
  });

  // ── 시료수령 비고
  const noteList=[];
  orders.forEach(o=>{
    o.specimens.forEach(sp=>{
      sp.sections.forEach(sec=>{
        if(sec.receiptNote&&sec.receiptNote.trim()){
          noteList.push({order:o,maker:sp.maker,color:sp.color,sec:sec.name,note:sec.receiptNote});
        }
      });
    });
  });

  // ── 진행 중인 차수 (ip 상태)
  const ipOrders=orders.filter(o=>o.status==='ip');
  const waitOrders=orders.filter(o=>o.status==='wait');

  // ── HTML 생성
  const barColor=pct>=90?'var(--r)':pct>=70?'var(--o)':'var(--b)';
  const remainColor=remain<0?'var(--r)':'var(--g)';

  document.getElementById('db-body').innerHTML=`
    <!-- 상단 KPI 카드 -->
    <div class="db-grid">
      <!-- 계약 현황 -->
      <div class="db-card" style="grid-column:span 2">
        <div class="db-card-title">💰 ${yr}년 계약 현황 <span style="font-size:10px;color:var(--tx3);font-weight:400">(차체+휠 합산)</span></div>
        <div style="display:flex;gap:20px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">
          <div>
            <div style="font-size:11px;color:var(--tx3)">계약 총액</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--tx)">${contract?contract.toLocaleString()+'원':'미설정'}</div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--tx3)">사용 비용</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:var(--o)">${used.toLocaleString()}원</div>
            <div style="font-size:10px;color:var(--tx3);margin-top:2px">
              차체 ${bodyUsed.toLocaleString()} · 휠 ${wheelUsed.toLocaleString()} · DGU ${dguUsed.toLocaleString()}
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--tx3)">잔여</div>
            <div style="font-family:var(--mono);font-size:20px;font-weight:700;color:${remainColor}">${contract?(remain<0?'초과 ':'')+Math.abs(remain).toLocaleString()+'원':'—'}</div>
          </div>
          <div style="margin-left:auto;text-align:right">
            <div style="font-size:28px;font-weight:700;font-family:var(--mono);color:${barColor}">${pct}%</div>
            <div style="font-size:11px;color:var(--tx3)">소진율</div>
          </div>
        </div>
        <div class="db-progress"><div class="db-progress-bar" style="width:${pct}%;background:${barColor}"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--tx3)"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>

      <!-- 차수 현황 -->
      <div class="db-card">
        <div class="db-card-title"> 차수 현황 <span style="color:var(--b)">${orders.length}건</span></div>
        <div style="display:flex;gap:12px;margin-bottom:10px">
          ${[
            {label:'대기',count:statusCount.wait||0,color:'var(--tx3)',bg:'var(--bg3)'},
            {label:'진행중',count:statusCount.ip||0,color:'var(--b)',bg:'var(--bbg)'},
            {label:'완료',count:statusCount.done||0,color:'var(--g)',bg:'var(--gbg)'},
          ].map(s=>`<div style="flex:1;text-align:center;padding:8px;background:${s.bg};border-radius:6px">
            <div style="font-size:20px;font-weight:700;font-family:var(--mono);color:${s.color}">${s.count}</div>
            <div style="font-size:10px;color:var(--tx3)">${s.label}</div>
          </div>`).join('')}
        </div>
      </div>

      <!-- 이번 달 진행현황 -->
      <div class="db-card">
        ${(()=>{
          const now=new Date();
          const thisMonth=now.getMonth();
          const thisYear=now.getFullYear();
          const monthOrders=orders.filter(o=>{
            if(!o.date) return false;
            const d=new Date(o.date);
            return d.getFullYear()===thisYear && d.getMonth()===thisMonth;
          });
          const monthCost=monthOrders.reduce((s,o)=>s+calcOrderCost(o),0);
          // 이번 달 등록
          const added=monthOrders.length;
          // 이번 달 완료
          const completed=monthOrders.filter(o=>o.status==='done').length;
          // 이번 달 검수 완료 시편 수
          const specDone=monthOrders.flatMap(o=>o.specimens.flatMap(sp=>sp.sections)).filter(s=>s.receiptOk).length;
          const specTotal=monthOrders.flatMap(o=>o.specimens.flatMap(sp=>sp.sections)).length;
          const monthLabel=`${thisYear}년 ${thisMonth+1}월`;
          return `<div class="db-card-title">📅 ${monthLabel} 진행현황</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div style="padding:8px;background:var(--bg3);border-radius:6px;text-align:center">
              <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--b)">${added}</div>
              <div style="font-size:10px;color:var(--tx3)">신규 등록</div>
            </div>
            <div style="padding:8px;background:var(--bg3);border-radius:6px;text-align:center">
              <div style="font-size:18px;font-weight:700;font-family:var(--mono);color:var(--g)">${completed}</div>
              <div style="font-size:10px;color:var(--tx3)">완료</div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:11px;color:var(--tx3)">이번 달 검수</span>
            <span style="font-family:var(--mono);font-size:11px;color:${specDone===specTotal&&specTotal>0?'var(--g)':'var(--tx2)'}">${specDone}/${specTotal}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--tx3)">이번 달 비용</span>
            <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--o)">${monthCost.toLocaleString()}원</span>
          </div>`;
        })()}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <!-- 진행 중 차수 -->
      <div class="db-card">
        <div class="db-card-title">🔄 진행 중 차수 (${ipOrders.length}건)</div>
        ${ipOrders.length?ipOrders.slice(0,8).map(o=>{
          const total=o.specimens.flatMap(sp=>sp.sections).length;
          const done=o.specimens.flatMap(sp=>sp.sections).filter(s=>s.receiptOk).length;
          const pct2=total?Math.round(done/total*100):0;
          return `<div class="db-order-row" onclick="nav('orders',document.querySelector('.nav-item[onclick*=orders]'));selectOrder('${o.id}')">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:12px;font-weight:700;color:var(--tx)">${o.cha}</span>
                <span style="font-size:11px;color:var(--tx3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(o.purpose||'').slice(0,20)}</span>
              </div>
              <div style="height:3px;background:var(--bg4);border-radius:2px;margin-top:5px;overflow:hidden">
                <div style="height:100%;width:${pct2}%;background:var(--b);border-radius:2px"></div>
              </div>
            </div>
            <span style="font-size:11px;font-family:var(--mono);color:var(--b);flex-shrink:0">${done}/${total}</span>
          </div>`;
        }).join(''):'<div style="color:var(--tx3);font-size:12px;padding:10px 0;text-align:center">진행 중인 차수 없음</div>'}
        ${waitOrders.length?`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:10px;color:var(--tx3);margin-bottom:4px">대기 중 ${waitOrders.length}건</div>
          ${waitOrders.slice(0,4).map(o=>`<div class="db-order-row" style="opacity:.6" onclick="nav('orders',null);selectOrder('${o.id}')">
            <span style="font-size:11px;color:var(--tx)">${o.cha}</span>
            <span style="font-size:11px;color:var(--tx3);flex:1;margin-left:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(o.purpose||'').slice(0,18)}</span>
            <span class="badge wait" style="font-size:10px">대기</span>
          </div>`).join('')}
        </div>`:''}
      </div>

      <!-- NG 현황 — 클릭하면 확인 처리 -->
      <div class="db-card">
        <div class="db-card-title">⚠️ NG 현황 (${ngList.length}건 / 미확인 ${ngList.filter(n=>!n.read).length}건)</div>
        ${ngList.length?ngList.slice(0,8).map(ng=>{
          const ngId=`${ng.order.id}_${ng.maker}_${ng.color}_${ng.sec}_${ng.item}`;
          return `<div class="db-ng-item" id="db-ng-${ngId.replace(/[^a-zA-Z0-9]/g,'_')}"
            style="cursor:pointer;${ng.read?'opacity:.5':''}"
            onclick="dbDismissNG(this,'${ng.order.id}','${ng.maker}','${ng.color}','${ng.sec}','${ng.item}','${yr}')"
            title="클릭해서 확인 처리">
            <div style="width:6px;height:6px;border-radius:50%;background:${ng.read?'var(--tx3)':'var(--r)'};flex-shrink:0;margin-top:1px"></div>
            <div style="flex:1;min-width:0">
              <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--b)">${ng.color}</span>
              <span style="font-size:11px;color:var(--tx3)"> › ${ng.sec} › </span>
              <span style="font-size:11px;font-weight:700;color:${ng.read?'var(--tx3)':'var(--r)'}">${ng.item}</span>
            </div>
            <span style="font-size:10px;color:var(--tx3);flex-shrink:0">${ng.order.cha}</span>
            ${!ng.read?`<span style="font-size:10px;color:var(--tx3);margin-left:4px">✕</span>`:'<span style="font-size:10px;color:var(--g);margin-left:4px">✓</span>'}
          </div>`;
        }).join('')
        :'<div style="color:var(--tx3);font-size:12px;padding:10px 0;text-align:center">✓ NG 없음</div>'}
        ${ngList.length>8?`<div style="text-align:center;margin-top:6px"><button onclick="nav('notifications',document.querySelector('.nav-item[onclick*=notifications]'));ngInit()" class="btn sm" style="font-size:11px">전체 보기 (${ngList.length}건)</button></div>`:''}
      </div>
    </div>

    <!-- 차수 전체 목록 요약 -->
    <div class="db-card">
      <div class="db-card-title">📊 ${yr}년 차수 전체 요약 (${orders.length}건)</div>
      ${orders.length?`<div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:var(--bg4)">
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700;white-space:nowrap">차수</th>
            <th style="padding:6px 10px;text-align:left;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700">평가목적</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700;white-space:nowrap">업체/색상</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700;white-space:nowrap">검수</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700;white-space:nowrap">시험결과</th>
            <th style="padding:6px 10px;text-align:right;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700;white-space:nowrap">비용</th>
            <th style="padding:6px 10px;text-align:center;border-bottom:1px solid var(--border);color:var(--tx3);font-weight:700">상태</th>
          </tr></thead>
          <tbody>
            ${orders.map(o=>{
              const makers=[...new Set(o.specimens.map(sp=>sp.maker))].join(', ');
              const colorCnt=o.specimens.length;
              const secs=o.specimens.flatMap(sp=>sp.sections);
              const recDone=secs.filter(s=>s.receiptOk).length;
              const cost=calcOrderCost(o);
              let oPass=0,oFail=0;
              o.specimens.forEach(sp=>{
                const key=`${sp.maker}_${sp.color}`;
                sp.sections.forEach(sec=>{
                  sec.items.filter(it=>it.checked).forEach(it=>{
                    const d=o.rsData?.[key]?.[sec.name]?.[it.name];
                    if(d?.judge==='pass') oPass++;
                    else if(d?.judge==='fail') oFail++;
                  });
                });
              });
              const statusMap={wait:'<span class="badge wait">대기</span>',ip:'<span class="badge ip">진행중</span>',done:'<span class="badge pass">완료</span>'};
              return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="nav('orders',null);selectOrder('${o.id}')" onmouseover="this.style.background='var(--bg3)'" onmouseout="this.style.background=''">
                <td style="padding:6px 10px;font-weight:700;color:var(--tx);white-space:nowrap">${o.cha}</td>
                <td style="padding:6px 10px;color:var(--tx2);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.purpose||'—'}</td>
                <td style="padding:6px 10px;text-align:center;color:var(--tx2)">${makers} · ${colorCnt}종</td>
                <td style="padding:6px 10px;text-align:center;font-family:var(--mono);color:${recDone===secs.length&&secs.length>0?'var(--g)':'var(--tx2)'}">${recDone}/${secs.length}</td>
                <td style="padding:6px 10px;text-align:center">
                  ${oFail>0?`<span style="color:var(--r);font-weight:700">NG ${oFail}건</span>`
                  :oPass>0?`<span style="color:var(--g)">합격 ${oPass}건</span>`
                  :'<span style="color:var(--tx3)">미입력</span>'}
                </td>
                <td style="padding:6px 10px;text-align:right;font-family:var(--mono);color:var(--o)">${cost.toLocaleString()}원</td>
                <td style="padding:6px 10px;text-align:center">${statusMap[o.status]||''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`:'<div style="color:var(--tx3);font-size:12px;padding:20px;text-align:center">등록된 차수가 없습니다</div>'}
    </div>`;

  // 시료수령 비고 — 토스트 메시지로 순차 표시
  dbShowNoteToasts(noteList, yr);
}

function dbDismissNG(el, orderId, maker, color, sec, item, yr){
  const order=(activeDB().orders[yr]||[]).find(o=>o.id===orderId); if(!order) return;
  // ngRead에 확인 기록 (NG 알림 탭과 공유)
  if(!order.ngRead) order.ngRead={};
  const key=`${orderId}_${maker}_${color}_${sec}_${item}`;
  order.ngRead[key]=true;
  autoSave();
  // DOM 즉시 업데이트: 확인됨으로 표시 후 페이드
  el.style.transition='opacity .3s';
  el.style.opacity='0.35';
  const dot=el.querySelector('div');
  if(dot) dot.style.background='var(--tx3)';
  const itemSpan=el.querySelectorAll('span')[1];
  if(itemSpan) itemSpan.style.color='var(--tx3)';
  const lastSpan=el.querySelector('span:last-child');
  if(lastSpan){ lastSpan.textContent='✓'; lastSpan.style.color='var(--g)'; }
  // 타이틀 미확인 카운트 업데이트
  const title=el.closest('.db-card')?.querySelector('.db-card-title');
  if(title){
    const remaining=el.closest('.db-card').querySelectorAll('.db-ng-item:not([style*="opacity: 0.35"]):not([style*="opacity:0.35"])').length - 1;
    title.innerHTML=title.innerHTML.replace(/미확인 \d+건/,`미확인 ${Math.max(0,remaining)}건`);
  }
  // NG 알림 뱃지도 업데이트
  ngSyncBadge();
}

// 시료수령 비고 토스트
function dbShowNoteToasts(noteList, yr){
  if(!noteList||!noteList.length) return;

  // 이미 확인한 비고는 제외 (DB에 noteRead 기록)
  const unread = noteList.filter(n=>{
    const readKey=`noteRead_${n.order.id}_${n.maker}_${n.color}_${n.sec}`;
    return !n.order.noteRead?.[readKey];
  });
  if(!unread.length) return;

  // 좌측 하단에 쌓이는 카드 형태
  const container = document.getElementById('db-note-container') || (() => {
    const el = document.createElement('div');
    el.id = 'db-note-container';
    el.style.cssText = 'position:fixed;bottom:20px;left:220px;z-index:200;display:flex;flex-direction:column-reverse;gap:8px;max-width:340px';
    document.body.appendChild(el);
    return el;
  })();

  // 기존 카드 초기화
  container.innerHTML = '';

  unread.slice(0, 5).forEach((n, i) => {
    const readKey = `noteRead_${n.order.id}_${n.maker}_${n.color}_${n.sec}`;
    const card = document.createElement('div');
    card.style.cssText = `background:var(--bg2);border:1px solid rgba(210,153,34,.4);border-left:3px solid var(--o);border-radius:8px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,.12);animation:sup .25s ease;cursor:default`;
    card.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:8px">
        <span style="font-size:16px;flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span style="font-size:10px;font-weight:700;color:var(--tx3)">${n.order.cha}</span>
            <span style="font-family:var(--mono);font-size:11px;font-weight:700;color:var(--b)">${n.color}</span>
            <span style="font-size:10px;color:var(--tx3)">${n.sec}</span>
          </div>
          <div style="font-size:12px;color:var(--o);line-height:1.4">${n.note}</div>
        </div>
        <button onclick="dbDismissNote(this,'${n.order.id}','${readKey}','${yr}')"
          style="background:none;border:none;color:var(--tx3);cursor:pointer;font-size:16px;padding:0;flex-shrink:0;line-height:1" title="확인">✕</button>
      </div>`;
    container.appendChild(card);
  });

  if(unread.length > 5){
    const more = document.createElement('div');
    more.style.cssText = 'font-size:11px;color:var(--tx3);text-align:center;padding:4px';
    more.textContent = `외 ${unread.length - 5}건 더 있음`;
    container.appendChild(more);
  }
}

function dbDismissNote(btn, orderId, readKey, yr){
  const order = (activeDB().orders[yr]||[]).find(o=>o.id===orderId);
  if(order){
    if(!order.noteRead) order.noteRead={};
    order.noteRead[readKey] = true;
    autoSave();
  }
  // 카드 제거
  const card = btn.closest('div[style*="border-left"]');
  if(card){
    card.style.opacity='0'; card.style.transition='opacity .2s';
    setTimeout(()=>card.remove(), 200);
  }
}
