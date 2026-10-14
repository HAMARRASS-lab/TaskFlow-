# TaskFlow — full-stack task management

| Layer     | Stack |
|-----------|-------|
| Backend   | Java 21, Spring Boot 3.3, Spring Security + JWT (jjwt), Spring Data JPA, Flyway, PostgreSQL, OpenAPI |
| Frontend  | Angular 18 (standalone), NgRx (store, effects, entity), Angular Material |
| Tests     | JUnit 5 + Mockito + MockMvc (H2), Jest (jest-preset-angular), Cypress |
| Ops       | Docker (multi-stage), docker-compose, GitHub Actions CI |

```
taskflow/
├── backend/                 Spring Boot API  (com.taskflow)
│   ├── auth/                register / login / me  (JWT)
│   ├── task/                CRUD + status for the current user's tasks
│   ├── meeting/             shared meetings calendar (invitations, accept/decline, overlap check)
│   ├── security/            JwtService, JwtAuthFilter
│   ├── config/              SecurityConfig (stateless, CORS), OpenAPI
│   └── resources/db/migration   Flyway SQL migrations
├── frontend/                Angular SPA
│   ├── src/app/core/auth    AuthService, interceptor, guards, NgRx auth store
│   ├── src/app/features/    login, register, task board, meetings calendar (NgRx stores)
│   └── cypress/             E2E specs (API stubbed with cy.intercept)
├── docker-compose.yml       postgres + backend + frontend (nginx)
└── .github/workflows/ci-cd.yml   CI: tests + build
```

## Run locally

**Option A — everything in Docker**

```bash
docker compose up --build
# app:     http://localhost:8081
# API:     http://localhost:8080/swagger-ui.html
```

**Option B — dev mode**

```bash
docker compose up -d db                 # PostgreSQL only
cd backend && mvn spring-boot:run       # http://localhost:8080
cd frontend && npm install && npm start # http://localhost:4200 (proxies /api → 8080)
```

In IntelliJ: run `TaskflowApplication` and, for the front, the `start` npm script.

## Tests

