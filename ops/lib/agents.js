import { randomUUID } from 'node:crypto';
import {
  LESSON_DURATION_MINUTES,
  escalationCategories,
  lessonTypes,
  priceSnapshot,
  validateRequired,
} from './domain.js';
import { proposeAvailableSlots, schedulingConflicts } from './scheduling.js';

const ESCALATION_PATTERNS = [
  ['refund', /退款|退錢|refund/i],
  ['legal_or_licensing', /法例|運輸署|牌照|legal|licen[cs]e/i],
  ['safety', /安全|受傷|意外|危險|injur|accident|safety/i],
  ['complaint', /投訴|不滿|complain/i],
  ['special_price', /特價|折扣|優惠價|discount|special price/i],
  ['final_cancellation', /最終取消|永久取消|final cancellation/i],
];

export const agentRegistry = Object.freeze({
  operations: {
    status: 'active',
    mayRead: ['students', 'instructors', 'locations', 'vehicles', 'lessons', 'exams'],
    mayDraft: ['lesson_proposal', 'whatsapp_reply'],
    mayExecute: [],
  },
  sales: {
    status: 'foundation',
    mayRead: ['students', 'workflowTasks'],
    mayDraft: ['lead_follow_up'],
    mayExecute: [],
  },
  student_success: {
    status: 'foundation',
    mayRead: ['students', 'lessons', 'exams'],
    mayDraft: ['lesson_report', 'exam_countdown', 'review_request'],
    mayExecute: [],
  },
  finance: {
    status: 'foundation',
    mayRead: ['students', 'payments', 'lessons'],
    mayDraft: ['payment_reminder', 'receipt'],
    mayExecute: [],
  },
  compliance: {
    status: 'foundation',
    mayRead: ['auditLogs', 'workflowTasks'],
    mayDraft: ['knowledge_review', 'policy_alert'],
    mayExecute: [],
  },
});

export function detectEscalations(text = '') {
  return ESCALATION_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([category]) => category);
}

