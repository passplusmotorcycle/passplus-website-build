import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JsonStore } from '../lib/store.js';
import {
  agentRegistry,
  approveWorkflow,
  createConfirmedLesson,
  detectEscalations,
  draftLessonReminders,
  draftSchedulingProposal,
  rescheduleConfirmedLesson,
  updateLessonNotes,
  updateLessonType,
} from '../lib/agents.js';
import { buildAccountingReport, lessonAmountHkd } from '../lib/accounting.js';
import { schedulingConflicts } from '../lib/scheduling.js';
import { createOpsServer } from '../server.js';
import { lessonTypes } from '../lib/domain.js';

async function fixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'passplus-ops-'));
  const store = await new JsonStore(path.join(directory, 'ops.json')).init();
  const now = new Date().toISOString();
  await store.transact('test', 'student.create', (data) => {
    data.students.push({
      id: 'student-1',
      name: '陳同學',
      whatsapp: '85260000000',
      preferredLanguage: 'zh-Hant',
      licensingStage: 'part_c_booked',
      purchasedLessons: 4,
      usedLessons: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { entityType: 'student', entityId: 'student-1' };
  });
  return { directory, store };
}

test('operations agent drafts three slots and cannot send', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const result = draftSchedulingProposal(data, {
    studentId: 'student-1',
    lessonType: 'instructor',
    locationId: 'tin_kwong_road',
    preferredStart: '2030-01-02T01:00:00.000Z',
    notes: '',
  });

  assert.equal(result.workflow.status, 'pending_approval');
  assert.equal(result.workflow.proposedSlots.length, 3);
  assert.equal(result.workflow.requiresHumanApproval, true);
  assert.equal(result.workflow.agentPolicy, 'draft_only');
  assert.deepEqual(agentRegistry.operations.mayExecute, []);
});

test('grand opening special lesson uses confirmed price and resources', () => {
  assert.deepEqual(lessonTypes.grand_opening_special, {
    labelZh: '新張特別導師堂',
    labelEn: 'Grand Opening Special Lesson',
    priceHkd: 500,
    needsInstructor: true,
    needsVehicle: true,
    durationMinutes: 110,
  });
});

test('internal staff lesson types are priced and not on the public site', () => {
  assert.equal(lessonTypes.instructor_500.priceHkd, 500);
  assert.equal(lessonTypes.instructor_800.priceHkd, 800);
  assert.equal(lessonTypes.self_practice_250.priceHkd, 250);
  assert.equal(lessonTypes.instructor_500.internal, true);
  assert.equal(lessonTypes.instructor_800.needsInstructor, true);
  assert.equal(lessonTypes.self_practice_250.needsInstructor, false);
  assert.equal(lessonTypes.self_practice_250.needsVehicle, true);
});

test('internal $800 instructor lesson can be booked like a public tutor lesson', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const result = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'instructor_800',
    locationId: 'tin_kwong_road',
    scheduledStart: '2030-01-03T04:00:00.000Z',
  });
  assert.equal(result.lesson.status, 'confirmed');
  assert.equal(result.lesson.priceSnapshot.amountHkd, 800);
  assert.equal(result.lesson.durationMinutes, 110);
});

test('direct confirmed lesson skips approval and lands on the calendar', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const result = createConfirmedLesson(
    data,
    {
      studentId: 'student-1',
      lessonType: 'grand_opening_special',
      locationId: 'so_kon_po',
      scheduledStart: '2030-01-03T04:00:00.000Z',
      notes: '課堂後現場預約',
    },
    'owner'
  );

  assert.equal(result.lesson.status, 'confirmed');
  assert.equal(result.lesson.locationId, 'so_kon_po');
  assert.equal(result.lesson.customerNotes, '課堂後現場預約');
  assert.equal(result.lesson.bookingSource, 'direct_confirmed');
  assert.equal(result.agentRun.metadata.skippedApproval, true);
  assert.equal(result.agentRun.metadata.messageSent, false);
});

test('exam-day bike rental stores the given time without a 110-minute duration', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();

  assert.equal(lessonTypes.exam_rental.durationMinutes, 0);

  const rental = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'exam_rental',
    locationId: 'so_kon_po',
    scheduledStart: '2030-01-03T01:00:00.000Z',
    notes: '丙部考試',
  });
  assert.equal(rental.lesson.durationMinutes, 0);
  assert.equal(rental.lesson.scheduledStart, '2030-01-03T01:00:00.000Z');
  data.lessons.push(rental.lesson);
  data.students.push({
    id: 'student-2',
    name: '李同學',
    whatsapp: '85260000001',
    preferredLanguage: 'zh-Hant',
    licensingStage: 'learner',
    purchasedLessons: 0,
    usedLessons: 0,
    createdAt: rental.lesson.createdAt,
    updatedAt: rental.lesson.updatedAt,
  });

  const laterLesson = createConfirmedLesson(data, {
    studentId: 'student-2',
    lessonType: 'instructor',
    locationId: 'so_kon_po',
    scheduledStart: '2030-01-03T06:30:00.000Z',
  });
  assert.equal(laterLesson.lesson.durationMinutes, 110);
});

