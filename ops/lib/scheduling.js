import { LESSON_DURATION_MINUTES, SLOT_STEP_MINUTES, lessonTypes } from './domain.js';

const ACTIVE_LESSON_STATUSES = new Set([
  'pending_approval',
  'approved',
  'confirmed',
  'completed',
]);

function asTime(value, field = 'date') {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error(`${field} must be a valid ISO date`);
  return time;
}

export function overlaps(startA, durationA, startB, durationB) {
  const a = asTime(startA, 'startA');
  const b = asTime(startB, 'startB');
  return a < b + durationB * 60_000 && b < a + durationA * 60_000;
}

export function schedulingConflicts(data, candidate, ignoredLessonId = null) {
  const duration = candidate.durationMinutes ?? LESSON_DURATION_MINUTES;
  const resourceFields = ['studentId', 'instructorId', 'vehicleId', 'locationId'];

  return data.lessons
    .filter(
      (lesson) =>
        lesson.id !== ignoredLessonId &&
        ACTIVE_LESSON_STATUSES.has(lesson.status) &&
        overlaps(candidate.scheduledStart, duration, lesson.scheduledStart, lesson.durationMinutes)
    )
    .flatMap((lesson) =>
      resourceFields
        .filter((field) => candidate[field] && candidate[field] === lesson[field])
        .map((field) => ({
          lessonId: lesson.id,
          resource: field.replace(/Id$/, ''),
          resourceId: candidate[field],
          scheduledStart: lesson.scheduledStart,
        }))
    );
}

function roundToStep(date, stepMinutes = SLOT_STEP_MINUTES) {
  const rounded = new Date(date);
  rounded.setUTCSeconds(0, 0);
  const minutes = rounded.getUTCMinutes();
  const remainder = minutes % stepMinutes;
  if (remainder) rounded.setUTCMinutes(minutes + stepMinutes - remainder);
  return rounded;
}

function withinHongKongOperatingHours(date) {
  const hkHour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Hong_Kong',
      hour: '2-digit',
      hour12: false,
    }).format(date)
  );
  return hkHour >= 8 && hkHour < 20;
}

export function proposeAvailableSlots(data, request, options = {}) {
  const desiredCount = options.count ?? 3;
  const maxDays = options.maxDays ?? 14;
  const ignoredLessonId = options.ignoredLessonId ?? null;
  const lessonType = lessonTypes[request.lessonType];
  if (!lessonType) throw new Error(`Unknown lesson type: ${request.lessonType}`);

  const start = roundToStep(new Date(request.preferredStart));
  if (!Number.isFinite(start.getTime())) throw new Error('preferredStart must be a valid ISO date');
  const end = start.getTime() + maxDays * 24 * 60 * 60_000;
  const slots = [];

  for (
    let cursor = start;
    cursor.getTime() <= end && slots.length < desiredCount;
    cursor = new Date(cursor.getTime() + SLOT_STEP_MINUTES * 60_000)
  ) {
    if (!withinHongKongOperatingHours(cursor)) continue;

    const candidate = {
      ...request,
      scheduledStart: cursor.toISOString(),
      durationMinutes: request.durationMinutes ?? LESSON_DURATION_MINUTES,
    };
    const conflicts = schedulingConflicts(data, candidate, ignoredLessonId);
    if (!conflicts.length) slots.push(candidate.scheduledStart);
  }

  return slots;
}

export function buildPilotMetrics(data, now = new Date()) {
  const lessons = data.lessons;
  const workflows = data.workflowTasks;
  const approvals = workflows.filter((task) => task.status === 'approved' || task.status === 'executed');
  const completed = lessons.filter((lesson) => lesson.status === 'completed');
  const cancelled = lessons.filter((lesson) => lesson.status === 'cancelled');
  const noShows = lessons.filter((lesson) => lesson.status === 'no_show');

  const approvalLatencies = approvals
    .map((task) => {
      const start = new Date(task.submittedAt ?? task.createdAt).getTime();
      const end = new Date(task.approvedAt).getTime();
      return Number.isFinite(start) && Number.isFinite(end) ? (end - start) / 60_000 : null;
    })
    .filter((value) => value !== null);

  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60_000);
  const recentLessons = lessons.filter(
    (lesson) => new Date(lesson.createdAt).getTime() >= twoWeeksAgo.getTime()
  );

  return {
    generatedAt: now.toISOString(),
    totals: {
      students: data.students.length,
      lessons: lessons.length,
      pendingApprovals: workflows.filter((task) => task.status === 'pending_approval').length,
      approvedDrafts: approvals.length,
      completedLessons: completed.length,
    },
    pilotWindow: {
      days: 14,
      lessonsCreated: recentLessons.length,
      cancellationRate:
        lessons.length > 0 ? Number(((cancelled.length / lessons.length) * 100).toFixed(1)) : 0,
      noShowRate:
        lessons.length > 0 ? Number(((noShows.length / lessons.length) * 100).toFixed(1)) : 0,
      averageApprovalMinutes:
        approvalLatencies.length > 0
          ? Number(
              (
                approvalLatencies.reduce((total, value) => total + value, 0) /
                approvalLatencies.length
              ).toFixed(1)
            )
          : null,
      draftApprovalRate:
        workflows.length > 0
          ? Number(((approvals.length / workflows.length) * 100).toFixed(1))
          : 0,
    },
    byLessonType: Object.fromEntries(
      Object.keys(lessonTypes).map((type) => [
        type,
        lessons.filter((lesson) => lesson.lessonType === type).length,
      ])
    ),
    byLocation: Object.fromEntries(
      data.locations.map((location) => [
        location.id,
        lessons.filter((lesson) => lesson.locationId === location.id).length,
      ])
    ),
  };
}

export function buildDailyBrief(data, date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const target = formatter.format(date);
  const lessons = data.lessons
    .filter((lesson) => formatter.format(new Date(lesson.scheduledStart)) === target)
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));

  return {
    date: target,
    lessons,
    pendingApprovals: data.workflowTasks.filter((task) => task.status === 'pending_approval'),
    examAlerts: data.exams.filter((exam) => {
      const days = (new Date(exam.scheduledDate) - date) / (24 * 60 * 60_000);
      return exam.status === 'booked' && days >= 0 && days <= 14;
    }),
    paymentAlerts: data.payments.filter(
      (payment) => payment.status === 'quoted' || payment.status === 'invoiced'
    ),
  };
}
