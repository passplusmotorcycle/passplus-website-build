import { lessonTypes } from './domain.js';

const REALIZED = new Set(['completed']);
const BOOKED = new Set(['approved', 'confirmed']);
const CANCELLED = new Set(['cancelled']);
const NO_SHOW = new Set(['no_show']);

export function lessonAmountHkd(lesson) {
  const snapshot = Number(lesson?.priceSnapshot?.amountHkd);
  if (Number.isFinite(snapshot)) return snapshot;
  const typed = Number(lessonTypes[lesson?.lessonType]?.priceHkd);
  return Number.isFinite(typed) ? typed : 0;
}

export function hongKongMonthKey(value) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}`;
}

function emptyBucket() {
  return {
    count: 0,
    realizedCount: 0,
    bookedCount: 0,
    cancelledCount: 0,
    noShowCount: 0,
    realizedHkd: 0,
    bookedHkd: 0,
    cancelledHkd: 0,
    noShowHkd: 0,
  };
}

function addLessonToBucket(bucket, lesson, amount) {
  bucket.count += 1;
  if (REALIZED.has(lesson.status)) {
    bucket.realizedCount += 1;
    bucket.realizedHkd += amount;
  } else if (BOOKED.has(lesson.status)) {
    bucket.bookedCount += 1;
    bucket.bookedHkd += amount;
  } else if (CANCELLED.has(lesson.status)) {
    bucket.cancelledCount += 1;
    bucket.cancelledHkd += amount;
  } else if (NO_SHOW.has(lesson.status)) {
    bucket.noShowCount += 1;
    bucket.noShowHkd += amount;
  }
}

function paymentAmount(payment) {
  const amount = Number(payment?.amountHkd);
  return Number.isFinite(amount) ? amount : 0;
}

export function buildAccountingReport(data, options = {}) {
  const month = options.month || null;
  const now = options.now ?? new Date();
  const lessons = (data.lessons ?? []).filter((lesson) => {
    if (!lesson?.scheduledStart) return false;
    return month ? hongKongMonthKey(lesson.scheduledStart) === month : true;
  });

  const totals = emptyBucket();
  const byLessonType = Object.fromEntries(Object.keys(lessonTypes).map((type) => [type, emptyBucket()]));
  const byLocation = Object.fromEntries((data.locations ?? []).map((location) => [location.id, emptyBucket()]));
  const byMonth = {};
  const byStudent = {};

  for (const lesson of lessons) {
    const amount = lessonAmountHkd(lesson);
    addLessonToBucket(totals, lesson, amount);

    if (!byLessonType[lesson.lessonType]) byLessonType[lesson.lessonType] = emptyBucket();
    addLessonToBucket(byLessonType[lesson.lessonType], lesson, amount);

    if (lesson.locationId) {
      if (!byLocation[lesson.locationId]) byLocation[lesson.locationId] = emptyBucket();
      addLessonToBucket(byLocation[lesson.locationId], lesson, amount);
    }

    const monthKey = hongKongMonthKey(lesson.scheduledStart);
    if (!byMonth[monthKey]) byMonth[monthKey] = emptyBucket();
    addLessonToBucket(byMonth[monthKey], lesson, amount);

    if (lesson.studentId) {
      if (!byStudent[lesson.studentId]) byStudent[lesson.studentId] = emptyBucket();
      addLessonToBucket(byStudent[lesson.studentId], lesson, amount);
    }
  }

  const payments = (data.payments ?? []).filter((payment) => {
    const when = payment.paidAt ?? payment.updatedAt ?? payment.createdAt;
    if (!when || !month) return true;
    return hongKongMonthKey(when) === month;
  });

  const paymentsByStatus = {
    quoted: { count: 0, amountHkd: 0 },
    invoiced: { count: 0, amountHkd: 0 },
    paid: { count: 0, amountHkd: 0 },
    refunded: { count: 0, amountHkd: 0 },
  };
  for (const payment of payments) {
    const status = paymentsByStatus[payment.status] ? payment.status : 'quoted';
    paymentsByStatus[status].count += 1;
    paymentsByStatus[status].amountHkd += paymentAmount(payment);
  }

  const lines = [...lessons]
    .sort((a, b) => new Date(b.scheduledStart) - new Date(a.scheduledStart))
    .slice(0, 80)
    .map((lesson) => ({
      id: lesson.id,
      studentId: lesson.studentId,
      lessonType: lesson.lessonType,
      locationId: lesson.locationId,
      scheduledStart: lesson.scheduledStart,
      status: lesson.status,
      amountHkd: lessonAmountHkd(lesson),
    }));

  const studentLeaderboard = Object.entries(byStudent)
    .map(([studentId, bucket]) => ({ studentId, ...bucket }))
    .sort((a, b) => b.realizedHkd + b.bookedHkd - (a.realizedHkd + a.bookedHkd))
    .slice(0, 10);

  const availableMonths = [...new Set((data.lessons ?? []).map((lesson) => hongKongMonthKey(lesson.scheduledStart)))]
    .filter((key) => /^\d{4}-\d{2}$/.test(key))
    .sort()
    .reverse();

  return {
    generatedAt: now.toISOString(),
    month,
    timezone: 'Asia/Hong_Kong',
    note: '課堂金額取自排堂時嘅收費快照。已完成＝已實現；已確認／已批准＝未上堂預訂；取消同缺席分開計。付款紀錄係另外人手登記，唔會自動跟課堂。',
    totals,
    byLessonType,
    byLocation,
    byMonth,
    studentLeaderboard,
    payments: {
      ...paymentsByStatus,
      outstandingHkd: paymentsByStatus.quoted.amountHkd + paymentsByStatus.invoiced.amountHkd,
    },
    availableMonths,
    lines,
  };
}
