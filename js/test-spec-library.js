// ============================================================
// test-spec-library.js — 차체도장 표준 시험 라이브러리
// ============================================================
// 출처: MS653-01 (도료-차체용 상도) 14개 평가항목
// 역할: 항목별 시험방법 / 장비 / 결과형식 / 요구사항(스펙) / 판정규칙
//       → 자동 합격·NG 판정 + 보고서 자동생성의 단일 진실원천(SSOT)
//
// 변동 스펙 3개 (variableSpec: true): 도막두께 / 광택 / 내스크래치성
//   → 차수 등록 시 입력받아 order.specOverride 에 저장, 판정 시 우선 적용
// 나머지 11개는 고정 스펙.
// ============================================================

window.TEST_SPEC_LIBRARY = {

  '도막두께': {
    method: '두께 보정된 도막두께 측정기로 시편 중앙 부근 3개소 이상 측정, 평균치. BASE/CLEAR는 3회 측정 평균.',
    methodShort: '도막Gauge',
    equipment: '도막두께 측정기',
    resultType: 'thickness',   // 층별 수치 입력 (전착/중도/BASE/CLEAR)
    layers: ['전착', '중도', 'BASE', 'CLEAR'],
    unit: '㎛',
    variableSpec: true,
    // 차수 미입력 시 기본값 (보고서 5차 기준)
    defaultSpec: { '전착': '16±2', '중도': '35±2', 'BASE': '측정치 기입', 'CLEAR': '40±2' },
    judge: { type: 'thickness_range' },  // 각 층 범위 비교
  },

  '광택': {
    method: 'ISO 2813. 완성도막 20도법 / 중도·무광 60도법, 3회 측정 평균.',
    methodShort: 'ISO 2813',
    equipment: '광택계 (BYK사)',
    resultType: 'number',
    unit: 'GU',
    variableSpec: true,
    // 무광/유광/중도에 따라 측정법·기준·비교방식 달라짐
    specPresets: {
      '완성도막(유광)': { 측정법: '20도법', 비교: 'min',   기준: 88 },
      '중도도막':       { 측정법: '60도법', 비교: 'min',   기준: 75 },
      '무광':           { 측정법: '60도법', 비교: 'range', center: 25, tol: 2 },
    },
    defaultSpec: { 측정법: '20도법', 비교: 'min', 기준: 88 },
    judge: { type: 'gloss' },  // 비교방식(min/range)을 스펙에서 읽음
  },

  '부착성': {
    method: '바둑목법: 도막에 10×10 격자(100눈)를 긋고 Nichiban 테이프로 45°/0.5초 박리, 등급 판정.',
    methodShort: '바둑목법',
    equipment: 'Cross Cut Guide, Nichiban Tape (JIS Z 1522)',
    resultType: 'grade_M',     // M-1.0 ~ M-5
    unit: '등급',
    variableSpec: false,
    spec: 'M-2.5 이상',
    judge: { type: 'grade_M', threshold: 2.5 },  // M값 ≤ 2.5 합격 (작을수록 좋음)
  },

  '재도장성': {
    method: '연마 후 재도장부에 부착성(바둑목법) 평가.',
    methodShort: '바둑목법(재도장부)',
    equipment: 'Cross Cut Guide, Nichiban Tape',
    resultType: 'grade_M',
    unit: '등급',
    variableSpec: false,
    spec: 'M-2.5 이상',
    judge: { type: 'grade_M', threshold: 2.5 },
  },

  '층간부착성': {
    method: '샌딩/미샌딩부에 부착성(바둑목법) 평가.',
    methodShort: '바둑목법(층간)',
    equipment: 'Cross Cut Guide, Nichiban Tape',
    resultType: 'grade_M',
    unit: '등급',
    variableSpec: false,
    spec: 'M-2.5 이상',
    judge: { type: 'grade_M', threshold: 2.5 },
  },

  'O/B층간부착성': {
    method: 'OVERBAKING 후 부착성(바둑목법) 평가.',
    methodShort: '바둑목법(O/B층간)',
    equipment: 'Cross Cut Guide, Nichiban Tape',
    resultType: 'grade_M',
    unit: '등급',
    variableSpec: false,
    spec: 'M-2.5 이상',
    judge: { type: 'grade_M', threshold: 2.5 },
  },

  '내충격성': {
    method: '듀퐁식 충격시험기(500±1g 추), 10cm 단위로 충격, 잔금/박리 없는 최대 낙하거리 조사 (최대 50cm).',
    methodShort: '듀퐁 (500g)',
    equipment: 'DuPont식 충격 시험기',
    resultType: 'number',
    unit: 'cm',
    variableSpec: false,
    spec: '20cm 이상',
    judge: { type: 'min', threshold: 20 },
  },

  '경도': {
    method: '규정연필(KS G 2603), 1000gf 하중·5mm/s로 20mm씩 5회. 자국 상태로 등급 판정.',
    methodShort: '연필경도',
    equipment: '연필경도 시험기',
    resultType: 'grade_pencil',  // 6B~6H
    unit: '경도',
    variableSpec: false,
    spec: '연필경도 B 이상 (5회중 4회 3급 이상)',
    judge: { type: 'grade_pencil', threshold: 'B' },
  },

  '내수성': {
    method: '40±1℃ 순수에 240Hr 침적 → 상온 1Hr → 외관 육안확인 + 부착성 평가.',
    methodShort: '침적 240h/40℃',
    equipment: '내수성 시험기, Cross Cut Guide',
    resultType: 'appearance_grade',  // 외관(양호/이상) + 부착성 등급
    unit: '',
    variableSpec: false,
    spec: '외관 이상無(연화/백화/광택불량/벗겨짐/부풀음/변색) + 부착성 M-2.5↑',
    judge: { type: 'appearance_grade', threshold: 2.5 },
  },

  '내습성': {
    method: '50±2℃·98±2%RH 항온항습조 96Hr → 상온 1Hr → 외관 육안확인 + 부착성 평가.',
    methodShort: '50℃/98%RH/96h',
    equipment: '항온항습조, Cross Cut Guide',
    resultType: 'appearance_grade',
    unit: '',
    variableSpec: false,
    spec: '외관 이상無 + 부착성 M-2.5↑',
    judge: { type: 'appearance_grade', threshold: 2.5 },
  },

  '내스크래치성': {
    method: 'AMTEC-KISTLER 세차성 시험기로 초기광택(20도) 측정 → 세차 10회 왕복 → 세정/24h 방치 후 재측정. 광택 유지율(%) 계산.',
    methodShort: 'CAR WASHER (AMTEC)',
    equipment: 'AMTEC-KISTLER 세차성 시험기',
    resultType: 'scratch',     // 4칸 입력: 초기광택/세정전/세정후/24시간후 → 유지율 자동
    // 보고서 표기 순서: 세정 전 / 세정 후 / 24시간 후 / 최종결과(유지율%)
    fields: ['초기광택', '세정전', '세정후', '24시간후'],
    unit: '%',
    variableSpec: true,
    // 유지율 = 24시간후 ÷ 초기광택 × 100  (검증: 78.4/89.6≈88%, 78.1/86.8=90%)
    retentionFormula: '24시간후 ÷ 초기광택 × 100',
    defaultSpec: { 기준: 55, 비교: 'min' },  // 1K 55% / 2K 65% 등 프로젝트별 변동
    judge: { type: 'min', field: '기준' },    // 판정 대상 = 계산된 유지율
  },

  '내치핑성': {
    method: 'GRAVELOMETER(SAE J400), -20±3℃, 치핑스톤 50g, 압력 4±0.2Kgf/㎠·45도(칩프라이머 5±0.2·90도) 분사. 칩 등급 판정.',
    methodShort: 'CHIP -20℃,3h/45°',
    equipment: '내한챔버(-20℃), GRAVELOMETER',
    resultType: 'grade_chip',  // 1~6급
    unit: '급',
    variableSpec: false,
    spec: '3급 이상 (박리 직경 2mm 초과 시 불합격)',
    judge: { type: 'grade_chip', threshold: 3 },  // 급수 ≤ 3 합격
  },

  '내염수분무성': {
    method: '염수분무시험기, X자 크로스컷, 35±2℃·95%RH·염수5±1wt%·pH6.5~7.2, 500Hr. 편측 박리 폭(mm) 측정.',
    methodShort: 'SST 500h',
    equipment: 'SST (염수분무시험기)',
    resultType: 'number',
    unit: 'mm',
    variableSpec: false,
    spec: '편측 3mm 박리 없을 것',
    judge: { type: 'max', threshold: 3 },  // 박리폭 ≤ 3mm 합격 (작을수록 좋음)
  },

  'ATR분석': {
    method: 'IR SPECTROMETER, IPA 세정 → ATR 측정 → 성분 PEAK 표시.',
    methodShort: 'IR (ATR)',
    equipment: 'IR SPECTROMETER',
    resultType: 'image',  // 그래프 이미지 첨부
    unit: '',
    variableSpec: false,
    spec: 'IR측정(PEAK 위치 표시) 그래프 송부',
    judge: { type: 'attach' },  // 첨부만, 합격/NG 판정 없음
  },

};

