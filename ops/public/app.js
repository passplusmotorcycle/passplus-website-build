const state = {
  data: null,
  token: sessionStorage.getItem('ops-admin-token') || '',
  calendarYear: null,
  calendarMonth: null,
  selectedDate: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function headers() {
  return {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    'X-Ops-Actor': 'dashboard-admin',
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...options.headers } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function notice(message, error = false) {
  const element = $('[data-notice]');
  element.textContent = message;
  element.hidden = false;
  element.classList.toggle('is-error', error);
  window.setTimeout(() => {
    element.hidden = true;
  }, 5000);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function hongKongDateParts(value = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Hong_Kong',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(new Date(value))
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
}

function dateKey(value = new Date()) {
  const parts = hongKongDateParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function keyForDay(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTime(value) {
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'Asia/Hong_Kong',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function formatCalendarDate(key, options = {}) {
  const [year, month, day] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'UTC',
    year: options.short ? undefined : 'numeric',
    month: options.short ? 'short' : 'long',
    day: 'numeric',
    weekday: options.weekday === false ? undefined : 'short',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function lessonsForDate(key) {
  return (state.data?.lessons ?? [])
    .filter((lesson) => dateKey(lesson.scheduledStart) === key)
    .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
}

function calendarLessonCard(lesson) {
  const student = state.data.students.find((item) => item.id === lesson.studentId);
  const location = state.data.locations.find((item) => item.id === lesson.locationId);
  const type = state.data.lessonTypes[lesson.lessonType];
  return `<article class="calendar-lesson ${lesson.status === 'cancelled' ? 'is-cancelled' : ''}">
    <time>${formatTime(lesson.scheduledStart)}</time>
    <div>
      <strong>${text(student?.name ?? '未命名學員')} · ${text(type?.labelZh ?? lesson.lessonType)}</strong>
      <p>${text(location?.labelZh ?? '')} · ${text(lesson.status)}</p>
    </div>
  </article>`;
}

function renderCalendar() {
  if (!state.data || state.calendarYear == null || state.calendarMonth == null) return;
  const year = state.calendarYear;
  const month = state.calendarMonth;
  const today = dateKey();
  const monthDate = new Date(Date.UTC(year, month, 1, 12));
  $('[data-calendar-title]').textContent = new Intl.DateTimeFormat('zh-HK', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
  }).format(monthDate);

  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = [];
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push('<div class="calendar-day is-empty" aria-hidden="true"></div>');
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = keyForDay(year, month, day);
    const lessons = lessonsForDate(key);
    const preview = lessons
      .slice(0, 2)
      .map((lesson) => {
        const type = state.data.lessonTypes[lesson.lessonType];
        return `<span class="calendar-event">${formatTime(lesson.scheduledStart)} ${text(type?.labelZh ?? '')}</span>`;
      })
      .join('');
    cells.push(`<button
      type="button"
      class="calendar-day ${key === today ? 'is-today' : ''} ${key === state.selectedDate ? 'is-selected' : ''}"
      data-calendar-date="${key}"
      aria-label="${formatCalendarDate(key)}，${lessons.length}堂課"
    >
      <span class="calendar-day-number">${day}</span>
      <span class="calendar-event-count">${lessons.length ? `${lessons.length}堂` : ''}</span>
      <span class="calendar-events">${preview}</span>
    </button>`);
  }
  $('[data-calendar-grid]').innerHTML = cells.join('');

  $$('[data-calendar-date]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDate = button.dataset.calendarDate;
      renderCalendar();
    });
  });

  const todayLessons = lessonsForDate(today);
  $('[data-today-date]').textContent = formatCalendarDate(today);
  $('[data-today-lessons]').innerHTML = todayLessons.length
    ? todayLessons.map(calendarLessonCard).join('')
    : '<div class="empty">今日未有課堂</div>';

  const selectedLessons = lessonsForDate(state.selectedDate);
  $('[data-selected-date]').textContent = formatCalendarDate(state.selectedDate);
  $('[data-selected-count]').textContent = `${selectedLessons.length} 堂`;
  $('[data-selected-lessons]').innerHTML = selectedLessons.length
    ? selectedLessons.map(calendarLessonCard).join('')
    : '<div class="empty">當日未有課堂</div>';
}

function text(value) {
  const span = document.createElement('span');
  span.textContent = String(value ?? '');
  return span.innerHTML;
}

function renderStats() {
  const { totals, pilotWindow } = state.data.metrics;
  const items = [
    ['學員', totals.students],
    ['待批准', totals.pendingApprovals],
    ['14 日新課堂', pilotWindow.lessonsCreated],
    ['平均批准時間', pilotWindow.averageApprovalMinutes == null ? '未有數據' : `${pilotWindow.averageApprovalMinutes} 分鐘`],
  ];
  $('[data-stats]').innerHTML = items
    .map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong></article>`)
    .join('');
}

function renderSelects() {
  const students = state.data.students;
  $('[data-student-select]').innerHTML = students.length
    ? students.map((student) => `<option value="${student.id}">${text(student.name)}</option>`).join('')
    : '<option value="">請先新增學員</option>';
  $('[data-lesson-type]').innerHTML = Object.entries(state.data.lessonTypes)
    .map(([id, item]) => `<option value="${id}">${text(item.labelZh)} · HK$${item.priceHkd}</option>`)
    .join('');
  $('[data-location]').innerHTML = state.data.locations
    .filter((location) => location.active)
    .map((location) => `<option value="${location.id}">${text(location.labelZh)}</option>`)
    .join('');
}

function renderStudents() {
  $('[data-students]').innerHTML = state.data.students.length
    ? state.data.students
        .map(
          (student) => `<tr>
            <td>${text(student.name)}</td>
            <td>${text(student.whatsapp)}</td>
            <td>${text(student.licensingStage)}</td>
            <td>${student.purchasedLessons ?? 0}／${student.usedLessons ?? 0}</td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="4">未有學員</td></tr>';

  $('[data-lessons]').innerHTML = state.data.lessons.length
    ? state.data.lessons
        .sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart))
        .map((lesson) => {
          const student = state.data.students.find((item) => item.id === lesson.studentId);
          const location = state.data.locations.find((item) => item.id === lesson.locationId);
          const type = state.data.lessonTypes[lesson.lessonType];
          return `<article class="card">
            <span class="status">${text(lesson.status)}</span>
            <h3>${text(student?.name)} · ${text(type?.labelZh)}</h3>
            <p>${formatDate(lesson.scheduledStart)}</p>
            <p><strong>地點：${text(location?.labelZh || '未設定')}</strong></p>
            <div class="actions" data-lesson-actions="${lesson.id}">
              <button type="button" class="secondary" data-reschedule>改期草稿</button>
              <button type="button" class="secondary" data-weather>天氣通知草稿</button>
              <button type="button" data-confirm>標記已確認</button>
              <button type="button" data-complete>標記已完成</button>
              <button type="button" class="danger" data-cancel>記錄取消</button>
            </div>
          </article>`;
        })
        .join('')
    : '<div class="empty">未建立課堂</div>';

  $$('[data-lesson-actions]').forEach((actions) => {
    const lessonId = actions.dataset.lessonActions;
    $('[data-reschedule]', actions).addEventListener('click', () => draftReschedule(lessonId));
    $('[data-weather]', actions).addEventListener('click', () => draftNotice(lessonId, 'weather'));
    $('[data-confirm]', actions).addEventListener('click', () => updateLessonStatus(lessonId, 'confirmed'));
    $('[data-complete]', actions).addEventListener('click', () => updateLessonStatus(lessonId, 'completed'));
    $('[data-cancel]', actions).addEventListener('click', () => updateLessonStatus(lessonId, 'cancelled'));
  });
}