```bash
cd backend  && mvn verify          # JUnit unit + integration tests, JaCoCo report in target/site/jacoco
cd frontend && npm test            # Jest
cd frontend && npm start & npm run e2e   # Cypress (headless); npm run e2e:open for the UI
```

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | `{email, password, fullName}` → `{token, expiresIn, user}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, expiresIn, user}` |
| GET | `/api/auth/me` | current user (incl. `emailVerified`, `digestEnabled`) |
| PATCH | `/api/auth/me/preferences` | `{digestEnabled}` — turn the daily digest on / off |
| POST | `/api/auth/forgot-password` | `{email}` → 204 always; emails a reset link (valid 1 h) if the account exists |
| POST | `/api/auth/reset-password` | `{token, password}` → 204; 400 if the link is invalid, used or expired |
| POST | `/api/auth/verify-email` | `{token}` → the verified user |
| POST | `/api/auth/verify-email/resend` | emails a new confirmation link (the previous one stops working) |
| GET | `/api/tasks?status=TODO` | list my tasks (optional filter) |
| GET | `/api/tasks/{id}` | one task |
| POST | `/api/tasks` | create `{title, description?, status?, priority?, dueDate?, labels?, checklist?}` |
| PUT | `/api/tasks/{id}` | update — `labels` / `checklist` replace the current ones; omit them to keep them |
| PATCH | `/api/tasks/{id}/status` | `{status}` |
| PATCH | `/api/tasks/{id}/checklist/{itemId}` | tick / untick a checklist item `{done}` |
| DELETE | `/api/tasks/{id}` | delete |
| GET | `/api/users/task-owners` | users who created at least one task, with `todo/inProgress/done/total` counts |
| GET | `/api/users/{id}/tasks?status=` | that user's tasks, read-only (404 if the user doesn't exist) |
| GET | `/api/meetings?from=&to=` | meetings I organize or am invited to, overlapping `[from, to)` (ISO local date-times, optional) |
| GET | `/api/meetings/invitations` | upcoming meetings shared with me that I have not answered |
| GET | `/api/meetings/{id}` | one meeting |
| POST | `/api/meetings` | create `{title, startAt, endAt, description?, location?, participants?}` — 400 if `endAt <= startAt`, 409 if it overlaps another meeting |
| PUT | `/api/meetings/{id}` | update (organizer only, else 403) — rescheduling resets answers to `PENDING` |
| PATCH | `/api/meetings/{id}/response` | invitee answers `{status: ACCEPTED \| DECLINED}` — 409 if accepting overlaps their agenda |
| DELETE | `/api/meetings/{id}` | delete (organizer only) |
| GET | `/api/meetings/{id}/ics` | the meeting as an `.ics` file (import into Google Calendar, Outlook…) |
| GET | `/api/calendar/feed` | my private calendar subscription URL (`{url}`, `null` if off) |
| POST | `/api/calendar/feed` | create / regenerate the subscription URL (the old one stops working) |
| DELETE | `/api/calendar/feed` | turn the subscription off |
| GET | `/api/calendar/feed/{token}` | **public** — iCalendar feed polled by calendar apps; the secret token is the credential |
| GET | `/api/admin/users` | **admin** — all users |
| POST | `/api/admin/users` | **admin** — create `{email, password, fullName, role?}` |
| PUT | `/api/admin/users/{id}` | **admin** — update `{email, fullName, role, password?}` (empty password keeps it; can't remove your own admin role) |
| DELETE | `/api/admin/users/{id}` | **admin** — delete a user and their tasks/meetings (not yourself) |
| POST | `/api/admin/users/{id}/tasks` | **admin** — create a task assigned to that user |
| PATCH | `/api/admin/tasks/{id}/assignee` | **admin** — reassign a task `{userId}` |

All `/api/tasks`, `/api/users`, `/api/meetings` and `/api/calendar/feed` (except the `{token}` feed itself) endpoints require `Authorization: Bearer <token>`; `/api/admin/**` also requires the `ADMIN` role (403 otherwise).

**Admins** — the emails in `ADMIN_EMAILS` get the `ADMIN` role at startup (existing accounts) and when they register. Admins see an **Admin** page (add / edit / delete users, assign a new task to someone) and can reassign any task from the Team page.

**Board, labels and checklists** — the task board opens as a Kanban (To do / In progress / Done): drag a card to another column to change its status (applied immediately, rolled back if the API refuses). A List view keeps the card grid with the status filter. Tasks carry up to 10 free-form labels (`labels: ["bug", "frontend"]`, stored trimmed and lower-cased, shown as coloured chips, filterable) and a checklist of up to 50 subtasks (`checklist: [{id?, title, done}]` — send an existing item's `id` to keep it), shown on the card as "3/5 done".

**Emails** — new accounts get a confirmation link (they can use the app right away; a banner reminds them until they confirm). "Forgot password?" on the login page emails a single-use reset link. Link tokens are stored hashed (SHA-256) in `user_tokens`. On weekday mornings (`DIGEST_CRON`), verified users get a **daily digest**: overdue tasks, tasks due in the next 7 days and today's meetings (no email on an empty day); it can be turned off from the account menu (⚙). Locally, `docker compose up` starts **Mailpit**, which catches every email at http://localhost:8025; without SMTP (`MAIL_ENABLED=false`) emails are written to the backend log instead.

**Google Calendar sync** — Calendar → **Sync** creates a private iCalendar URL to add in Google Calendar (*Other calendars → + → From URL*), Outlook or Apple Calendar: a read-only copy of the meetings you organize or haven't declined, refreshed by the calendar app (Google: every few hours). Each meeting can also be downloaded as an `.ics` file. Meeting times are interpreted in `APP_TIMEZONE`.

**Meeting sharing** — a participant whose email matches a registered user sees the meeting in their calendar (read-only) and can accept or decline it. Other participants (plain names, unknown emails) are informational. Double-booking is checked against the meetings a user organizes or has accepted.

## Configuration (backend env vars)

| Variable | Default |
|----------|---------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `localhost` / `5432` / `taskflow` / `taskflow` / `taskflow` |
| `JWT_SECRET` | dev key — **set a Base64 key ≥ 256 bits in production** (`openssl rand -base64 48`) |
| `JWT_EXPIRATION_MS` | `86400000` (24 h) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` |
| `PORT` | `8080` |
| `ADMIN_EMAILS` | `h.hamarrass1@gmail.com` (comma-separated) |
| `FRONTEND_URL` | `http://localhost:4200` — public app URL used in emailed links and the calendar feed URL |
| `APP_TIMEZONE` | `Europe/Paris` — zone of meeting times and of the digest schedule |
| `MAIL_ENABLED` | `false` — when false, emails are only logged |
| `MAIL_HOST` / `MAIL_PORT` / `MAIL_USERNAME` / `MAIL_PASSWORD` | `localhost` / `1025` / – / – (SMTP server) |
| `MAIL_SMTP_AUTH` / `MAIL_STARTTLS` | `false` / `false` (set both to `true` for most providers, port 587) |
| `MAIL_FROM` | `TaskFlow <no-reply@taskflow.local>` |
| `DIGEST_CRON` | `0 0 7 * * MON-FRI` (Spring cron; `-` disables the digest) |

## CI

`.github/workflows/ci-cd.yml` runs on every push and pull request:

1. **backend** — `mvn verify` (JUnit + JaCoCo)
2. **frontend** — Jest with coverage + production build
3. **e2e** — Cypress against `ng serve`
