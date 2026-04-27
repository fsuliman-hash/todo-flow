# AI Chat Autonomy Rollout QA

Use this checklist before enabling full agentic behavior for all users.

## 1) Planner Contract
- [ ] `/api/chat-plan` returns valid JSON with `version`, `actions[]`, and `assistantReply`.
- [ ] Unknown action types are dropped safely.
- [ ] Invalid `task.update` / `task.bulk_update` patches are dropped safely.
- [ ] Action cap is enforced and reported by `actionCapApplied`.

## 2) Safety Policy
- [ ] Dry run ON shows preview card and performs no mutations.
- [ ] High-risk plans require confirmation.
- [ ] Dry-run/high-risk preview uses a one-time confirmation token.
- [ ] Expired dry-run/high-risk preview token is rejected with safe feedback.
- [ ] Confirm executes plan once with valid token; cancel clears pending state.
- [ ] Non-mutation chat requests still respond normally.

## 3) Execution Adapters
- [ ] Task create/update/bulk-update paths execute and render expected toasts.
- [ ] Delete actions (`duplicates/completed/overdue`) respect cap limits.
- [ ] Shift intent actions execute and update shift UI state.
- [ ] Settings updates only apply allowlisted keys.
- [ ] Money, kids, and health action adapters execute without console errors.

## 4) Regression
- [ ] Legacy chat task-creation fallback is blocked when planner detects mutation intent but returns no actions.
- [ ] No accidental task creation from recategorize-style prompts.
- [ ] Custom categories are preserved by planner actions (no forced fallback to default categories).
- [ ] Task-draft risky confirmations require tokened confirm/cancel and expire after TTL.
- [ ] Duplicate/completed/overdue delete previews issue tokened confirm text (`confirm <token>` / `cancel <token>`).
- [ ] Delete confirmation with wrong/stale token is rejected.
- [ ] Delete confirmation expires after TTL and requires a fresh preview.
- [ ] Existing manual task add/edit/delete flows still behave the same.
- [ ] Sync still works after planner-triggered mutations.

## 5) Rollout Steps
- [ ] Keep planner behind `chatPlannerEnabled` feature flag.
- [ ] Start with dry run enabled by default.
- [ ] Monitor error logs and user feedback for 1 week.
- [ ] Gradually disable dry run for trusted users only after QA signoff.

## 6) Manual Test Script (Quick Run)
- [ ] **Dry run preview:** Send `recategorize all my active tasks`. Expect preview card, no mutation applied yet.
- [ ] **Dry run confirm (valid):** Click card Confirm button. Expect one execution and status lines; no duplicate execution on second click.
- [ ] **Dry run confirm (expired):** Wait past TTL, then click Confirm. Expect "expired" message and no mutation.
- [ ] **High-risk preview:** Send `delete all overdue tasks` with dry run OFF. Expect confirmation gate before execution.
- [ ] **Delete preview token:** Send `delete duplicate tasks`. Expect reply with tokened instruction `confirm <token>` / `cancel <token>`.
- [ ] **Delete confirm (valid token):** Send `confirm <token>`. Expect deletion summary and toast.
- [ ] **Delete confirm (wrong token):** Repeat delete preview, then send `confirm wrong123`. Expect rejection and no deletion.
- [ ] **Delete cancel (valid token):** Send `cancel <token>`. Expect canceled message and no deletion.
- [ ] **Task draft token:** Ask for a risky/ambiguous add request that triggers draft confirmation. Expect `confirm <token>` / `cancel <token>`.
- [ ] **Task draft stale token:** Send wrong token on confirm. Expect rejection and no task creation.
- [ ] **Custom category preservation:** Ask AI to create/recategorize task into a custom category key. Expect resulting task category to stay custom.
- [ ] **Planner no-action mutation guard:** Send ambiguous mutation request like `organize my tasks better`. Expect no accidental task creation if planner returns no actions.
- [ ] **Non-mutation chat:** Send `what should I do first today?`. Expect normal assistant guidance and no data changes.

## 7) Release Signoff Template (Pass/Fail)

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
