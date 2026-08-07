const state = {
  data: null,
  token: sessionStorage.getItem('ops-admin-token') || '',
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
            <p>${formatDate(lesson.scheduledStart)} · ${text(location?.labelZh)}</p>
          </article>`;
        })
        .join('')
    : '<div class="empty">未建立課堂</div>';
}

function renderWorkflows() {
  const root = $('[data-workflows]');
  root.replaceChildren();
  const workflows = [...state.data.workflows].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  $('[data-pending-count]').textContent = workflows.filter(
    (workflow) => workflow.status === 'pending_approval'
  ).length;

  if (!workflows.length) {
    root.innerHTML = '<div class="empty">未有排堂草稿</div>';
    return;
  }

  for (const workflow of workflows) {
    const node = $('[data-workflow-template]').content.cloneNode(true);
    const card = $('.workflow', node);
    const student = state.data.students.find((item) => item.id === workflow.studentId);
    $('[data-workflow-title]', card).textContent = `${student?.name ?? '學員'} · 排堂建議`;
    $('[data-created]', card).textContent = formatDate(workflow.createdAt);
    $('.status', card).textContent =
      workflow.status === 'pending_approval'
        ? '待批准'
        : workflow.status === 'approved'
          ? '已批准・待人手發送'
          : '已拒絕';
    const select = $('[data-slot]', card);
    select.innerHTML = workflow.proposedSlots
      .map(
        (slot) =>
          `<option value="${slot}" ${slot === workflow.selectedSlot ? 'selected' : ''}>${formatDate(slot)}</option>`
      )
      .join('');
    const draft = $('[data-draft]', card);
    draft.value = workflow.draftContent;
    const escalation = $('[data-escalation]', card);
    if (workflow.escalations.length) {
      escalation.hidden = false;
      escalation.textContent = `需要真人額外確認：${workflow.escalations.join('、')}`;
    }

    const isPending = workflow.status === 'pending_approval';
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
    root.append(node);
  }
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
  const input = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api('/api/students', { method: 'POST', body: JSON.stringify(input) });
    event.currentTarget.reset();
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
$('[data-token]').value = state.token;

const tomorrow = new Date(Date.now() + 24 * 60 * 60_000);
tomorrow.setHours(9, 0, 0, 0);
$('[name="preferredStart"]').value = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}T09:00`;

load().catch((error) => notice(error.message, true));
