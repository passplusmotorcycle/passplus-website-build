import { pricing } from '../../src/pricing.js';

export const LESSON_DURATION_MINUTES = 110;
export const SLOT_STEP_MINUTES = 30;

export const lessonTypes = Object.freeze({
  instructor: {
    labelZh: '一對一考試導師堂',
    labelEn: 'One-to-one road test lesson',
    priceHkd: pricing.instructorLesson,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
  },
  grand_opening_special: {
    labelZh: '新張特別導師堂',
    labelEn: 'Grand Opening Special Lesson',
    priceHkd: pricing.grandOpeningLesson,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
  },
  self_practice: {
    labelZh: '租車自練',
    labelEn: 'Self-practice bike rental',
    priceHkd: pricing.selfPractice,
    needsInstructor: false,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
  },
  mock_test: {
    labelZh: '模擬考試堂',
    labelEn: 'Mock road test',
    priceHkd: pricing.mockTest,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
  },
  consultation: {
    labelZh: '考牌諮詢',
    labelEn: 'Licensing consultation',
    priceHkd: 0,
    needsInstructor: true,
    needsVehicle: false,
    durationMinutes: LESSON_DURATION_MINUTES,
  },
  exam_rental: {
    labelZh: '考試當日租車',
    labelEn: 'Exam-day bike rental',
    priceHkd: pricing.examRental,
    needsInstructor: false,
    needsVehicle: true,
    durationMinutes: 0,
  },
  instructor_500: {
    labelZh: '導師堂 $500（內部）',
    labelEn: 'Internal instructor lesson $500',
    priceHkd: 500,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
    internal: true,
  },
  instructor_800: {
    labelZh: '導師堂 $800（內部）',
    labelEn: 'Internal instructor lesson $800',
    priceHkd: 800,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
    internal: true,
  },
  self_practice_250: {
    labelZh: '自堂 $250（內部）',
    labelEn: 'Internal self-practice $250',
    priceHkd: 250,
    needsInstructor: false,
    needsVehicle: true,
    durationMinutes: LESSON_DURATION_MINUTES,
    internal: true,
  },
});

export function durationMinutesFor(lessonType) {
  const type = lessonTypes[lessonType];
  if (!type) throw new Error(`Unknown lesson type: ${lessonType}`);
  return type.durationMinutes ?? LESSON_DURATION_MINUTES;
}

export function hasLessonEndTime(lessonType) {
  return durationMinutesFor(lessonType) > 0;
}

export const locations = Object.freeze([
  {
    id: 'tin_kwong_road',
    type: 'training',
    labelZh: '天光道',
    labelEn: 'Tin Kwong Road',
    active: true,
  },
  {
    id: 'so_kon_po',
    type: 'training',
    labelZh: '掃桿埔',
    labelEn: 'So Kon Po',
    active: true,
  },
]);