test('same student can book a tutor lesson before exam-day rental', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();

  // Older records saved exam rental as 110 minutes; scheduling must still treat it as a marker.
  data.lessons.push({
    id: 'exam-rental-legacy',
    studentId: 'student-1',
    lessonType: 'exam_rental',
    locationId: 'so_kon_po',
    instructorId: null,
    vehicleId: 'vehicle-training-1',
    durationMinutes: 110,
    scheduledStart: '2030-01-03T07:45:00.000Z',
    status: 'confirmed',
  });

  const tutor = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'instructor',
    locationId: 'so_kon_po',
    scheduledStart: '2030-01-03T04:00:00.000Z',
    notes: '考試前導師堂',
  });
  assert.equal(tutor.lesson.status, 'confirmed');
  assert.equal(tutor.lesson.studentId, 'student-1');
});

test('confirmed lesson notes can be updated after booking', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const created = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'grand_opening_special',
    locationId: 'so_kon_po',
    scheduledStart: '2030-01-03T04:00:00.000Z',
    notes: '初稿備註',
  });
  data.lessons.push(created.lesson);

  const updated = updateLessonNotes(data, created.lesson.id, '  改期後帶走車匙  ');
  assert.equal(updated.customerNotes, '改期後帶走車匙');
  assert.equal(data.lessons[0].customerNotes, '改期後帶走車匙');

  updateLessonNotes(data, created.lesson.id, '   ');
  assert.equal(data.lessons[0].customerNotes, '');

  assert.throws(() => updateLessonNotes(data, 'missing-lesson', 'x'), /Lesson not found/);
});

test('confirmed lesson can be rescheduled directly with conflict checks', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const created = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'instructor',
    locationId: 'tin_kwong_road',
    scheduledStart: '2030-01-03T04:00:00.000Z',
  });
  data.lessons.push(created.lesson);

  const rescheduled = rescheduleConfirmedLesson(data, created.lesson.id, {
    scheduledStart: '2030-01-04T04:00:00.000Z',
  });
  assert.equal(rescheduled.scheduledStart, '2030-01-04T04:00:00.000Z');
  assert.equal(rescheduled.status, 'confirmed');
  assert.equal(schedulingConflicts(data, rescheduled, rescheduled.id).length, 0);

  created.lesson.status = 'cancelled';
  assert.throws(
    () =>
      rescheduleConfirmedLesson(data, created.lesson.id, {
        scheduledStart: '2030-01-06T04:00:00.000Z',
      }),
    /cannot be rescheduled/
  );

  created.lesson.status = 'confirmed';

  data.lessons.push(
    createConfirmedLesson(data, {
      studentId: 'student-1',
      lessonType: 'instructor',
      locationId: 'tin_kwong_road',
      scheduledStart: '2030-01-05T04:00:00.000Z',
    }).lesson
  );

  assert.throws(
    () =>
      rescheduleConfirmedLesson(data, created.lesson.id, {
        scheduledStart: '2030-01-05T04:00:00.000Z',
      }),
    /時段衝突/
  );
});

test('so kon po bookings keep selected location even when vehicle home base is tin kwong', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  assert.equal(data.vehicles[0].locationId, 'tin_kwong_road');

  const result = draftSchedulingProposal(data, {
    studentId: 'student-1',
    lessonType: 'grand_opening_special',
    locationId: 'so_kon_po',
    preferredStart: '2030-01-02T01:00:00.000Z',
    notes: '',
  });

  assert.equal(result.lesson.locationId, 'so_kon_po');
  assert.match(result.workflow.draftContent, /掃桿埔/);
  assert.doesNotMatch(result.workflow.draftContent, /天光道/);
});

test('approval rechecks conflicts and locks only a proposed slot', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const result = draftSchedulingProposal(data, {
    studentId: 'student-1',
    lessonType: 'instructor',
    locationId: 'tin_kwong_road',
    preferredStart: '2030-01-02T01:00:00.000Z',
    notes: '',
  });
  data.lessons.push(result.lesson);
  data.workflowTasks.push(result.workflow);

  const approved = approveWorkflow(
    data,
    result.workflow.id,
    { selectedSlot: result.workflow.proposedSlots[1] },
    'owner'
  );
  assert.equal(approved.workflow.status, 'approved');
  assert.equal(approved.lesson.status, 'approved');
  assert.equal(approved.lesson.scheduledStart, result.workflow.proposedSlots[1]);
  assert.equal(schedulingConflicts(data, approved.lesson, approved.lesson.id).length, 0);
});

