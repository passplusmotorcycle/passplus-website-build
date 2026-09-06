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