export const operationalNotices = Object.freeze([
  {
    id: 'so_kon_po_happy_valley_race_day',
    locationIds: ['so_kon_po'],
    kind: 'restriction',
    severity: 'warning',
    standing: true,
    active: true,
    titleZh: '跑馬地賽馬日：禮頓道／黃泥涌道禁學牌',
    titleEn: 'Happy Valley race day: learner plates banned on Leighton Road / Wong Nai Chung Road',
    bodyZh:
      '掃桿埔考試／課堂路線會經禮頓道（Leighton Road）同黃泥涌道（Wong Nai Chung Road）。跑馬地賽馬日該路段禁止學牌車輛，排堂或改路線前先核對賽馬日。',
    bodyEn:
      'So Kon Po exam and lesson routes pass Leighton Road (禮頓道) and Wong Nai Chung Road (黃泥涌道). On Happy Valley race days those roads prohibit learner (學牌) vehicles — plan So Kon Po routes and lessons accordingly.',
    checkHowZh:
      '查運輸署跑馬地賽馬日季節通告入面嘅學牌禁行（例如禁由加路連山道左轉禮頓道、黃泥涌道學牌限制）＋馬會跑馬地賽期。普通改道唔使入 OPS。',
    checkHowEn:
      'Check the TD seasonal Happy Valley race-day notice for learner (學牌) prohibitions (e.g. no left-turn from Caroline Hill onto Leighton; Wong Nai Chung Road learner bans) plus HKJC HV fixtures. Ordinary diversions are not OPS alerts.',
    checkWhenZh: '每個跑馬地賽馬日都當生效。每週一對未來 14 日馬會跑馬地賽期。',
    checkWhenEn:
      'Treat every Happy Valley race meeting as in force. Each Monday, scan HKJC HV fixtures for the next 14 days.',
  },
  {
    id: 'so_kon_po_hk_stadium_closures',
    locationIds: ['so_kon_po'],
    kind: 'restriction',
    severity: 'warning',
    standing: true,
    active: true,
    titleZh: '香港大球場活動：封路＋學牌禁行',
    titleEn: 'Hong Kong Stadium events: road closures + learner bans',
    bodyZh:
      '以 2026-11-01 童軍大會操運輸署通告為模板：大球場活動可同時有「封路」（阻掃桿埔考試／課堂路線，例如連山道、大球場徑、加路連山道）同「學牌禁行」。只跟呢兩類；普通改道／分流唔使入 OPS 提醒。',
    bodyEn:
      'Use the 1 Nov 2026 Scout Rally TD notice as the template: Stadium events can combine route-blocking closures (e.g. Lin Shan Road, Stadium Path, Caroline Hill Road) and learner (學牌) bans. Track only those two; ordinary diversions/reroutes are not OPS alerts.',
    checkHowZh:
      '康文署香港大球場活動頁先睇檔期；有活動就去運輸署交通通告／HKeMobility 搵「封閉」同「學牌／learner」字眼（搜香港大球場、掃桿埔、加路連山道）。當日聽港台交通同商台 881903 係咪有封路或學牌禁令。',
    checkHowEn:
      'Scan LCSD Hong Kong Stadium events first. If there is an event, search TD notices / HKeMobility for closures and learner/學牌 bans (香港大球場, 掃桿埔, 加路連山道). Same-day radio (RTHK, 881903) only if it reports a closure or learner ban.',
    checkWhenZh: '每週一掃未來 14 日檔期。活動前 3–7 日搵 TD 全文 PDF。掃桿埔上課日前晚同朝早再查一次。',
    checkWhenEn:
      'Weekly: next 14 days of Stadium events. 3–7 days before an event: TD full notice PDF. Evening before and morning of So Kon Po lesson days: check again.',
  },
  {
    id: 'so_kon_po_check_playbook',
    locationIds: ['so_kon_po'],
    kind: 'playbook',
    severity: 'info',
    standing: true,
    active: true,
    titleZh: '掃桿埔：點查／幾時查',
    titleEn: 'So Kon Po: where and when to check',
    bodyZh:
      '排堂唔好只靠記憶。只提醒兩類：① 封路而且阻考試／課堂路線；② 學牌（學牌車輛）禁行。普通改道、分流、擠塞唔入 OPS。以運輸署交通通告為準。',
    bodyEn:
      'Do not schedule from memory. Remind only for (1) road closures that block exam/lesson routes and (2) learner (學牌) prohibitions. Ordinary diversions, reroutes, or congestion are not OPS alerts. TD notices are authoritative.',
    scope: {
      includeZh: ['阻考試／課堂路線嘅封路', '學牌（學牌車輛）禁行'],
      includeEn: ['Road closures that block exam/lesson routes', 'Learner (學牌) prohibitions'],
      excludeZh: ['普通改道／分流／擠塞（唔封訓練路、又無學牌禁令）'],
      excludeEn: ['Ordinary traffic diversions, reroutes, or congestion'],
    },
    sources: [
      {
        id: 'td',
        labelZh:
          '主查：運輸署交通通告。搜「香港大球場／掃桿埔／加路連山道／Scout Rally／football」，只抽「封閉」同「學牌／learner」條文。',
        labelEn:
          'Primary: TD traffic notices. Search 香港大球場, 掃桿埔, 加路連山道, Scout Rally, football — extract only closures and learner/學牌 bans.',
        url: 'https://www.td.gov.hk/tc/traffic_notices/',
      },
      {
        id: 'hkemobility',
        labelZh: '同步：HKeMobility 只跟即時封路／學牌禁區，唔跟普通改道。',
        labelEn: 'Also: HKeMobility for live closures or learner bans — not ordinary diversions.',
        url: 'https://www.hkemobility.gov.hk/',
      },
      {
        id: 'lcsd',
        labelZh: '檔期（TD PDF 之前）：康文署香港大球場活動。',
        labelEn: 'Calendar ahead of the TD PDF: LCSD Hong Kong Stadium events.',
        url: 'https://www.lcsd.gov.hk/tc/stadium/hks/events.html',
      },
      {
        id: 'radio',
        labelZh: '當日電台：港台交通、商台 881903 — 只聽封路或學牌禁令，唔理普通改道。',
        labelEn: 'Same-day radio: RTHK / 881903 — only closures or learner bans, not ordinary diversions.',
        url: '',
      },
      {
        id: 'hkjc',
        labelZh: '賽馬日（另一條常設規則）：馬會跑馬地賽期 ＋ 運輸署季節通告。',
        labelEn: 'Race days (separate standing rule): HKJC Happy Valley fixtures + TD seasonal notice.',
        url: 'https://racing.hkjc.com/racing/information/Chinese/Racing/Fixture.aspx',
      },
    ],
    cadence: [
      {
        id: 'weekly',
        labelZh: '每週一：掃康文署大球場活動 ＋ 馬會跑馬地賽期（未來 14 日）。',
        labelEn: 'Every Monday: scan LCSD Stadium events and HKJC Happy Valley fixtures for the next 14 days.',
      },
      {
        id: 'pre_event',
        labelZh: '大球場活動前 3–7 日：搵運輸署全文 PDF（通常活動前幾日先出）。',
        labelEn: '3–7 days before any Stadium event: look for the TD full notice PDF (usually a few days prior).',
      },
      {
        id: 'lesson_day',
        labelZh:
          '掃桿埔上課日前晚 ＋ 當日朝早：再查 TD／HKeMobility 有無封路或學牌禁令；當日有大球場活動就聽電台確認。',
        labelEn:
          'Evening before and morning of So Kon Po lesson days: re-check TD / HKeMobility for closures or learner bans; use radio if a Stadium event is on.',
      },
      {
        id: 'race_day',
        labelZh: '賽馬日：每個跑馬地賽期都當季節通告生效，唔使等新 PDF。',
        labelEn: 'Race days: treat every Happy Valley meeting as covered by the seasonal TD notice.',
      },
    ],
    example: {
      titleZh: '大球場模板（2026-11-01 童軍大會操 TD 通告）',
      titleEn: 'Stadium template (1 Nov 2026 Scout Rally TD notice)',
      bodyZh:
        '同時有封路同學牌禁行先要入 OPS：加路連山道約 06:30 起封閉禮頓道至棉路段、約 11:00 起全路封閉至人散；學牌 06:00–13:00 禁行加路連山道／連山道／大球場徑／棉路／東院道／禮頓道西行等。之後大球場活動用同一標準對 TD PDF。',
      bodyEn:
        'Flag only when the notice has closures and/or a learner ban: Caroline Hill Road closed from ~06:30 (Leighton–Cotton Path) and from ~11:00 full road until crowds clear; learner ban 06:00–13:00 on Caroline Hill / Link / Stadium Path / Cotton Path / Eastern Hospital / Leighton westbound. Use this TD notice as the template for later Stadium events.',
      links: [
        {
          labelZh: '運輸署交通通告',
          labelEn: 'TD traffic notice',
          url: 'https://www.td.gov.hk/tc/traffic_notices/index_id_89550.html',
        },
        {
          labelZh: 'TD Full Eng PDF',
          labelEn: 'TD full Eng PDF',
          url: 'https://www.td.gov.hk/filemanager/en/content_13/261101_Scout%20Rally%20Full_Eng.pdf',
        },
      ],
    },
  },
]);

