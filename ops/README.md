# PassPlus Virtual Operations Department

Internal, cloud-ready pilot for scheduling and operations. It is deliberately separate from the
public Vite/GitHub Pages build because customer data, tokens, approvals, and audit logs must never
be shipped as static browser assets.

## What is implemented

- Unified JSON data model for students, instructors, locations, vehicles, lessons, exams, payments,
  workflow tasks, agent runs, and audit logs.
- Conflict checks for student, instructor, vehicle, and location.
- Three alternative time proposals within 14 days (08:00–20:00 Hong Kong time).
- Human approval queue with editable bilingual WhatsApp drafts.
- Draft-only reminders, rescheduling, weather, lateness, cancellation, and vehicle-change notices.
- Explicit escalation for refunds, licensing/legal answers, safety, complaints, special prices, and
  final cancellations.
- 14-day pilot metrics and a next-day operations brief.
- Permission foundations for sales, student-success, finance, and compliance agents.
- No automatic WhatsApp sending, payment commitment, refund, legal answer, or cancellation.

## Run locally

Requires Node 22 or later.

```bash
npm run ops:start
```

Open `http://localhost:8787`. Local development accepts an empty admin token. To test production
security:

```bash
OPS_ADMIN_TOKEN='replace-with-a-long-random-secret' npm run ops:start
```

Enter the same token in the dashboard. It is held in browser `sessionStorage`, not persisted by the
server.

Data defaults to `ops/data/ops.json`. Override it with `OPS_DATA_FILE`. The file is written
atomically and must be placed on encrypted persistent storage in production.

## Cloud deployment

Build the container:

```bash
docker build -f ops/Dockerfile -t passplus-ops .
docker run --rm -p 8787:8787 \
  -e NODE_ENV=production \
  -e OPS_ADMIN_TOKEN='replace-with-a-long-random-secret' \
  -e OPS_DATA_FILE=/data/ops.json \
  -v passplus-ops-data:/data \
  passplus-ops
```

Use a host with HTTPS and a persistent encrypted volume. Back up `/data/ops.json` daily. For
multiple concurrent server instances, migrate the store to Postgres before scaling beyond one
instance.

Required production controls:

1. Set a long random `OPS_ADMIN_TOKEN`; production refuses to start without it.
2. Restrict the ops hostname to staff (VPN, access proxy, or private network is preferred).
3. Do not reuse the public website domain or GitHub Pages deployment.
4. Collect only operationally necessary customer data and define a deletion schedule.
5. Rotate the token and test restore from backup before live use.

## Approval workflow

```text
Customer request
  -> operations agent creates a draft and three conflict-free slots
  -> workflow is pending_approval
  -> human edits and approves or rejects
  -> approved slot is locked
  -> approved message can be copied
  -> human sends it in WhatsApp
  -> human marks lesson confirmed/completed/cancelled/no-show
```

Approval never sends a message. Escalated workflows require an extra explicit confirmation.

### Supported draft endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/agent/operations/draft-schedule` | New lesson or exam-rental proposal |
| `POST /api/agent/operations/draft-reschedule` | Alternative slots for an existing lesson |
| `POST /api/agent/operations/draft-reminders` | Draft reminders for approved/confirmed lessons in the next 24 hours |
| `POST /api/agent/operations/draft-notice` | Weather, late, cancellation, or vehicle-change draft |
| `POST /api/workflows/:id/approve` | Human approval; never sends |
| `POST /api/workflows/:id/reject` | Human rejection with a reason |
| `POST /api/lessons/:id/status` | Human records confirmed/completed/cancelled/no-show |

## Unified data dictionary

| Entity | Operational purpose | Essential fields |
|---|---|---|
| Student | Identity and journey | name, WhatsApp, language, licensing stage, purchased/used lessons |
| Instructor | Availability resource | languages, default locations, active |
| Location | Conflict resource | Tin Kwong Road / So Kon Po, type, bilingual labels |
| Vehicle | Rental/training resource | code, model, location, availability |
| Lesson | Schedule and package usage | student, type, resources, start, duration, price snapshot, status |
| Exam | Countdown and rental coordination | student, part, date, status |
| Payment | Admin follow-up | student, amount, method, quoted/invoiced/paid |
| WorkflowTask | Human approval gate | draft, slots, escalation, status, approver timestamps |
| AuditLog | Accountability | actor, action, entity, metadata, timestamp |

Public prices are snapshotted from `src/pricing.js` when a lesson proposal is created.

## Two-week pilot

Start with one instructor and one training vehicle. For every real booking:

1. Add the student.
2. Generate a scheduling draft.
3. Edit and approve it.
4. Copy the approved message and send manually.
5. Mark the lesson outcome.
6. Review the dashboard daily.

The dashboard tracks:

- lessons created in the rolling 14-day window;
- pending approvals and average approval latency;
- draft approval rate;
- cancellation and no-show rates;
- lessons by type and location;
- next-day lessons, exams within 14 days, and unpaid quotes/invoices.

Only consider automatic low-risk reminders after two weeks with no resource double-bookings and a
reviewed audit trail. WhatsApp Business API integration remains intentionally out of scope.

## Future department boundaries

`ops/lib/agents.js` contains the shared agent registry:

- sales: lead follow-up drafts;
- student success: lesson reports, exam countdowns, review requests;
- finance: payment reminders and receipt drafts;
- compliance: knowledge reviews and policy alerts.

Every future agent currently has an empty `mayExecute` list. Activate each role only after its data,
approval policy, and escalation tests are complete.

## Test

```bash
npm test
npm run build
```
