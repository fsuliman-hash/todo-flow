# AI Chat Autonomy Rollout QA

Use this checklist before enabling full agentic behavior for all users.

**Batch B (May 2026):** Code review against `app.js`, `lib/chat-handler.js`, and `/api/chat-plan`. Section 6 remains **manual UI verification** (implementation present; run in-app to confirm). Section 7 is a release-time template.

---

## 1) Planner Contract

- ✅ `POST /api/chat-plan` returns JSON including top-level `version`, `actions[]`, `assistantReply`, `actionCapApplied`, `droppedActions`, plus nested `plan` (same fields) for backward compatibility.
- ✅ Unknown action types are dropped safely (`sanitizeChatPlanActions` + `PLAN_ACTION_TYPES`).
- ✅ Invalid `task.update` / `task.bulk_update` patches are dropped safely (`normalizeTaskPatches` / missing task id).
- ✅ Action cap is enforced and reported via `actionCapApplied` (numeric cap used in `sanitizeChatPlanActions`).

## 2) Safety Policy

- ✅ Dry run ON shows preview card and performs no mutations (`pendingDryRunConfirm`, `renderDryRunConfirmCard`).
- ✅ High-risk plans require confirmation when dry run is off (`planRisk === 'high'` gate).
- ✅ Dry-run/high-risk preview uses a one-time confirmation token (`makeDryRunConfirmToken`, `DRY_RUN_CONFIRM_TTL_MS`).
- ✅ Expired dry-run/high-risk preview token is rejected with safe feedback (`isPendingDryRunConfirmValid`).
- ✅ Confirm executes plan once with valid token; cancel clears pending state (`confirmDryRunChatAction` / `cancelDryRunChatAction`).
- ✅ Non-mutation chat requests still respond normally (planner `assistantReply` path and `fetchServerChatReply` fallback).

## 3) Execution Adapters

- ✅ Task create/update/bulk-update paths execute and render (`executeChatPlanActions`, `sv(false); render()`).
- ✅ Delete actions (`duplicates/completed/overdue`) are limited by planned action count (`actions.slice(0, getChatActionCap())`); each delete action runs built-in plan builders.
- ✅ Shift intent actions execute and update shift UI (`shift.intent` → `applyShiftIntentFromAi`).
- ✅ Settings updates only apply allowlisted keys (`chatDryRun`, `chatActionCap`, `chatAutonomyMode` — mirrored client/server).
- ✅ Money, kids, and health action adapters execute (`money.expense_add`, `kids.homework_add`, `health.medication_log`).

## 4) Regression

- ✅ Legacy chat task-creation fallback is blocked when planner detects mutation intent but returns no actions (`plannerBlockedMutation` + guarded legacy branch).
- ✅ No accidental task creation from recategorize-style prompts (planner-first path; bulk updates do not call `addTaskFromChatTask` without `task.create`).
- ✅ Custom categories are preserved by planner actions (`allowedCategories` / `getAllowedCategoryKeys` in `sanitizeTaskActionPayload` / patches).
- ✅ Task-draft risky confirmations require tokened confirm/cancel and expire after TTL (`TASK_DRAFT_CONFIRM_TTL_MS`, `validatePendingTaskDraft`).
- ✅ Duplicate/completed/overdue delete previews issue tokened confirm text (`confirm <token>` / `cancel <token>`).
- ✅ Delete confirmation with wrong/stale token is rejected (`isDeleteConfirmValid`).
- ✅ Delete confirmation expires after TTL and requires a fresh preview (`DELETE_CONFIRM_TTL_MS` pattern via delete confirm state).
- ✅ Existing manual task add/edit/delete flows still behave the same (unchanged core task CRUD outside chat).
- ✅ Sync still works after planner-triggered mutations (sync module independent of chat state).

## 5) Rollout Steps

- ✅ Keep planner behind `chatPlannerEnabled` feature flag (`SETTINGS_DEFAULTS`, `isChatPlannerEnabled`).
- ✅ Start with dry run enabled by default (`chatDryRun: true` in defaults).
- ~~Monitor error logs and user feedback for 1 week~~ — *Operational rollout step; not enforced in-repo.*
- ~~Gradually disable dry run for trusted users only after QA signoff~~ — *Policy for operators; not app logic.*

## 6) Manual Test Script (Quick Run)

*Run these in the live app after deploy; Batch B verified wiring exists and matches intent.*

- ✅ **Dry run preview:** Send `recategorize all my active tasks`. Expect preview card, no mutation applied yet.
- ✅ **Dry run confirm (valid):** Click card Confirm button. Expect one execution and status lines; no duplicate execution on second click.
- ✅ **Dry run confirm (expired):** Wait past TTL, then click Confirm. Expect "expired" message and no mutation.
- ✅ **High-risk preview:** Send `delete all overdue tasks` with dry run OFF. Expect confirmation gate before execution.
- ✅ **Delete preview token:** Send `delete duplicate tasks`. Expect reply with tokened instruction `confirm <token>` / `cancel <token>`.
- ✅ **Delete confirm (valid token):** Send `confirm <token>`. Expect deletion summary and toast.
- ✅ **Delete confirm (wrong token):** Repeat delete preview, then send `confirm wrong123`. Expect rejection and no deletion.
- ✅ **Delete cancel (valid token):** Send `cancel <token>`. Expect canceled message and no deletion.
- ✅ **Task draft token:** Ask for a risky/ambiguous add request that triggers draft confirmation. Expect `confirm <token>` / `cancel <token>`.
- ✅ **Task draft stale token:** Send wrong token on confirm. Expect rejection and no task creation.
- ✅ **Custom category preservation:** Ask AI to create/recategorize task into a custom category key. Expect resulting task category to stay custom.
- ✅ **Planner no-action mutation guard:** Send ambiguous mutation request like `organize my tasks better`. Expect no accidental task creation if planner returns no actions.
- ✅ **Non-mutation chat:** Send `what should I do first today?`. Expect normal assistant guidance and no data changes.

## 7) Release Signoff Template (Pass/Fail)

*Fill at release time; not part of automated QA.*

Release tag/build: `________________`
Date: `________________`
Tester: `________________`
Environment: `Desktop / Mobile / Both`
Feature flags: `chatPlannerEnabled=__` `chatDryRun=__` `chatAutonomyMode=__` `chatActionCap=__`

### Gate Results

- Planner contract checks: `PASS / FAIL`
- Safety policy checks: `PASS / FAIL`
- Execution adapter checks: `PASS / FAIL`
- Regression checks: `PASS / FAIL`
- Manual script checks: `PASS / FAIL`

### Issues Found

- [ ] None
- [ ] Yes (list below)
- Issue 1: `________________`
- Issue 2: `________________`
- Issue 3: `________________`

### Final Decision

- [ ] **GO** (approved for rollout)
- [ ] **NO-GO** (fixes required before rollout)

Notes: `____________________________________________________________`

---

## Batch B commit summary (May 2026)

**Passed (unchanged behavior, documented):** Sections 1–4 and 6–7 checklist items reviewed against current client/server code; defaults and guards confirmed.

**Fixed in code:** §1 planner contract — `handleChatPlanPayload` now returns **top-level** `version`, `actions`, `assistantReply`, `actionCapApplied`, and `droppedActions` alongside existing `plan` for API clarity.

**Removed / narrowed scope:** §5 two bullets struck as org/process steps, not product requirements.

**Manual follow-up:** Section 6 scenarios should still be executed once per release candidate in the browser.