const NOTICE_FILL_FIELDS = Object.freeze([
  'kind',
  'checkHowZh',
  'checkHowEn',
  'checkWhenZh',
  'checkWhenEn',
  'sources',
  'cadence',
  'example',
  'scope',
]);

const PREVIOUS_SEED_TITLES = Object.freeze({
  so_kon_po_hk_stadium_closures: ['香港大球場活動：連山道／大球場徑或會封閉'],
  so_kon_po_check_playbook: ['掃桿埔：點查／幾時查封路'],
});

export function activeOperationalNotices(notices = operationalNotices) {
  return (notices ?? []).filter((notice) => notice.active !== false);
}

export function noticesForLocation(notices, locationId) {
  return activeOperationalNotices(notices).filter(
    (notice) => !notice.locationIds?.length || notice.locationIds.includes(locationId)
  );
}

export function noticesForLessons(notices, lessons) {
  const locationIds = [
    ...new Set((lessons ?? []).map((lesson) => lesson.locationId).filter(Boolean)),
  ];
  const seen = new Map();
  for (const locationId of locationIds) {
    for (const notice of noticesForLocation(notices, locationId)) {
      seen.set(notice.id, notice);
    }
  }
  return [...seen.values()];
}

export function mergeSeedOperationalNotices(data, now = new Date().toISOString()) {
  if (!Array.isArray(data.operationalNotices)) data.operationalNotices = [];
  const existingById = new Map(data.operationalNotices.map((notice) => [notice.id, notice]));
  let changed = 0;
  for (const seed of operationalNotices) {
    const existing = existingById.get(seed.id);
    if (!existing) {
      data.operationalNotices.push({ ...structuredClone(seed), createdAt: now, updatedAt: now });
      changed += 1;
      continue;
    }
    const previousTitles = PREVIOUS_SEED_TITLES[seed.id] ?? [];
    if (previousTitles.includes(existing.titleZh)) {
      for (const field of ['titleZh', 'titleEn', 'bodyZh', 'bodyEn', ...NOTICE_FILL_FIELDS]) {
        if (seed[field] == null) continue;
        existing[field] = structuredClone(seed[field]);
      }
      existing.updatedAt = now;
      changed += 1;
      continue;
    }
    for (const field of NOTICE_FILL_FIELDS) {
      if (seed[field] == null || existing[field] != null) continue;
      existing[field] = structuredClone(seed[field]);
      changed += 1;
    }
  }
  return changed;
}

