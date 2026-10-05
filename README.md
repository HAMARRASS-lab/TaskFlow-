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
| GET | `/api/auth/me` | current user |
| GET | `/api/tasks?status=TODO` | list my tasks (optional filter) |
| GET | `/api/tasks/{id}` | one task |
| POST | `/api/tasks` | create `{title, description?, status?, priority?, dueDate?}` |
| PUT | `/api/tasks/{id}` | update |
| PATCH | `/api/tasks/{id}/status` | `{status}` |
| DELETE | `/api/tasks/{id}` | delete |
| GET | `/api/meetings?from=&to=` | meetings I organize or am invited to, overlapping `[from, to)` (ISO local date-times, optional) |
| GET | `/api/meetings/invitations` | upcoming meetings shared with me that I have not answered |
| GET | `/api/meetings/{id}` | one meeting |
| POST | `/api/meetings` | create `{title, startAt, endAt, description?, location?, participants?}` — 400 if `endAt <= startAt`, 409 if it overlaps another meeting |
| PUT | `/api/meetings/{id}` | update (organizer only, else 403) — rescheduling resets answers to `PENDING` |
| PATCH | `/api/meetings/{id}/response` | invitee answers `{status: ACCEPTED \| DECLINED}` — 409 if accepting overlaps their agenda |
| DELETE | `/api/meetings/{id}` | delete (organizer only) |

All `/api/tasks` and `/api/meetings` endpoints require `Authorization: Bearer <token>`.

**Meeting sharing** — a participant whose email matches a registered user sees the meeting in their calendar (read-only) and can accept or decline it. Other participants (plain names, unknown emails) are informational. Double-booking is checked against the meetings a user organizes or has accepted.

## Configuration (backend env vars)

| Variable | Default |
|----------|---------|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `localhost` / `5432` / `taskflow` / `taskflow` / `taskflow` |
| `JWT_SECRET` | dev key — **set a Base64 key ≥ 256 bits in production** (`openssl rand -base64 48`) |
| `JWT_EXPIRATION_MS` | `86400000` (24 h) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` |
| `PORT` | `8080` |

## CI

`.github/workflows/ci-cd.yml` runs on every push and pull request:

1. **backend** — `mvn verify` (JUnit + JaCoCo)
2. **frontend** — Jest with coverage + production build
3. **e2e** — Cypress against `ng serve`