function formatHongKongDate(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-HK' : 'zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function buildDraftMessage({ student, lessonType, location, slots, escalationCategories: escalations }) {
  const type = lessonTypes[lessonType];
  const isEnglish = student.preferredLanguage === 'en';
  const slotLines = slots
    .map((slot, index) => `${index + 1}. ${formatHongKongDate(slot, isEnglish ? 'en' : 'zh')}`)
    .join('\n');

  if (escalations.length) {
    return isEnglish
      ? `Thanks for your message. A PassPlus team member will review your ${escalations.join(
          ', '
        )} request before replying. No arrangement has been confirmed.`
      : `多謝你嘅訊息。內容涉及「${escalations.join(
          '、'
        )}」，PassPlus 真人同事會先審核再回覆；目前未有任何安排獲確認。`;
  }

  return isEnglish
    ? `Hi ${student.name}, here are the proposed times for ${type.labelEn} at ${
        location.labelEn
      }:\n${slotLines}\n\nPrice reference: HK$${type.priceHkd}. These are proposed times only. Please reply with your preferred option; PassPlus will confirm it separately.`
    : `${student.name}你好，以下係${location.labelZh}${type.labelZh}建議時段：\n${slotLines}\n\n參考收費：HK$${type.priceHkd}。以上只係建議時段，請回覆你屬意選項，等 PassPlus 另行確認。`;
}

function buildReminderMessage(student, lesson, type, location) {
  const isEnglish = student.preferredLanguage === 'en';
  const date = formatHongKongDate(lesson.scheduledStart, isEnglish ? 'en' : 'zh');
  return isEnglish
    ? `Hi ${student.name}, this is a draft reminder for your ${type.labelEn} at ${location.labelEn} on ${date}. Please reply to confirm. PassPlus will contact you separately if weather or safety arrangements change.`
    : `${student.name}你好，提提你將於 ${date} 喺${location.labelZh}進行${type.labelZh}，請回覆確認。如天氣或安全安排有變，PassPlus 會另行通知。`;
}

export function draftSchedulingProposal(data, input) {
  validateRequired(input, ['studentId', 'lessonType', 'locationId', 'preferredStart']);
  const student = data.students.find((item) => item.id === input.studentId);
  if (!student) throw new Error('Student not found');
  const location = data.locations.find((item) => item.id === input.locationId && item.active);
  if (!location) throw new Error('Active location not found');
  const type = lessonTypes[input.lessonType];
  if (!type) throw new Error('Lesson type not found');

  const instructorId =
    input.instructorId ??
    (type.needsInstructor
      ? data.instructors.find(
          (item) => item.active && item.defaultLocationIds.includes(input.locationId)
        )?.id
      : null);
  const vehicleId =
    input.vehicleId ??
    (type.needsVehicle
      ? data.vehicles.find(
          (item) =>
            item.active &&
            item.status === 'available' &&
            (!item.locationId || item.locationId === input.locationId)
        )?.id
      : null);

  if (type.needsInstructor && !instructorId) throw new Error('No active instructor is available');
  if (type.needsVehicle && !vehicleId) throw new Error('No active vehicle is available');

  const request = {
    studentId: input.studentId,
    lessonType: input.lessonType,
    locationId: input.locationId,
    instructorId,
    vehicleId,
    durationMinutes: LESSON_DURATION_MINUTES,
    preferredStart: input.preferredStart,
  };
  const slots = proposeAvailableSlots(data, request);
  if (!slots.length) throw new Error('No conflict-free slots found in the next 14 days');

  const escalations = detectEscalations(input.notes);
  escalations.forEach((category) => {
    if (!escalationCategories.includes(category)) throw new Error('Invalid escalation category');
  });

  const now = new Date().toISOString();
  const lesson = {
    id: randomUUID(),
    ...request,
    scheduledStart: slots[0],
    status: 'pending_approval',
    priceSnapshot: priceSnapshot(input.lessonType),
    customerNotes: input.notes?.trim() ?? '',
    createdAt: now,
    updatedAt: now,
  };
  const workflow = {
    id: randomUUID(),
    type: 'schedule_lesson',
    entityType: 'lesson',
    entityId: lesson.id,
    studentId: student.id,
    status: 'pending_approval',
    proposedSlots: slots,
    selectedSlot: slots[0],
    draftContent: buildDraftMessage({
      student,
      lessonType: input.lessonType,
      location,
      slots,
      escalationCategories: escalations,
    }),
    escalations,
    requiresHumanApproval: true,
    agentPolicy: 'draft_only',
    createdBy: 'operations_agent',
    createdAt: now,
    submittedAt: now,
    updatedAt: now,
  };

  return {
    lesson,
    workflow,
    agentRun: {
      id: randomUUID(),
      agent: 'operations',
      action: 'draft_schedule',
      status: escalations.length ? 'escalated' : 'drafted',
      workflowTaskId: workflow.id,
      createdAt: now,
    },
  };
}

export function draftRescheduleProposal(data, input) {
  validateRequired(input, ['lessonId', 'preferredStart']);
  const lesson = data.lessons.find((item) => item.id === input.lessonId);
  if (!lesson) throw new Error('Lesson not found');
  if (lesson.status === 'completed' || lesson.status === 'cancelled') {
    throw new Error('Completed or cancelled lessons cannot be rescheduled');
  }
  const student = data.students.find((item) => item.id === lesson.studentId);
  const location = data.locations.find((item) => item.id === lesson.locationId);
  const slots = proposeAvailableSlots(
    data,
    { ...lesson, preferredStart: input.preferredStart },
    { ignoredLessonId: lesson.id }
  );
  if (!slots.length) throw new Error('No conflict-free slots found in the next 14 days');

  const escalations = detectEscalations(input.notes);
  const now = new Date().toISOString();
  const workflow = {
    id: randomUUID(),
    type: 'reschedule_lesson',
    entityType: 'lesson',
    entityId: lesson.id,
    studentId: student.id,
    status: 'pending_approval',
    proposedSlots: slots,
    selectedSlot: slots[0],
    draftContent: buildDraftMessage({
      student,
      lessonType: lesson.lessonType,
      location,
      slots,
      escalationCategories: escalations,
    }),
    escalations,
    requiresHumanApproval: true,
    agentPolicy: 'draft_only',
    createdBy: 'operations_agent',
    createdAt: now,
    submittedAt: now,
    updatedAt: now,
  };
  return {
    workflow,
    agentRun: {
      id: randomUUID(),
      agent: 'operations',
      action: 'draft_reschedule',
      status: escalations.length ? 'escalated' : 'drafted',
      workflowTaskId: workflow.id,
      createdAt: now,
    },
  };
}

export function draftLessonReminders(data, now = new Date()) {
  const start = now.getTime();
  const end = start + 24 * 60 * 60_000;
  const existingLessonIds = new Set(
    data.workflowTasks
      .filter((task) => task.type === 'lesson_reminder' && task.status !== 'rejected')
      .map((task) => task.entityId)
  );

  return data.lessons
    .filter((lesson) => {
      const time = new Date(lesson.scheduledStart).getTime();
      return (
        ['approved', 'confirmed'].includes(lesson.status) &&
        time >= start &&
        time <= end &&
        !existingLessonIds.has(lesson.id)
      );
    })
    .map((lesson) => {
      const student = data.students.find((item) => item.id === lesson.studentId);
      const location = data.locations.find((item) => item.id === lesson.locationId);
      const type = lessonTypes[lesson.lessonType];
      const createdAt = now.toISOString();
      return {
        id: randomUUID(),
        type: 'lesson_reminder',
        entityType: 'lesson',
        entityId: lesson.id,
        studentId: student.id,
        status: 'pending_approval',
        proposedSlots: [],
        selectedSlot: null,
        draftContent: buildReminderMessage(student, lesson, type, location),
        escalations: [],
        requiresHumanApproval: true,
        agentPolicy: 'draft_only',
        createdBy: 'operations_agent',
        createdAt,
        submittedAt: createdAt,
        updatedAt: createdAt,
      };
    });
}

export function draftOperationalNotice(data, input) {
  validateRequired(input, ['lessonId', 'noticeType', 'notes']);
  const allowedTypes = ['weather', 'late', 'cancellation', 'vehicle_change'];
  if (!allowedTypes.includes(input.noticeType)) {
    throw new Error(`noticeType must be one of: ${allowedTypes.join(', ')}`);
  }
  const lesson = data.lessons.find((item) => item.id === input.lessonId);
  if (!lesson) throw new Error('Lesson not found');
  const student = data.students.find((item) => item.id === lesson.studentId);
  const escalations = detectEscalations(input.notes);
  if (input.noticeType === 'cancellation' && !escalations.includes('final_cancellation')) {
    escalations.push('final_cancellation');
  }
  if (input.noticeType === 'weather' && !escalations.includes('safety')) {
    escalations.push('safety');
  }
  const labels = {
    weather: ['天氣安排', 'weather arrangement'],
    late: ['遲到安排', 'late-arrival arrangement'],
    cancellation: ['取消安排', 'cancellation arrangement'],
    vehicle_change: ['車輛更改', 'vehicle change'],
  };
  const isEnglish = student.preferredLanguage === 'en';
  const createdAt = new Date().toISOString();
  return {
    id: randomUUID(),
    type: `${input.noticeType}_notice`,
    entityType: 'lesson',
    entityId: lesson.id,
    studentId: student.id,
    status: 'pending_approval',
    proposedSlots: [],
    selectedSlot: null,
    draftContent: isEnglish
      ? `Hi ${student.name}, PassPlus is reviewing a ${labels[input.noticeType][1]} for your lesson on ${formatHongKongDate(lesson.scheduledStart, 'en')}. Draft detail: ${input.notes}. No change is confirmed until a team member approves and contacts you.`
      : `${student.name}你好，PassPlus 正檢視你 ${formatHongKongDate(lesson.scheduledStart, 'zh')} 課堂嘅${labels[input.noticeType][0]}。草稿內容：${input.notes}。安排要經真人批准及聯絡後先至作實。`,
    escalations,
    requiresHumanApproval: true,
    agentPolicy: 'draft_only',
    createdBy: 'operations_agent',
    createdAt,
    submittedAt: createdAt,
    updatedAt: createdAt,
  };
}

export function approveWorkflow(data, workflowId, input, actor) {
  const workflow = data.workflowTasks.find((item) => item.id === workflowId);
  if (!workflow) throw new Error('Workflow task not found');
  if (workflow.status !== 'pending_approval') throw new Error('Only pending tasks can be approved');
  if (workflow.escalations.length && input.confirmEscalationReview !== true) {
    throw new Error('Escalated tasks require explicit human review confirmation');
  }

  const now = new Date().toISOString();
  workflow.status = 'approved';
  workflow.approvedBy = actor;
  workflow.approvedAt = now;
  workflow.updatedAt = now;
  workflow.draftContent = input.draftContent?.trim() || workflow.draftContent;
  const lesson = data.lessons.find((item) => item.id === workflow.entityId) ?? null;

  if (workflow.type === 'schedule_lesson' || workflow.type === 'reschedule_lesson') {
    if (!lesson) throw new Error('Related lesson not found');
    const selectedSlot = input.selectedSlot ?? workflow.selectedSlot;
    if (!workflow.proposedSlots.includes(selectedSlot)) {
      throw new Error('Select one of the proposed slots');
    }
    const candidate = { ...lesson, scheduledStart: selectedSlot };
    const conflicts = schedulingConflicts(data, candidate, lesson.id);
    if (conflicts.length) {
      const resources = [...new Set(conflicts.map((conflict) => conflict.resource))].join(', ');
      throw new Error(`Schedule now conflicts with: ${resources}`);
    }
    workflow.selectedSlot = selectedSlot;
    lesson.scheduledStart = selectedSlot;
    lesson.status = 'approved';
    lesson.updatedAt = now;
  }

  return { workflow, lesson };
}

export function rejectWorkflow(data, workflowId, reason, actor) {
  const workflow = data.workflowTasks.find((item) => item.id === workflowId);
  if (!workflow) throw new Error('Workflow task not found');
  if (workflow.status !== 'pending_approval') throw new Error('Only pending tasks can be rejected');
  if (!reason?.trim()) throw new Error('A rejection reason is required');

  const now = new Date().toISOString();
  workflow.status = 'rejected';
  workflow.rejectedBy = actor;
  workflow.rejectionReason = reason.trim();
  workflow.rejectedAt = now;
  workflow.updatedAt = now;
  const lesson = data.lessons.find((item) => item.id === workflow.entityId);
  if (lesson) {
    lesson.status = 'draft';
    lesson.updatedAt = now;
  }
  return { workflow, lesson };
}
