# Tasks: [Feature Name] ([CODE])

> **Spec:** [spec.md](spec.md) | **Plan:** [plan.md](plan.md) | **Tests:** [test_cases.md](test_cases.md)

---

## [CODE]-US-NN — [Story Title]

> **Branch:** feature/[bee-nnn]-[code-us-nn-lowercase]-implementation-step
> **Jira:** [GBX01-NNN](https://your-org.atlassian.net/browse/GBX01-NNN)
> **Context:** [brief description — gaps only or full implementation]

### Dependency order

```
T1 → T2
T3, T4 (independent)
```

---

### Backend tasks

#### T1 — [Task name] (Gap)
- **File:** `backend/src/main/java/com/example/app/[path]/[File].java`
- **Change:** [what to implement]
- **Covers:** AC-NN

#### T2 — [Task name — verify]
- **File:** `backend/src/main/java/com/example/app/[path]/[File].java`
- **Check:** VERIFIED — [what was confirmed]. No change needed.
- **Covers:** AC-NN

---

### Frontend tasks

#### T3 — [Task name] (Gap)
- **File:** `frontend/app/app/[feature]/[file].tsx`
- **Change:** [what to implement]
- **Covers:** AC-NN
- **Depends on:** T1

---

### Test alignment tasks

#### T4 — [Test task name]
- **File:** `grm/specs/[feature-folder]/test_[feature-id].spec.ts`
- **Change:** [what to update in test file]

---

### Verification tasks

#### T5 — [Verification task name]
- **Files:** `[path/to/File1.java]`, `[path/to/File2.java]`
- **Change:** [what to verify/implement]
- **Covers:** AC-NN

---

### Integration tests

#### T6 — [Test name]
- **File:** `backend/src/test/java/com/example/app/controller/[Entity]ControllerIntegrationTest.java`
- **Change:** [test scenarios to add]
- **Covers:** AC-NN, AC-NN

---

### Checklist

- [ ] T1 — [task summary]
- [ ] T2 — [task summary]
- [ ] T3 — [task summary]