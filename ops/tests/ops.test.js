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
} from '../lib/agents.js';
import { buildAccountingReport, lessonAmountHkd } from '../lib/accounting.js';
import { schedulingConflicts } from '../lib/scheduling.js';
import { createOpsServer } from '../server.js';
import {
  datedAlertsForDate,
  datedRouteAlerts,
  lessonTypes,
  mergeSeedDatedRouteAlerts,
  mergeSeedOperationalNotices,
  noticesForLessons,
  noticesForLocation,
  operationalNotices,
} from '../lib/domain.js';
import { buildDailyBrief } from '../lib/scheduling.js';

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

test('seeded operational notices cover So Kon Po race-day, stadium closures, and check playbook', () => {
  const soKonPo = noticesForLocation(operationalNotices, 'so_kon_po');
  assert.equal(soKonPo.length, 3);
  assert.equal(noticesForLocation(operationalNotices, 'tin_kwong_road').length, 0);

  const raceDay = soKonPo.find((notice) => notice.id === 'so_kon_po_happy_valley_race_day');
  const stadium = soKonPo.find((notice) => notice.id === 'so_kon_po_hk_stadium_closures');
  const playbook = soKonPo.find((notice) => notice.id === 'so_kon_po_check_playbook');
  assert.ok(raceDay);
  assert.ok(stadium);
  assert.ok(playbook);
  assert.match(raceDay.titleZh, /禮頓道/);
  assert.match(raceDay.titleZh, /黃泥涌道/);
  assert.match(raceDay.bodyZh, /學牌/);
  assert.match(raceDay.bodyEn, /learner/i);
  assert.match(raceDay.bodyEn, /Leighton Road/);
  assert.match(stadium.bodyZh, /連山道/);
  assert.match(stadium.bodyZh, /大球場徑/);
  assert.match(stadium.bodyZh, /童軍大會操/);
  assert.match(stadium.bodyEn, /Lin Shan Road/);
  assert.match(stadium.bodyEn, /Stadium Path/);
  assert.match(stadium.bodyEn, /Scout Rally/);
  assert.match(stadium.bodyZh, /普通改道/);
  assert.match(playbook.titleZh, /點查／幾時查/);
  assert.match(playbook.bodyZh, /普通改道/);
  assert.deepEqual(playbook.scope.includeZh, ['阻考試／課堂路線嘅封路', '學牌（學牌車輛）禁行']);
  assert.match(playbook.example.titleZh, /童軍大會操/);
  assert.ok(playbook.sources.some((source) => /td\.gov\.hk/.test(source.url)));
  assert.ok(playbook.cadence.some((item) => /每週一/.test(item.labelZh)));
});

test('calendar days with So Kon Po lessons expose standing notices, Tin Kwong does not', () => {
  const soKonPoDay = noticesForLessons(operationalNotices, [
    { locationId: 'so_kon_po', lessonType: 'instructor' },
  ]);
  const tinKwongDay = noticesForLessons(operationalNotices, [
    { locationId: 'tin_kwong_road', lessonType: 'instructor' },
  ]);
  assert.equal(soKonPoDay.length, 3);
  assert.ok(soKonPoDay.some((notice) => notice.id === 'so_kon_po_happy_valley_race_day'));
  assert.ok(soKonPoDay.some((notice) => notice.id === 'so_kon_po_hk_stadium_closures'));
  assert.ok(soKonPoDay.some((notice) => notice.id === 'so_kon_po_check_playbook'));
  assert.equal(tinKwongDay.length, 0);
  assert.equal(noticesForLessons(operationalNotices, []).length, 0);
});

test('existing ops.json is seeded with standing notices', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'passplus-ops-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'ops.json');
  const store = await new JsonStore(filePath).init();
  assert.equal(store.snapshot().operationalNotices.length, operationalNotices.length);

  const legacy = store.snapshot();
  delete legacy.operationalNotices;
  store.data = legacy;
  await store.persist();

  const reopened = await new JsonStore(filePath).init();
  const notices = reopened.snapshot().operationalNotices;
  assert.equal(notices.length, operationalNotices.length);
  assert.ok(notices.some((notice) => notice.id === 'so_kon_po_hk_stadium_closures'));
});

test('merge refreshes unedited previous seed titles for stadium notice', () => {
  const data = {
    operationalNotices: [
      {
        id: 'so_kon_po_hk_stadium_closures',
        titleZh: '香港大球場活動：連山道／大球場徑或會封閉',
        bodyZh: '舊文案',
        locationIds: ['so_kon_po'],
        active: true,
      },
    ],
  };
  assert.ok(mergeSeedOperationalNotices(data) >= 1);
  const stadium = data.operationalNotices.find((notice) => notice.id === 'so_kon_po_hk_stadium_closures');
  assert.match(stadium.titleZh, /封路＋學牌禁行/);
  assert.match(stadium.bodyZh, /童軍大會操/);
});

