import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { JsonStore } from '../lib/store.js';
import {
  agentRegistry,
  approveWorkflow,
  detectEscalations,
  draftLessonReminders,
  draftSchedulingProposal,
} from '../lib/agents.js';
import { schedulingConflicts } from '../lib/scheduling.js';
import { createOpsServer } from '../server.js';

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
