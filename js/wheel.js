// ======================================================
// wheel.js — 휠도장: 파싱 (noRunParseWheel)
// ======================================================

function noRunParseWheel(){
  const text = document.getElementById('no-mail-text').value.trim();
  if(!text){alert('메일 텍스트를 붙여넣어 주세요');return;}

  const d = {
    makers:[], colorsByMaker:{}, sectionItems:{}, sectionEA:{},
    purpose:'', mgr:'', mailDate:'', totalEa:0,
    wheelPoints:{}, _isWheel: true
  };

  // ── 평가목적: 여러 패턴 (줄바꿈 표 형태, 탭, 콜론)
  const purPatterns = [
    /평가목적\s*\r?\n\s*([^\r\n]{5,100})/,       // 줄바꿈 후 다음 줄 (표 복사 형태)
    /평가목적\s*\t\s*([^\t\r\n]{5,100})/,          // 탭 구분
    /평가목적\s*[：:]\s*([^\r\n]{5,100})/,          // 콜론
    /\[평가의뢰\]\s*([^\r\n]{5,100})/,
  ];
  for(const p of purPatterns){ const m=text.match(p); if(m){d.purpose=m[1].trim();break;} }

  // ── 발신일 (시편발송일, 메일 날짜 등 첫 번째 날짜 사용)
  const dateM = text.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if(dateM) d.mailDate = `${dateM[1]}-${String(dateM[2]).padStart(2,'0')}-${String(dateM[3]).padStart(2,'0')}`;

  // ── 담당자
  const STAFF = ['김환오','채종운','전재철','양지원','이재진'];
  for(const name of STAFF){ if(text.includes(name)){ d.mgr=name; break; } }

  // ── 총 EA (시편 수)
  const eaM = text.match(/총\s*(\d+)\s*EA/i); if(eaM) d.totalEa=parseInt(eaM[1]);

  // ── 차종 코드 파싱 (핵심 개선)
  // "총 3종 (JK PE, RG3, JK HEV)" 형태 — 공백 포함 코드 올바르게 처리
  const bracketM = text.match(/총\s*\d+\s*종\s*[\(（]([^)）\r\n]+)[\)）]/);
  let parsedCodes = [];
  if(bracketM){
    // 쉼표로 분리 후 각각 trim
    const raw = bracketM[1].split(/[,，]/).map(s=>s.trim()).filter(Boolean);
    // 각 항목이 "JK PE", "RG3", "JK HEV" 형태 — 그대로 사용
    parsedCodes = raw.filter(s=>s.length>=2 && /[A-Z]/.test(s));
  }

  // ── 업체명 감지 (알려진 업체 목록)
  const WHEEL_MAKERS = ['현대성우캐스팅','현대성우','핸즈','명화','서진','우신'];
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const makerSet = new Set();
  const colorMap = {};

  // 줄별 업체명 + 차종 분리 감지
  // 형태: "현대성우캐스팅: JK PE, RG3" 또는 "- 현대성우캐스팅 JK PE"
  for(const line of lines){
    let foundMaker = null;
    for(const mk of WHEEL_MAKERS){
      if(line.includes(mk)){ foundMaker=mk; break; }
    }
    if(foundMaker){
      makerSet.add(foundMaker);
      if(!colorMap[foundMaker]) colorMap[foundMaker]=[];
      // 해당 줄에서 차종코드 추출 (업체명 제거 후)
      const afterMaker = line.replace(foundMaker,'').replace(/^[:\s\-]+/,'');
      if(afterMaker){
        const codes = afterMaker.split(/[,，]/).map(s=>s.trim()).filter(s=>s.length>=2&&/[A-Z]/.test(s));
        codes.forEach(c=>{ if(!colorMap[foundMaker].includes(c)) colorMap[foundMaker].push(c); });
      }
    }
    // 측정 포인트 감지
    const pts = line.match(/(수직부|수평부|엣지부|측면부|하단부|중앙부)/g)||[];
    if(pts.length){
      const mk = [...makerSet].slice(-1)[0] || '전체';
      if(!d.wheelPoints[mk]) d.wheelPoints[mk]=new Set();
      pts.forEach(p=>d.wheelPoints[mk].add(p));
    }
  }

  // ── 차종 배정
  if(parsedCodes.length){
    if(makerSet.size===0){
      // 업체 감지 안 됨 → '미지정'으로
      colorMap['미지정'] = parsedCodes;
      makerSet.add('미지정');
    } else {
      // 업체는 있는데 차종 배정 안 된 경우 → 균등 배분
      const mks=[...makerSet];
      mks.forEach(mk=>{
        if(!colorMap[mk]||colorMap[mk].length===0) colorMap[mk]=[...parsedCodes];
      });
    }
  }

  d.makers = [...makerSet];
  if(!d.makers.length){ d.makers=['미지정']; colorMap['미지정']=parsedCodes; }
  d.colorsByMaker = colorMap;
  Object.keys(d.wheelPoints).forEach(k=>{ d.wheelPoints[k]=[...d.wheelPoints[k]]; });

  // ── 시험항목
  const hasTK       = /도막두께/i.test(text);
  const hasIR       = /IR\s*측정|IR\s*분析|FT-IR/i.test(text);
  const hasCASS     = /CASS/i.test(text);
  const hasSST      = /내염수분무성|SST/i.test(text);
  const hasWater    = /내수성/i.test(text);
  const hasHumid    = /내습성/i.test(text);
  const hasChip     = /내치핑성/i.test(text);
  const hasAdhesion = /부착성/i.test(text);

  const items=[];
  if(hasTK){ items.push('도막두께'); items.push('도막두께-전처리'); }
  if(hasAdhesion) items.push('부착성');
  if(hasWater)    items.push('내수성');
  if(hasHumid)    items.push('내습성');
  if(hasChip)     items.push('내치핑성');
  if(hasSST)      items.push('내염수분무성');
  if(hasCASS)     items.push('CASS시험');
  if(hasIR)       items.push('IR분석');
  d.sectionItems['완성도막'] = items.length ? items : [...DEFAULT_ITEMS_WHEEL['완성도막']];
  d.sectionEA['완성도막'] = d.totalEa||1;

  noParsedData = d;

  // ── 필드 자동채우기
  if(d.purpose) document.getElementById('no-purpose').value = d.purpose;
  if(d.mailDate) document.getElementById('no-date').value = d.mailDate;
  else document.getElementById('no-date').value = new Date().toISOString().slice(0,10);
  if(d.mgr){ const sel=document.getElementById('no-mgr'); [...sel.options].forEach(o=>o.selected=o.value===d.mgr); }
  // 업체가 미지정이면 업체란 비워두기 (직접 입력 유도)
  const realMakers = d.makers.filter(m=>m!=='미지정');
  document.getElementById('no-maker').value = realMakers.join(', ');
  const allColors=[...new Set(Object.values(d.colorsByMaker).flat())];
  document.getElementById('no-colors').value = allColors.join(',');
  noRebuildColorRows();
  if(d.totalEa) document.getElementById('no-cnt').value = d.totalEa;

  // ── 파싱 요약 표시
  const mkTag=v=>`<span style="background:var(--bbg);border:1px solid rgba(56,139,253,.3);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
  const clTag=v=>`<span style="background:var(--bg4);border:1px solid var(--border2);border-radius:4px;padding:1px 7px;font-family:var(--mono);font-size:11px;margin-right:3px">${v}</span>`;
  const itTag=v=>`<span style="background:var(--gbg);border:1px solid rgba(45,164,78,.25);border-radius:3px;padding:1px 6px;font-size:11px;margin-right:2px;margin-bottom:2px;display:inline-block">${v}</span>`;
  const row=(k,v)=>`<div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:5px"><span style="color:var(--tx3);width:75px;flex-shrink:0;font-size:11px;padding-top:2px">${k}</span><span style="flex:1">${v}</span></div>`;

  const warnings=[];
  let rows='';

  // 업체 표시
  if(realMakers.length){
    rows += row('업체', realMakers.map(mkTag).join(''));
    realMakers.forEach(mk=>{
      const cols=d.colorsByMaker[mk]||[];
      if(cols.length) rows+=row(`└ ${mk}`, cols.map(clTag).join('')+`<span style="font-size:11px;color:var(--tx3);margin-left:4px">${cols.length}종</span>`);
    });
  } else {
    // 업체 없이 차종만 있는 경우
    rows += row('업체', `<span style="color:var(--o);font-size:11px">미감지 — 아래 업체 필드 직접 입력</span>`);
    rows += row('차종', allColors.map(clTag).join('')+`<span style="font-size:11px;color:var(--tx3);margin-left:4px">${allColors.length}종</span>`);
    warnings.push('업체명이 감지되지 않았습니다. 아래 업체명 필드에 직접 입력해주세요.<br><span style="font-size:10px;color:var(--tx3)">예: 현대성우캐스팅, 핸즈</span>');
  }

  rows += row('시험항목', d.sectionItems['완성도막'].map(itTag).join(''));

  const pts=Object.entries(d.wheelPoints);
  if(pts.length) pts.forEach(([mk,pp])=>{
    rows+=row('측정포인트',`<span style="font-size:11px;color:var(--tx2)">${Array.isArray(pp)?pp.join(', '):[...pp].join(', ')}</span>`);
  });

  // 파싱 안 된 항목 경고
  if(!d.purpose) warnings.push('평가목적 미감지 — 목적 필드를 직접 입력해주세요.');
  if(!allColors.length) warnings.push('차종코드 미감지 — 색상코드 필드를 직접 입력해주세요.');

  const warnHtml=warnings.map(w=>`<div style="margin-top:5px;padding:6px 10px;background:var(--obg);border:1px solid rgba(210,153,34,.3);border-radius:4px;font-size:11px;color:var(--o)">${w}</div>`).join('');

  document.getElementById('no-parse-summary').innerHTML=`
    <div style="font-size:11px;font-weight:700;color:var(--g);margin-bottom:8px">✓ 휠도장 파싱 완료</div>
    <div style="font-size:12px">${rows}</div>${warnHtml}`;
  document.getElementById('no-step1').style.display='none';
  document.getElementById('no-step2').style.display='block';
}
