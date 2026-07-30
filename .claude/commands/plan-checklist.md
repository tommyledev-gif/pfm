# MUST NOT VIOLATE — Planning (plan.md)

> Scope: Every planning artifact — sequence diagrams, API design, data model, flow description, step handoff docs.
> Violation = plan sent back before implementation starts. No skip.

---

## DIAGRAM / SEQUENCE

- [ ] Diagrams stay at **actor-level** — no SQL statements, no method parameter lists, no field-level detail inside arrows.
- [ ] Every arrow/action has a **clear actor** (who triggers) and a **clear outcome** (what results) — no ambiguous "calls X" with no result.
- [ ] Actors named consistently with SRS §2 domain language — `User` not `UserAccount`, `BusinessUnit` not `BU`.
- [ ] No more than one level of system internals shown — e.g., show "AuthService validates credentials", not "AuthService calls UserRepository.findByEmail() → compares BCrypt hash → updates lastLogin".

---

## API DESIGN

- [ ] Every endpoint has an explicit HTTP method, path, request body/params, and response shape documented.
- [ ] Status codes declared per scenario — not just the happy path. Refer to CODING_RULES status code table.
- [ ] No generic `/updateStatus` endpoint — each business action gets its own semantically named endpoint.
- [ ] RESTful resource naming follows context: `/employee` for system-level, `/project/{id}/employee` for project-scoped.
- [ ] No endpoint planned without a corresponding service method — 1-to-1 traceability.

---

## SECURITY PLANNING

- [ ] Auth/authz layer explicitly named in the plan — which filter, which annotation, at which layer.
- [ ] `@PreAuthorize` placement specified as **Service layer** — never Controller — in the plan.
- [ ] Actor resolution path specified: who extracts the current user and how it is passed to service.
- [ ] CSRF strategy noted for every mutating endpoint (POST/PUT/PATCH/DELETE).
- [ ] Bookmark/direct URL access scenario covered — filter-level check, not only FE route guard.

---

## TRANSACTIONAL PLANNING

- [ ] Write operations (create, update, delete) explicitly marked as transactional in the plan.
- [ ] Read flows explicitly marked as non-transactional.
- [ ] If login flow includes any write (update `lastLogin`, increment lock counter, etc.), that write is called out and marked transactional.

---

## DATA MODEL

- [ ] Entity names match SRS §2 exactly.
- [ ] `User` (auth info) and `Employee` (business info) kept separate — composite allowed, merge/reverse not allowed.
- [ ] Many-to-Many join entity planned only when join table needs extra attributes.
- [ ] `GenerationType` decided per entity in the plan — not left as TBD.
- [ ] Locking strategy (Optimistic vs Pessimistic) stated for any entity with concurrent-write risk (e.g., BusinessUnit update).

---

## AUDIT & LOGGING PLANNING

- [ ] Audit events listed explicitly: which actions produce an audit entry and what fields are logged.
- [ ] Audit actor source specified — resolved at Controller/Filter level, not from `SecurityContextHolder` inside service.
- [ ] `ipAddress` noted as per-request value — not from session.
- [ ] No PII / password / token fields included in planned log statements.

---

## SCOPE & TRACEABILITY

- [ ] Each User Story maps to its API(s) — 1 story may need multiple APIs; related APIs may be shared across stories (document the overlap, do not duplicate).
- [ ] Plan notes which existing features are affected → regression scope identified upfront.
- [ ] Step handoff includes a summary/capacity table: what is done, what is pending, who owns next step.
- [ ] Jira ticket referenced in the plan doc header.

---

## CONVENTIONS

- [ ] No Vietnamese text anywhere in the plan document — English only.
- [ ] No AI-generated diagrams committed without human review and validation.
- [ ] Numeric limits / thresholds named (e.g., `MAX_LOGIN_ATTEMPTS = 5`), not left as raw numbers in the design.