test('safety, refunds and licensing questions are escalated', () => {
  const escalations = detectEscalations('客人要求退款，並問牌照法例及受傷安全安排');
  assert.deepEqual(escalations, ['refund', 'legal_or_licensing', 'safety']);
});

test('reminders are drafted only for lessons in next 24 hours', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const now = new Date('2030-01-02T00:00:00.000Z');
  data.lessons.push({
    id: 'lesson-1',
    studentId: 'student-1',
    instructorId: 'instructor-primary',
    vehicleId: 'vehicle-training-1',
    locationId: 'tin_kwong_road',
    lessonType: 'instructor',
    scheduledStart: '2030-01-02T04:00:00.000Z',
    durationMinutes: 110,
    status: 'confirmed',
  });
  const reminders = draftLessonReminders(data, now);
  assert.equal(reminders.length, 1);
  assert.equal(reminders[0].status, 'pending_approval');
  assert.match(reminders[0].draftContent, /提提你/);
});

test('accounting report splits realized booked cancelled and payments', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  data.lessons.push(
    {
      id: 'lesson-done',
      studentId: 'student-1',
      lessonType: 'instructor',
      locationId: 'tin_kwong_road',
      scheduledStart: '2026-09-03T04:00:00.000Z',
      status: 'completed',
      priceSnapshot: { amountHkd: 850 },
    },
    {
      id: 'lesson-booked',
      studentId: 'student-1',
      lessonType: 'self_practice',
      locationId: 'so_kon_po',
      scheduledStart: '2026-09-10T04:00:00.000Z',
      status: 'confirmed',
      priceSnapshot: { amountHkd: 400 },
    },
    {
      id: 'lesson-cancelled',
      studentId: 'student-1',
      lessonType: 'exam_rental',
      locationId: 'so_kon_po',
      scheduledStart: '2026-08-20T04:00:00.000Z',
      status: 'cancelled',
    }
  );
  data.payments.push({
    id: 'pay-1',
    studentId: 'student-1',
    amountHkd: 850,
    status: 'paid',
    createdAt: '2026-09-03T05:00:00.000Z',
  });

  assert.equal(lessonAmountHkd(data.lessons[2]), 500);

  const all = buildAccountingReport(data, { now: new Date('2026-09-05T00:00:00.000Z') });
  assert.equal(all.totals.realizedHkd, 850);
  assert.equal(all.totals.bookedHkd, 400);
  assert.equal(all.totals.cancelledHkd, 500);
  assert.equal(all.byLessonType.instructor.realizedHkd, 850);
  assert.equal(all.byLocation.so_kon_po.bookedHkd, 400);
  assert.equal(all.payments.paid.amountHkd, 850);
  assert.ok(all.availableMonths.includes('2026-09'));

  const september = buildAccountingReport(data, { month: '2026-09' });
  assert.equal(september.totals.cancelledHkd, 0);
  assert.equal(september.totals.realizedHkd, 850);
  assert.equal(september.lines.length, 2);
});

test('confirmed lesson type can be changed from self-practice to instructor', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const created = createConfirmedLesson(data, {
    studentId: 'student-1',
    lessonType: 'self_practice',
    locationId: 'tin_kwong_road',
    scheduledStart: '2030-01-03T04:00:00.000Z',
  });
  data.lessons.push(created.lesson);
  assert.equal(created.lesson.instructorId, null);
  assert.equal(created.lesson.priceSnapshot.amountHkd, 400);

  const updated = updateLessonType(data, created.lesson.id, { lessonType: 'instructor' });
  assert.equal(updated.lessonType, 'instructor');
  assert.equal(updated.priceSnapshot.amountHkd, 850);
  assert.equal(updated.durationMinutes, 110);
  assert.ok(updated.instructorId);
  assert.equal(schedulingConflicts(data, updated, updated.id).length, 0);

  updated.status = 'cancelled';
  assert.throws(
    () => updateLessonType(data, created.lesson.id, { lessonType: 'self_practice' }),
    /cannot be changed/
  );
});

test('API requires bearer token when configured', async (t) => {
  const { directory, store } = await fixture();
  const server = await createOpsServer({ store, adminToken: 'test-secret' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const unauthorized = await fetch(`${base}/api/bootstrap`);
  assert.equal(unauthorized.status, 401);

  const authorized = await fetch(`${base}/api/bootstrap`, {
    headers: { Authorization: 'Bearer test-secret' },
  });
  assert.equal(authorized.status, 200);
  const payload = await authorized.json();
  assert.equal(payload.policy.automaticSending, false);
  assert.equal(payload.policy.approvalRequired, true);
});