test('merge keeps staff-edited standing notices', () => {
  const data = {
    operationalNotices: [
      {
        id: 'so_kon_po_happy_valley_race_day',
        bodyZh: '自訂賽馬日提示',
        locationIds: ['so_kon_po'],
        active: true,
      },
    ],
  };
  const changed = mergeSeedOperationalNotices(data);
  assert.ok(changed >= 2);
  assert.equal(
    data.operationalNotices.find((notice) => notice.id === 'so_kon_po_happy_valley_race_day').bodyZh,
    '自訂賽馬日提示'
  );
  assert.ok(data.operationalNotices.some((notice) => notice.id === 'so_kon_po_hk_stadium_closures'));
  assert.ok(data.operationalNotices.some((notice) => notice.id === 'so_kon_po_check_playbook'));
});

test('daily brief always includes standing So Kon Po notices', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const emptyDay = buildDailyBrief(data, new Date('2030-01-02T00:00:00.000Z'));
  assert.equal(emptyDay.lessons.length, 0);
  assert.ok(emptyDay.operationalNotices.some((notice) => /禮頓道/.test(notice.titleZh)));
  assert.ok(emptyDay.operationalNotices.some((notice) => /連山道/.test(notice.bodyZh)));
  assert.ok(emptyDay.checkPlaybook?.cadence?.some((item) => /每週一/.test(item.labelZh)));
  assert.equal(emptyDay.locationNotices.length, 0);

  data.lessons.push({
    id: 'lesson-skp',
    studentId: 'student-1',
    locationId: 'so_kon_po',
    lessonType: 'instructor',
    scheduledStart: '2030-01-02T04:00:00.000Z',
    status: 'confirmed',
  });
  const withLesson = buildDailyBrief(data, new Date('2030-01-02T00:00:00.000Z'));
  assert.ok(withLesson.locationNotices.some((notice) => notice.locationIds.includes('so_kon_po')));
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
  assert.ok(payload.operationalNotices.some((notice) => notice.id === 'so_kon_po_happy_valley_race_day'));
  assert.ok(payload.dailyBrief.operationalNotices.some((notice) => /學牌/.test(notice.bodyZh)));

  const updated = await fetch(`${base}/api/operational-notices/so_kon_po_happy_valley_race_day`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-secret',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bodyZh: '已人手更新嘅賽馬日提示' }),
  });
  assert.equal(updated.status, 200);
  const refreshed = await fetch(`${base}/api/bootstrap`, {
    headers: { Authorization: 'Bearer test-secret' },
  });
  const refreshedPayload = await refreshed.json();
  assert.equal(
    refreshedPayload.operationalNotices.find((notice) => notice.id === 'so_kon_po_happy_valley_race_day')
      .bodyZh,
    '已人手更新嘅賽馬日提示'
  );
});

test('seeded dated alerts mark HV race days and TD stadium closures, not fire drills', () => {
  const nov11 = datedAlertsForDate(datedRouteAlerts, '2026-11-11');
  const nov18 = datedAlertsForDate(datedRouteAlerts, '2026-11-18');
  const nov25 = datedAlertsForDate(datedRouteAlerts, '2026-11-25');
  for (const day of [nov11, nov18, nov25]) {
    assert.equal(day.length, 1);
    assert.equal(day[0].kind, 'race_day');
    assert.equal(day[0].session, 'night');
    assert.match(day[0].bodyZh, /加路連山道左轉禮頓道/);
    assert.match(day[0].bodyZh, /山光道/);
    assert.match(day[0].bodyZh, /山村道/);
    assert.match(day[0].bodyZh, /普通/);
    assert.match(day[0].sourceUrl, /index_id_88570/);
    assert.ok(!/改道提醒/.test(day[0].titleZh));
  }

  const nov1 = datedAlertsForDate(datedRouteAlerts, '2026-11-01');
  assert.ok(nov1.some((alert) => alert.kind === 'race_day' && alert.session === 'day'));
  const stadium = nov1.find((alert) => alert.kind === 'stadium_closure');
  assert.ok(stadium);
  assert.match(stadium.bodyZh, /封路/);
  assert.match(stadium.bodyZh, /學牌/);
  assert.match(stadium.sourceUrl, /index_id_89550/);

  assert.equal(datedAlertsForDate(datedRouteAlerts, '2026-11-09').length, 0);
  assert.ok(datedAlertsForDate(datedRouteAlerts, '2026-12-02').some((alert) => alert.kind === 'race_day'));
  assert.equal(datedAlertsForDate(datedRouteAlerts, '2026-11-08').length, 0);
});

