# Plan: [Feature Name] ([CODE])

> **Feature:** 7.x [Feature Name]
> **Jira Epic:** [GBX01-EEE](https://your-org.atlassian.net/browse/GBX01-EEE)
> **Spec:** [spec.md](spec.md)
> **SDS §5.x:** [SDS.md §5.x](../../SDS.md#5x-feature-name-code)

---

## [CODE]-US-NN: [Story Title]

> **Jira Story:** [GBX01-NNN](https://your-org.atlassian.net/browse/GBX01-NNN)

### Pre-flight: Spec Review Findings

Reviewed `spec.md` and existing implementation before design. The following gaps and ambiguities were identified.

| ID | Type | AC | Finding | Resolution |
|----|------|----|---------|------------|
| G1 | **Gap** | AC-NN | [description of gap] | Open task T1 — [what to do] |
| A1 | Ambiguity | AC-NN | [ambiguity description] | [resolution decision] |

---

### Architecture

**Package layout**

```text
backend/src/main/java/com/example/app/
├── controller/
│   └── [Entity]Controller.java          # [endpoint]
├── service/
│   └── [Entity]Service.java             # Business logic, validation, persistence
├── repository/
│   └── [Entity]Repository.java          # JPA data access
└── dto/
    ├── [Entity]Request.java             # [description]
    └── [Entity]Response.java            # [description]

frontend/app/app/[feature]/
├── page.tsx                             # [description]
└── _components/
```

**Domain objects**

| Entity | Table | Key Fields | Notes |
|--------|-------|------------|-------|
| `[Entity]` | `[table_name]` | [field1, field2] | [description] |

**Business rules enforced in service layer**

| Rule | Source | Enforcement |
|------|--------|-------------|
| [rule description] | AC-NN | `[Repository.method()]` → [HTTP code] `[ERROR_CODE]` |

**Sequence diagram — [Action Name]**
> Note: simplified sequence diagram của dân SE thế giới vẽ nè, có đầy đủ các yếu tố quan trọng:
1. API signature
2. params ko xổ ra chi tiết
3. ko quăng câu SQL hay NoSQL query vô
4. trả HttpStatusCode rõ ràng
5. happy case always first on top, alt later
6. always have return arrow on each sequence unless fire and forget flow

```
[Actor] (Browser)   Frontend              Backend                DB
     │                  │                    │                    │
     │── [action] ─────>│                    │                    │
     │                  │── GET /api/v1/[resource] ─────────────>│
     │                  │<── 200 [Response] ─────────────────────│
     │<── render ───────│                    │                    │
     │                  │── [action] ────────┐                    │
     │                  │◄── validate ───────┘                    │
     │                  │── POST/PUT /api/v1/[resource]           │
     │                  │   + X-CSRF-Token   │                    │
     │                  │                    │── @PreAuthorize ───│
     │                  │                    │── [business rule] ─│──> DB
     │                  │                    │── persist ─────────│──> DB
     │                  │                    │── audit INFO ──────│
     │                  │              [fail]│── audit WARN ──────│
     │                  │◄── 200 / 4xx ──────│                    │
     │◄── render ───────│                    │                    │
```

**Error flows**

| Scenario | HTTP | Error Code |
|----------|------|------------|
| Unauthenticated | 401 | — |
| Wrong role or not owner | 403 | `FORBIDDEN` |
| Invalid CSRF | 403 | — |
| Resource not found | 404 | `[ENTITY]_NOT_FOUND` |
| Business conflict | 409 | `[ERROR_CODE]` |
| Validation error | 422 | `VALIDATION_ERROR` |
| Unexpected error | 500 | — |

**Constitution notes**

| Rule | Status | Note |
|------|--------|------|
| AR-01: Service layer owns business rules | Required | All validation in `[Entity]Service` |
| AR-05: Transactional atomicity | Satisfied | `[method()]` is `@Transactional` |
| AC-02: Backend enforces authorization | Required | `@PreAuthorize("hasAuthority('[ROLE]')")` |
| AC-05: CSRF | Required | `POST`/`PUT` endpoints require CSRF token |

**Element IDs**
> this mainly for automation test

| Element | ID | Status | File |
|---------|----|--------|------|
| [button/input/message] | `[btn-action-entity]` | Exists / **Missing** | `[component.tsx:line]` |

**Open tasks**

| ID | Task | File |
|----|------|------|
| T1 | [what to implement] | `[path/to/File.java]` |
| T2 | [what to implement] | `[path/to/file.tsx]` |