// ============================================================
// 등급 스케일 (UI 드롭다운 & 판정용)
// ============================================================

// 부착성 M등급 (작을수록 좋음). M-2.5는 M-2와 M-3 사이.
window.GRADE_M_SCALE = ['M-1.0', 'M-2.0', 'M-2.5', 'M-3.0', 'M-4.0', 'M-5.0'];

// 칩 등급 (작을수록 좋음)
window.GRADE_CHIP_SCALE = ['1급', '2급', '3급', '4급', '5급', '6급'];

// 연필경도 (왼쪽이 무름, 오른쪽이 단단). B 이상 = 6B~6H 중 B보다 단단한 쪽.
window.GRADE_PENCIL_SCALE = ['6B','5B','4B','3B','2B','B','HB','F','H','2H','3H','4H','5H','6H'];

// ============================================================
// 판정 엔진 — 측정값과 스펙 비교 → 'pass' | 'ng' | 'na'
// ============================================================
window.judgeResult = function (itemName, resultValue, specOverride) {
  const lib = window.TEST_SPEC_LIBRARY[itemName];
  if (!lib || !lib.judge) return 'na';
  const j = lib.judge;
  const v = resultValue;

  try {
    switch (j.type) {
      case 'min': {
        // 내스크래치성: 4칸 객체가 들어오면 유지율 자동계산 후 판정
        let val = v;
        if (val && typeof val === 'object' && val['24시간후'] != null) {
          val = window.calcRetention(val);
        }
        // 변동 스펙이면 override 우선
        const threshold = (specOverride && specOverride.기준 != null)
          ? Number(specOverride.기준)
          : (j.threshold != null ? j.threshold : (lib.defaultSpec && lib.defaultSpec.기준));
        return Number(val) >= Number(threshold) ? 'pass' : 'ng';
      }
      case 'gloss': {
        // 광택: 비교방식(min/range)을 스펙에서 읽음. override > defaultSpec
        const sp = specOverride || lib.defaultSpec;
        if (!sp) return 'na';
        if (sp.비교 === 'range') {
          const c = Number(sp.center), t = Number(sp.tol);
          return (Number(v) >= c - t && Number(v) <= c + t) ? 'pass' : 'ng';
        }
        return Number(v) >= Number(sp.기준) ? 'pass' : 'ng';
      }
      case 'max':
        return Number(v) <= Number(j.threshold) ? 'pass' : 'ng';

      case 'grade_M': {
        // 'M-2.5' → 2.5 추출, threshold 이하면 합격
        const num = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        return num <= j.threshold ? 'pass' : 'ng';
      }
      case 'grade_chip': {
        const num = parseFloat(String(v).replace(/[^0-9.]/g, ''));
        return num <= j.threshold ? 'pass' : 'ng';
      }
      case 'grade_pencil': {
        const scale = window.GRADE_PENCIL_SCALE;
        const vi = scale.indexOf(String(v).trim());
        const ti = scale.indexOf(j.threshold);
        if (vi < 0 || ti < 0) return 'na';
        return vi >= ti ? 'pass' : 'ng';  // threshold(B)보다 단단하거나 같으면 합격
      }
      case 'thickness_range': {
        // v = {전착: 18, 중도: 37, BASE: 16, CLEAR: 41}, spec = {전착:'16±2',...}
        const spec = specOverride || lib.defaultSpec;
        for (const layer of lib.layers) {
          const meas = v && v[layer];
          const sp = spec && spec[layer];
          if (meas == null || !sp || /측정치/.test(sp)) continue; // BASE 등 측정치 기입은 판정 제외
          const m = String(sp).match(/([0-9.]+)\s*±\s*([0-9.]+)/);
          if (m) {
            const center = parseFloat(m[1]), tol = parseFloat(m[2]);
            if (Number(meas) < center - tol || Number(meas) > center + tol) return 'ng';
          }
        }
        return 'pass';
      }
      case 'appearance_grade': {
        // v = {외관: '양호'|'이상', 부착성: 'M-2.0'}
        if (!v) return 'na';
        if (v.외관 && v.외관 !== '양호') return 'ng';
        if (v.부착성) {
          const num = parseFloat(String(v.부착성).replace(/[^0-9.]/g, ''));
          if (num > j.threshold) return 'ng';
        }
        return 'pass';
      }
      case 'attach':
        return v ? 'pass' : 'na';  // 첨부 있으면 pass, 없으면 na
      default:
        return 'na';
    }
  } catch (e) {
    console.warn('[judgeResult]', itemName, e);
    return 'na';
  }
};

// 내스크래치성 유지율 자동계산: 24시간후 ÷ 초기광택 × 100 (소수 1자리)
window.calcRetention = function (scratchObj) {
  if (!scratchObj) return null;
  const after = Number(scratchObj['24시간후']);
  const init = Number(scratchObj['초기광택']);
  if (!init || isNaN(after) || isNaN(init)) return null;
  return Math.round((after / init) * 1000) / 10;
};

// 항목의 시험방법/스펙 빠른 조회 (보고서 생성용)
window.getTestMethod = function (itemName) {
  const lib = window.TEST_SPEC_LIBRARY[itemName];
  return lib ? (lib.methodShort || lib.method) : '';
};
window.getTestSpec = function (itemName, specOverride) {
  const lib = window.TEST_SPEC_LIBRARY[itemName];
  if (!lib) return '';
  if (lib.variableSpec && specOverride) {
    if (itemName === '도막두께') {
      return lib.layers.map(l => `${l}(${specOverride[l] || '-'})`).join(' / ');
    }
    if (specOverride.기준 != null) return `${specOverride.기준} 이상`;
  }
  return lib.spec || (lib.defaultSpec ? JSON.stringify(lib.defaultSpec) : '');
};