async function draftReschedule(lessonId) {
  const preferredStart = window.prompt('輸入最早可行時間，例如 2026-08-10T09:00');
  if (!preferredStart) return;
  const parsed = new Date(preferredStart);
  if (!Number.isFinite(parsed.getTime())) return notice('日期格式不正確。', true);
  try {
    await api('/api/agent/operations/draft-reschedule', {
      method: 'POST',
      body: JSON.stringify({ lessonId, preferredStart: parsed.toISOString(), notes: '' }),
    });
    notice('已建立改期草稿，原有時段未被更改。');
    await load();
    $('[data-tab="approvals"]').click();
  } catch (error) {
    notice(error.message, true);
  }
}

async function draftNotice(lessonId, noticeType) {
  const notes = window.prompt('請輸入供真人審核嘅通知內容');
  if (!notes) return;
  try {
    await api('/api/agent/operations/draft-notice', {
      method: 'POST',
      body: JSON.stringify({ lessonId, noticeType, notes }),
    });
    notice('已建立高風險通知草稿，課堂安排未被更改。');
    await load();
    $('[data-tab="approvals"]').click();
  } catch (error) {
    notice(error.message, true);
  }
}

async function updateLessonStatus(lessonId, status) {
  const reason = status === 'cancelled' ? window.prompt('取消原因（必填）') : '';
  if (status === 'cancelled' && !reason) return;
  try {
    await api(`/api/lessons/${lessonId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
    notice(`課堂已標記為 ${status}。`);
    await load();
  } catch (error) {
    notice(error.message, true);
  }
}

function renderWorkflows() {
  const root = $('[data-workflows]');
  root.replaceChildren();
  const allWorkflows = [...state.data.workflows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const pendingWorkflows = allWorkflows.filter(
    (workflow) => workflow.status === 'pending_approval'
  );
  const recentDecided = allWorkflows
    .filter((workflow) => workflow.status === 'approved' || workflow.status === 'rejected')
    .slice(0, 5);

  $('[data-pending-count]').textContent = String(pendingWorkflows.length);

  if (!pendingWorkflows.length) {
    root.innerHTML = '<div class="empty">目前沒有待批准事項</div>';
  }

  for (const workflow of pendingWorkflows) {
    root.append(createWorkflowCard(workflow, true));
  }

  if (recentDecided.length) {
    const heading = document.createElement('div');
    heading.className = 'section-heading';
    heading.innerHTML = '<h3>最近已處理</h3><span class="footnote">不會計入上方待批准數目</span>';
    root.append(heading);
    for (const workflow of recentDecided) {
      root.append(createWorkflowCard(workflow, false));
    }
  }
}

function createWorkflowCard(workflow, isPending) {
  const node = $('[data-workflow-template]').content.cloneNode(true);
  const card = $('.workflow', node);
  const student = state.data.students.find((item) => item.id === workflow.studentId);
  const lesson = state.data.lessons.find((item) => item.id === workflow.entityId);
  const location = state.data.locations.find((item) => item.id === lesson?.locationId);
  const workflowLabels = {
    schedule_lesson: '排堂建議',
    reschedule_lesson: '改期建議',
    lesson_reminder: '課堂提醒',
    weather_notice: '天氣安排',
    late_notice: '遲到安排',
    cancellation_notice: '取消安排',
    vehicle_change_notice: '車輛更改',
  };
  $('[data-workflow-title]', card).textContent =
    `${student?.name ?? '學員'} · ${workflowLabels[workflow.type] ?? workflow.type}`;
  $('[data-created]', card).textContent = formatDate(workflow.createdAt);
  $('.status', card).textContent =
    workflow.status === 'pending_approval'
      ? '待批准'
      : workflow.status === 'approved'
        ? '已批准・待人手發送'
        : '已拒絕';
  const locationLine = $('[data-workflow-location]', card);
  if (locationLine) {
    locationLine.textContent = location
      ? `地點：${location.labelZh}`
      : '地點：未有課堂地點資料';
  }
  const select = $('[data-slot]', card);
  select.innerHTML = (workflow.proposedSlots || [])
    .map(
      (slot) =>
        `<option value="${slot}" ${slot === workflow.selectedSlot ? 'selected' : ''}>${formatDate(slot)}</option>`
    )
    .join('');
  select.parentElement.hidden = !(workflow.proposedSlots || []).length;
  const draft = $('[data-draft]', card);
  draft.value = workflow.draftContent;
  const escalation = $('[data-escalation]', card);
  if (workflow.escalations?.length) {
    escalation.hidden = false;
    escalation.textContent = `需要真人額外確認：${workflow.escalations.join('、')}`;
  }

  $('[data-approve]', card).hidden = !isPending;
  $('[data-reject]', card).hidden = !isPending;
  select.disabled = !isPending;
  draft.disabled = !isPending;
  $('[data-copy]', card).disabled = workflow.status !== 'approved';

  $('[data-approve]', card).addEventListener('click', async () => {
    try {
      await api(`/api/workflows/${workflow.id}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          selectedSlot: select.value,
          draftContent: draft.value,
          confirmEscalationReview: workflow.escalations.length
            ? window.confirm('你確認已由真人審核高風險內容？')
            : false,
        }),
      });
      notice('時段已批准；訊息仍未發送。');
      await load();
    } catch (error) {
      notice(error.message, true);
    }
  });
  $('[data-copy]', card).addEventListener('click', async () => {
    await navigator.clipboard.writeText(workflow.draftContent);
    notice('已複製經批准訊息，請由真人在 WhatsApp 發送。');
  });
  $('[data-reject]', card).addEventListener('click', async () => {
    const reason = window.prompt('請輸入拒絕原因');
    if (!reason) return;
    try {
      await api(`/api/workflows/${workflow.id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      notice('草稿已拒絕並保留審計記錄。');
      await load();
    } catch (error) {
      notice(error.message, true);
    }
  });
  return node;
}

function renderBrief() {
  const brief = state.data.dailyBrief;
  const blocks = [
    [
      `課堂 · ${brief.date}`,
      brief.lessons.length
        ? brief.lessons.map((lesson) => `<p>${formatDate(lesson.scheduledStart)}</p>`).join('')
        : '<p>未有課堂</p>',
    ],
    ['考試倒數（14 日）', `<strong>${brief.examAlerts.length}</strong><p>需要跟進</p>`],
    ['付款待辦', `<strong>${brief.paymentAlerts.length}</strong><p>報價／發票未完成</p>`],
  ];
  $('[data-brief]').innerHTML = blocks
    .map(([title, content]) => `<article class="card"><h3>${title}</h3>${content}</article>`)
    .join('');
}

function renderAgents() {
  const labels = {
    operations: '排堂及營運',
    sales: '招生及客服',
    student_success: '學員成功',
    finance: '財務行政',
    compliance: '品質及合規',
  };
  $('[data-agents]').innerHTML = Object.entries(state.data.agents)
    .map(
      ([id, agent]) => `<article class="card">
        <span class="status">${agent.status === 'active' ? '運作中' : '基礎已建立'}</span>
        <h3>${labels[id]}</h3>
        <p>可建立草稿：${agent.mayDraft.join('、') || '沒有'}</p>
        <p>可自動執行：${agent.mayExecute.length ? agent.mayExecute.join('、') : '沒有'}</p>
      </article>`
    )
    .join('');
}

async function load() {
  state.data = await api('/api/bootstrap');
  renderStats();
  renderSelects();
  renderStudents();
  renderWorkflows();
  renderBrief();
  renderAgents();
  renderCalendar();
}

$$('[data-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('[data-tab]').forEach((item) => item.classList.toggle('is-active', item === tab));
    $$('[data-panel]').forEach((panel) =>
      panel.classList.toggle('is-active', panel.dataset.panel === tab.dataset.tab)
    );
  });
});

$('[data-save-token]').addEventListener('click', async () => {
  state.token = $('[data-token]').value.trim();
  sessionStorage.setItem('ops-admin-token', state.token);
  try {
    await load();
    notice('已連接營運系統。');
  } catch (error) {
    notice(error.message, true);
  }
});

$('[data-student-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const input = Object.fromEntries(new FormData(form));
  try {
    await api('/api/students', { method: 'POST', body: JSON.stringify(input) });
    form.reset();
    notice('學員已儲存。');
    await load();
  } catch (error) {
    notice(error.message, true);
  }
});

$('[data-schedule-form]').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = Object.fromEntries(new FormData(event.currentTarget));
  if (!input.studentId) return notice('請先新增學員。', true);
  input.preferredStart = new Date(input.preferredStart).toISOString();
  try {
    await api('/api/agent/operations/draft-schedule', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    notice('已建立排堂草稿，等待真人批准。');
    await load();
    $('[data-tab="approvals"]').click();
  } catch (error) {
    notice(error.message, true);
  }
});

$('[data-refresh]').addEventListener('click', () => load().catch((error) => notice(error.message, true)));
$('[data-calendar-prev]').addEventListener('click', () => {
  state.calendarMonth -= 1;
  if (state.calendarMonth < 0) {
    state.calendarMonth = 11;
    state.calendarYear -= 1;
  }
  state.selectedDate = keyForDay(state.calendarYear, state.calendarMonth, 1);
  renderCalendar();
});
$('[data-calendar-next]').addEventListener('click', () => {
  state.calendarMonth += 1;
  if (state.calendarMonth > 11) {
    state.calendarMonth = 0;
    state.calendarYear += 1;
  }
  state.selectedDate = keyForDay(state.calendarYear, state.calendarMonth, 1);
  renderCalendar();
});
$('[data-calendar-today]').addEventListener('click', () => {
  const parts = hongKongDateParts();
  state.calendarYear = Number(parts.year);
  state.calendarMonth = Number(parts.month) - 1;
  state.selectedDate = dateKey();
  renderCalendar();
});
$('[data-draft-reminders]').addEventListener('click', async () => {
  try {
    const result = await api('/api/agent/operations/draft-reminders', {
      method: 'POST',
      body: '{}',
    });
    notice(`已建立 ${result.created} 個提醒草稿；未有訊息發送。`);
    await load();
    $('[data-tab="approvals"]').click();
  } catch (error) {
    notice(error.message, true);
  }
});
$('[data-token]').value = state.token;

const calendarNow = hongKongDateParts();
state.calendarYear = Number(calendarNow.year);
state.calendarMonth = Number(calendarNow.month) - 1;
state.selectedDate = dateKey();

const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
tomorrow.setHours(9, 0, 0, 0);
$('[name="preferredStart"]').value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T09:00`;

load().catch((error) => notice(error.message, true));