test('dated alerts are seeded into existing ops.json without overwriting staff edits', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'passplus-ops-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'ops.json');
  const store = await new JsonStore(filePath).init();
  assert.equal(store.snapshot().datedRouteAlerts.length, datedRouteAlerts.length);
  assert.ok(store.snapshot().datedRouteAlerts.some((alert) => alert.id === 'hv_race_2026-11-11'));

  const legacy = store.snapshot();
  delete legacy.datedRouteAlerts;
  store.data = legacy;
  await store.persist();
  const reopened = await new JsonStore(filePath).init();
  assert.equal(reopened.snapshot().datedRouteAlerts.length, datedRouteAlerts.length);

  const data = {
    datedRouteAlerts: [
      {
        id: 'hv_race_2026-11-11',
        date: '2026-11-11',
        kind: 'race_day',
        bodyZh: '職員改過嘅夜賽提示',
        locationIds: ['so_kon_po'],
        active: true,
      },
    ],
  };
  assert.ok(mergeSeedDatedRouteAlerts(data) >= 1);
  assert.equal(
    data.datedRouteAlerts.find((alert) => alert.id === 'hv_race_2026-11-11').bodyZh,
    '職員改過嘅夜賽提示'
  );
  assert.ok(data.datedRouteAlerts.some((alert) => alert.id === 'stadium_2026-11-01_scout_rally'));
});

test('daily brief exposes dated alerts for that Hong Kong calendar day', async (t) => {
  const { directory, store } = await fixture();
  t.after(() => rm(directory, { recursive: true, force: true }));
  const data = store.snapshot();
  const raceBrief = buildDailyBrief(data, new Date('2026-11-11T04:00:00.000Z'));
  assert.ok(raceBrief.datedRouteAlerts.some((alert) => alert.id === 'hv_race_2026-11-11'));
  const fireDrill = buildDailyBrief(data, new Date('2026-11-09T04:00:00.000Z'));
  assert.equal(fireDrill.datedRouteAlerts.length, 0);
});

test('staff can create and update dated route alerts via API', async (t) => {
  const { directory, store } = await fixture();
  const server = await createOpsServer({ store, adminToken: 'test-secret' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;
  const headers = {
    Authorization: 'Bearer test-secret',
    'Content-Type': 'application/json',
  };

  const created = await fetch(`${base}/api/dated-route-alerts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date: '2026-12-30',
      kind: 'stadium_closure',
      session: 'day',
      titleZh: '大球場測試封路',
      bodyZh: '有 TD 通告先入。',
      locationIds: ['so_kon_po'],
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();

  const updated = await fetch(`${base}/api/dated-route-alerts/${createdBody.id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ bodyZh: '已改過嘅封路提示', active: true }),
  });
  assert.equal(updated.status, 200);

  const bootstrap = await fetch(`${base}/api/bootstrap`, {
    headers: { Authorization: 'Bearer test-secret' },
  });
  const payload = await bootstrap.json();
  assert.ok(payload.datedRouteAlerts.some((alert) => alert.id === 'hv_race_2026-11-18'));
  assert.equal(
    payload.datedRouteAlerts.find((alert) => alert.id === createdBody.id).bodyZh,
    '已改過嘅封路提示'
  );

  const invalid = await fetch(`${base}/api/dated-route-alerts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      date: '11/11/2026',
      kind: 'race_day',
      titleZh: '壞日期',
      bodyZh: '唔應該寫入',
    }),
  });
  assert.equal(invalid.status, 422);
});

test('OPS dashboard dated alerts block is collapsible on mobile', async (t) => {
  const { directory, store } = await fixture();
  const server = await createOpsServer({ store, adminToken: 'test-secret' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const html = await (await fetch(`${base}/`)).text();
  const css = await (await fetch(`${base}/styles.css`)).text();
  const js = await (await fetch(`${base}/app.js`)).text();

  assert.match(html, /data-dated-alerts-toggle/);
  assert.match(html, /有日期嘅賽馬日／封路/);
  assert.match(html, />\s*收起\s*</);
  assert.match(html, /data-dated-alerts-body/);
  assert.match(html, /data-direct-lesson-form/);
  assert.match(html, /直接新增已確認課堂/);
  assert.match(html, /STANDING ROUTE NOTICES/);
  assert.match(html, /不會自動發送/);
  assert.doesNotMatch(html, /src="\/src\//);

  assert.match(css, /\.dated-alerts-block\.is-collapsed \.dated-alerts-body/);
  assert.match(css, /max-width:\s*760px/);
  assert.match(css, /\.dated-alerts-block:not\(\.is-expanded\) \.dated-alerts-body/);

  assert.match(js, /ops-dated-alerts-collapsed/);
  assert.match(js, /localStorage\.setItem\(DATED_ALERTS_COLLAPSE_KEY/);
  assert.match(js, /collapsed \? '展開' : '收起'/);
  assert.match(js, /isNarrowViewport/);
});
