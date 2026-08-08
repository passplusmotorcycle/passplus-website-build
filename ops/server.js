import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { JsonStore } from './lib/store.js';
import {
  agentRegistry,
  approveWorkflow,
  draftLessonReminders,
  draftOperationalNotice,
  draftRescheduleProposal,
  draftSchedulingProposal,
  rejectWorkflow,
} from './lib/agents.js';
import {
  assertEnum,
  licensingStages,
  lessonTypes,
  statuses,
  validateRequired,
} from './lib/domain.js';
import { buildDailyBrief, buildPilotMetrics } from './lib/scheduling.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(moduleDir, 'public');

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error('Request body is too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function secureEqual(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function authorized(req, adminToken) {
  if (!adminToken) return true;
  const authorization = req.headers.authorization ?? '';
  return (
    authorization.startsWith('Bearer ') &&
    secureEqual(authorization.slice('Bearer '.length), adminToken)
  );
}

function actor(req) {
  return String(req.headers['x-ops-actor'] || 'human-admin').slice(0, 100);
}

function publicStudent(student) {
  return {
    ...student,
    phone: student.phone ? `•••• ${student.phone.slice(-4)}` : '',
    whatsapp: student.whatsapp ? `•••• ${student.whatsapp.slice(-4)}` : '',
  };
}

function routeId(pathname, pattern) {
  const match = pathname.match(pattern);
  return match ? decodeURIComponent(match[1]) : null;
}

function createEntity(input, required, extra = {}) {
  validateRequired(input, required);
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    ...extra,
    ...input,
    createdAt: now,
    updatedAt: now,
  };
}

async function serveStatic(pathname, res) {
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  if (!['index.html', 'app.js', 'styles.css', 'favicon.svg'].includes(file)) return false;
  const mime = file.endsWith('.js')
    ? 'text/javascript; charset=utf-8'
    : file.endsWith('.css')
      ? 'text/css; charset=utf-8'
      : file.endsWith('.svg')
        ? 'image/svg+xml'
      : 'text/html; charset=utf-8';
  const content = await readFile(path.join(publicDir, file));
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': file === 'index.html' ? 'no-store' : 'public, max-age=300',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(content);
  return true;
}

