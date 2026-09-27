# Securis — Architecture

This document describes how Securis is put together: the component boundaries,
the data flow through the platform, and the database relationships.

---

## 1. Component architecture

```mermaid
flowchart TB
    subgraph Client["Browser"]
        RSC[Server Components]
        CC[Client Components<br/>forms, charts, dialogs]
    end

    subgraph Next["Next.js application"]
        MW["middleware.ts<br/>(injects x-pathname)"]
        Layout["(soc)/layout.tsx<br/>auth + per-route permission guard"]
        Pages["Pages<br/>dashboard, events, alerts, incidents, rules, TI, simulation, users, audit, search, settings"]
        API["Route handlers<br/>/api/**"]
    end

    subgraph Server["server/ (business logic)"]
        Services["services/<br/>event, alert, incident, rule, user, audit, dashboard, search"]
        Detection["detection/<br/>engine, evaluators, risk, conditions"]
        Ingestion["ingestion/<br/>parser, normaliser, validator, pipeline"]
        TI["threat-intel/<br/>matcher, service"]
        HTTP["http/<br/>rate-limit, request helpers"]
    end

    subgraph AuthSec["auth/ + security/"]
        Session["auth/session, token, rbac, current-user"]
        Password["security/password (Argon2id)"]
    end

    DB[(PostgreSQL<br/>via Prisma)]

    Client --> MW --> Layout --> Pages
    Pages --> Services
    Pages --> Detection
    CC --> API
    API --> Services
    API --> Detection
    API --> Ingestion
    API --> TI
    API --> HTTP
    API --> Session
    Services --> DB
    Detection --> DB
    Ingestion --> DB
    TI --> DB
    Session --> DB
    Password --> Session
```

**Rules of the layering**

- Pages and route handlers are thin: they parse/validate input, check
  authorization, call a service, and render/return the result.
- All database access lives in `server/services/**` (or `server/threat-intel`),
  so indexes and projections are owned in one place.
- `auth/` and `security/` are dependency-light and reused by both HTTP and
  service layers.
- Nothing in `components/**` imports Prisma or reads secrets.

---

## 2. Event ingestion data flow

```mermaid
flowchart LR
    Raw["Raw event<br/>(canonical or provider payload)"] --> Zod["Zod shape validation<br/>(strips unknown keys)"]
    Zod --> Parse["Parser<br/>per sourceType"]
    Parse --> Norm["Normaliser<br/>timestamp, severity, event type, IPs"]
    Norm --> Validate["Semantic validator<br/>bounds, sizes, invalid IPs"]
    Validate --> Persist["SecurityEvent rows"]
    Persist --> Detect["Detection engine"]
    Detect --> Alerts["Alerts (idempotent upsert)"]
```

Failure handling: per-event failures are reported by index (the batch does not
fail), and a single audit entry summarises each ingestion request.

---

## 3. Detection and scoring flow

```mermaid
flowchart TB
    Rules["DetectionRule (enabled)"] --> ParseCond["parseCondition (Zod, per rule type)"]
    ParseCond --> Evaluator{"Evaluator by ruleType"}
    Evaluator -->|EVENT_MATCH| EM[Group matches by user/IP]
    Evaluator -->|THRESHOLD / TIME_WINDOW / IP_BASED| AG[DB groupBy + evidence fetch]
    Evaluator -->|CORRELATION| CO[Failures → success, new-IP check]
    Evaluator -->|USER_BASED| UB[Behavioural signals + minSignals]
    EM & AG & CO & UB --> Findings["DetectionFinding"]
    Findings --> Score["scoreFinding: threat intel + prior occurrences + computeRisk"]
    Score --> Upsert["upsertAlertFromFinding (dedupeKey)"]
    Upsert --> Alert[(Alert)]
```

The dedupe key `ruleCode:groupValue:windowBucket` is what makes repeated runs
idempotent while still allowing a new alert when the same behaviour recurs in a
later window.

---

## 4. Database relationships

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string passwordHash
        enum role
        boolean isActive
    }
    LoginSession {
        string id PK
        string tokenHash UK
        datetime expiresAt
        datetime revokedAt
    }
    SecurityEvent {
        string id PK
        datetime timestamp
        enum sourceType
        enum severity
        string sourceIp
        string username
        json metadata
    }
    DetectionRule {
        string id PK
        string code UK
        enum ruleType
        json condition
        int threshold
        int timeWindowSeconds
        boolean enabled
    }
    Alert {
        string id PK
        enum severity
        enum status
        int riskScore
        json riskFactors
        string dedupeKey UK
        datetime firstSeen
        datetime lastSeen
    }
    Incident {
        string id PK
        string reference UK
        enum status
        string resolution
    }
    ThreatIndicator {
        string id PK
        enum type
        string value
        int confidence
        boolean active
    }
    AuditLog {
        string id PK
        enum action
        string actorEmail
        string targetType
        string targetId
        json metadata
    }

    User ||--o{ LoginSession : has
    User ||--o{ Alert : assigned
    User ||--o{ Incident : assigned
    User ||--o{ DetectionRule : created
    User ||--o{ AuditLog : actor
    DetectionRule ||--o{ Alert : produces
    Alert }o--o{ SecurityEvent : relates
    Alert }o--o{ Incident : grouped
    Incident }o--o{ SecurityEvent : relates
    Alert ||--o{ AlertNote : has
    Incident ||--o{ IncidentNote : has
```

Referential actions: notes and sessions cascade with their parent; assignees and
rule references use `SetNull` so history survives a deletion.

---

## 5. Authorization flow

```mermaid
flowchart TD
    Req[Request] --> MW[middleware sets x-pathname]
    MW --> Layout["(soc)/layout: getCurrentSession()"]
    Layout -->|no session| Login[redirect /login]
    Layout -->|session| Perm{"route requiredPermission?"}
    Perm -->|missing| Denied[redirect /dashboard?denied=...]
    Perm -->|ok| Page[Page renders]
    Page --> ApiCall{"API mutation?"}
    ApiCall -->|yes| ApiAuthz["route: session + hasPermission"]
    ApiAuthz -->|denied| Forbidden[403]
    ApiAuthz -->|ok| Service[service + audit]
```

Authorization is enforced on the server at both the layout (before streaming) and
every API route. The UI only hides controls; it is never the boundary.

---

## 6. Deployment topology

```mermaid
flowchart LR
    subgraph Compose["docker compose"]
        PG[(postgres:16)]
        MIG["migrate (one-shot)<br/>prisma migrate deploy"]
        APP["app (runner)<br/>node server.js"]
    end
    PG -->|healthy| MIG -->|completed| APP
    APP -->|DATABASE_URL| PG
    User([Browser]) -->|:3000| APP
```

In production the same image runs against a managed PostgreSQL (e.g. Neon) by
changing only `DATABASE_URL` / `DOCKER_DATABASE_URL`.