export const statuses = Object.freeze({
  lesson: [
    'requested',
    'draft',
    'pending_approval',
    'approved',
    'confirmed',
    'completed',
    'cancelled',
    'no_show',
  ],
  workflow: ['draft', 'pending_approval', 'approved', 'rejected', 'executed'],
  payment: ['quoted', 'invoiced', 'paid', 'refunded'],
  vehicle: ['available', 'in_use', 'maintenance'],
  exam: ['planned', 'booked', 'passed', 'failed', 'cancelled'],
});

export const licensingStages = Object.freeze([
  'beginner',
  'passed_mct',
  'learner',
  'part_c_booked',
  'licensed',
]);

export const escalationCategories = Object.freeze([
  'refund',
  'legal_or_licensing',
  'safety',
  'complaint',
  'special_price',
  'final_cancellation',
]);

export function priceSnapshot(lessonType) {
  const item = lessonTypes[lessonType];
  if (!item) throw new Error(`Unknown lesson type: ${lessonType}`);
  return {
    lessonType,
    amountHkd: item.priceHkd,
    capturedAt: new Date().toISOString(),
    source: 'src/pricing.js',
  };
}

export function validateRequired(record, fields) {
  const missing = fields.filter((field) => {
    const value = record[field];
    return value === undefined || value === null || String(value).trim() === '';
  });
  if (missing.length) throw new Error(`Missing required fields: ${missing.join(', ')}`);
}

export function assertEnum(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
}

export function seedData() {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    students: [],
    instructors: [
      {
        id: 'instructor-primary',
        name: 'PassPlus 教練',
        languages: ['zh-Hant', 'en', 'zh-Hans'],
        defaultLocationIds: locations.map((location) => location.id),
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    locations: locations.map((location) => ({ ...location, createdAt: now, updatedAt: now })),
    operationalNotices: operationalNotices.map((notice) => ({
      ...notice,
      createdAt: now,
      updatedAt: now,
    })),
    vehicles: [
      {
        id: 'vehicle-training-1',
        code: 'TRAINING-1',
        model: 'Training motorcycle',
        // Home base only; bikes can be booked at Tin Kwong Road or So Kon Po.
        locationId: 'tin_kwong_road',
        status: 'available',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    lessons: [],
    exams: [],
    payments: [],
    workflowTasks: [],
    auditLogs: [],
    agentRuns: [],
  };
}