export async function createOpsServer(options = {}) {
  const store =
    options.store ??
    (await new JsonStore(
      options.dataFile ?? process.env.OPS_DATA_FILE ?? path.join(moduleDir, 'data', 'ops.json')
    ).init());
  const adminToken = options.adminToken ?? process.env.OPS_ADMIN_TOKEN ?? '';

  if (process.env.NODE_ENV === 'production' && !adminToken) {
    throw new Error('OPS_ADMIN_TOKEN is required in production');
  }

  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const pathname = url.pathname;

      if (pathname === '/health') {
        return json(res, 200, { ok: true, service: 'passplus-ops' });
      }
      if (!pathname.startsWith('/api/')) {
        if (await serveStatic(pathname, res)) return;
        return json(res, 404, { error: 'Not found' });
      }
      if (!authorized(req, adminToken)) {
        res.setHeader('WWW-Authenticate', 'Bearer');
        return json(res, 401, { error: 'Admin token required' });
      }

      if (req.method === 'GET' && pathname === '/api/bootstrap') {
        const data = store.snapshot();
        return json(res, 200, {
          students: data.students.map(publicStudent),
          instructors: data.instructors,
          locations: data.locations,
          vehicles: data.vehicles,
          lessons: data.lessons,
          exams: data.exams,
          payments: data.payments,
          workflows: data.workflowTasks,
          lessonTypes,
          agents: agentRegistry,
          metrics: buildPilotMetrics(data),
          dailyBrief: buildDailyBrief(data, new Date(Date.now() + 24 * 60 * 60_000)),
          policy: {
            mode: 'draft_only',
            automaticSending: false,
            automaticRefunds: false,
            approvalRequired: true,
          },
        });
      }

      if (req.method === 'POST' && pathname === '/api/students') {
        const input = await body(req);
        assertEnum(input.preferredLanguage ?? 'zh-Hant', ['zh-Hant', 'en'], 'preferredLanguage');
        assertEnum(input.licensingStage ?? 'beginner', licensingStages, 'licensingStage');
        const student = createEntity(input, ['name', 'whatsapp'], {
          preferredLanguage: 'zh-Hant',
          licensingStage: 'beginner',
          purchasedLessons: 0,
          usedLessons: 0,
          attribution: {},
        });
        const value = await store.transact(actor(req), 'student.create', (data) => {
          data.students.push(student);
          return { entityType: 'student', entityId: student.id, value: publicStudent(student) };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/instructors') {
        const input = await body(req);
        const instructor = createEntity(input, ['name'], {
          languages: ['zh-Hant'],
          defaultLocationIds: [],
          active: true,
        });
        const value = await store.transact(actor(req), 'instructor.create', (data) => {
          data.instructors.push(instructor);
          return { entityType: 'instructor', entityId: instructor.id, value: instructor };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/vehicles') {
        const input = await body(req);
        assertEnum(input.status ?? 'available', statuses.vehicle, 'status');
        const vehicle = createEntity(input, ['code', 'locationId'], {
          model: '',
          status: 'available',
          active: true,
        });
        const value = await store.transact(actor(req), 'vehicle.create', (data) => {
          if (!data.locations.some((item) => item.id === vehicle.locationId)) {
            throw new Error('Location not found');
          }
          data.vehicles.push(vehicle);
          return { entityType: 'vehicle', entityId: vehicle.id, value: vehicle };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/exams') {
        const input = await body(req);
        assertEnum(input.status ?? 'planned', statuses.exam, 'status');
        const exam = createEntity(input, ['studentId', 'part', 'scheduledDate'], {
          status: 'planned',
        });
        const value = await store.transact(actor(req), 'exam.create', (data) => {
          if (!data.students.some((item) => item.id === exam.studentId)) {
            throw new Error('Student not found');
          }
          data.exams.push(exam);
          return { entityType: 'exam', entityId: exam.id, value: exam };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/payments') {
        const input = await body(req);
        assertEnum(input.status ?? 'quoted', ['quoted', 'invoiced', 'paid'], 'status');
        const payment = createEntity(input, ['studentId', 'amountHkd'], {
          status: 'quoted',
          method: 'pending',
        });
        const value = await store.transact(actor(req), 'payment.create', (data) => {
          if (!data.students.some((item) => item.id === payment.studentId)) {
            throw new Error('Student not found');
          }
          data.payments.push(payment);
          return { entityType: 'payment', entityId: payment.id, value: payment };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/agent/operations/draft-schedule') {
        const input = await body(req);
        const value = await store.transact('operations-agent', 'workflow.draft', (data) => {
          const result = draftSchedulingProposal(data, input);
          data.lessons.push(result.lesson);
          data.workflowTasks.push(result.workflow);
          data.agentRuns.push(result.agentRun);
          return {
            entityType: 'workflowTask',
            entityId: result.workflow.id,
            value: result,
            metadata: { policy: 'draft_only' },
          };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/agent/operations/draft-reschedule') {
        const input = await body(req);
        const value = await store.transact('operations-agent', 'workflow.reschedule-draft', (data) => {
          const result = draftRescheduleProposal(data, input);
          data.workflowTasks.push(result.workflow);
          data.agentRuns.push(result.agentRun);
          return {
            entityType: 'workflowTask',
            entityId: result.workflow.id,
            value: result,
            metadata: { policy: 'draft_only' },
          };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/agent/operations/draft-reminders') {
        const value = await store.transact('operations-agent', 'workflow.reminder-drafts', (data) => {
          const reminders = draftLessonReminders(data);
          data.workflowTasks.push(...reminders);
          data.agentRuns.push(
            ...reminders.map((workflow) => ({
              id: randomUUID(),
              agent: 'operations',
              action: 'draft_reminder',
              status: 'drafted',
              workflowTaskId: workflow.id,
              createdAt: workflow.createdAt,
            }))
          );
          return {
            entityType: 'workflowTask',
            entityId: null,
            value: { created: reminders.length, workflows: reminders },
            metadata: { policy: 'draft_only' },
          };
        });
        return json(res, 201, value);
      }

      if (req.method === 'POST' && pathname === '/api/agent/operations/draft-notice') {
        const input = await body(req);
        const value = await store.transact('operations-agent', 'workflow.notice-draft', (data) => {
          const workflow = draftOperationalNotice(data, input);
          data.workflowTasks.push(workflow);
          data.agentRuns.push({
            id: randomUUID(),
            agent: 'operations',
            action: `draft_${input.noticeType}_notice`,
            status: 'escalated',
            workflowTaskId: workflow.id,
            createdAt: workflow.createdAt,
          });
          return {
            entityType: 'workflowTask',
            entityId: workflow.id,
            value: { workflow },
            metadata: { policy: 'draft_only' },
          };
        });
        return json(res, 201, value);
      }

      const approveId = routeId(pathname, /^\/api\/workflows\/([^/]+)\/approve$/);
      if (req.method === 'POST' && approveId) {
        const input = await body(req);
        const value = await store.transact(actor(req), 'workflow.approve', (data) => {
          const result = approveWorkflow(data, approveId, input, actor(req));
          return {
            entityType: 'workflowTask',
            entityId: approveId,
            value: result,
            metadata: { messageSent: false },
          };
        });
        return json(res, 200, value);
      }

      const rejectId = routeId(pathname, /^\/api\/workflows\/([^/]+)\/reject$/);
      if (req.method === 'POST' && rejectId) {
        const input = await body(req);
        const value = await store.transact(actor(req), 'workflow.reject', (data) => {
          const result = rejectWorkflow(data, rejectId, input.reason, actor(req));
          return { entityType: 'workflowTask', entityId: rejectId, value: result };
        });
        return json(res, 200, value);
      }

      const lessonStatusId = routeId(pathname, /^\/api\/lessons\/([^/]+)\/status$/);
      if (req.method === 'POST' && lessonStatusId) {
        const input = await body(req);
        assertEnum(input.status, ['confirmed', 'completed', 'cancelled', 'no_show'], 'status');
        if (input.status === 'cancelled' && !input.reason?.trim()) {
          throw new Error('Cancellation reason is required');
        }
        const value = await store.transact(actor(req), 'lesson.status', (data) => {
          const lesson = data.lessons.find((item) => item.id === lessonStatusId);
          if (!lesson) throw new Error('Lesson not found');
          if (lesson.status === 'pending_approval') {
            throw new Error('Approve the scheduling workflow before changing lesson status');
          }
          lesson.status = input.status;
          lesson.statusReason = input.reason?.trim() ?? '';
          lesson.updatedAt = new Date().toISOString();
          return { entityType: 'lesson', entityId: lesson.id, value: lesson };
        });
        return json(res, 200, value);
      }

      if (req.method === 'GET' && pathname === '/api/metrics') {
        return json(res, 200, buildPilotMetrics(store.snapshot()));
      }
      if (req.method === 'GET' && pathname === '/api/reports/tomorrow') {
        return json(
          res,
          200,
          buildDailyBrief(store.snapshot(), new Date(Date.now() + 24 * 60 * 60_000))
        );
      }

      return json(res, 404, { error: 'Not found' });
    } catch (error) {
      const status =
        error instanceof SyntaxError ? 400 : /not found/i.test(error.message) ? 404 : 422;
      return json(res, status, { error: error.message });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const server = await createOpsServer();
  server.listen(port, () => {
    console.log(`PassPlus Ops listening on http://localhost:${port}`);
  });
}
