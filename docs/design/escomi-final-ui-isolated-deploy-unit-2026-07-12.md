# Escomi UI-FINAL isolated deploy unit 2026-07-12

## Status

Status: ISOLATED_UI_FINAL_READY

Branch: codex/ui-final-ready-20260712-041607
Worktree: /tmp/escomi-ui-final-worktree-041607

This branch isolates the public-site UI-FINAL changes and required public quality guardrails from the mixed main worktree.

## Included scope

| Scope | Included |
|---|---|
| Top page final UI | Yes |
| Area page final UI | Yes |
| Shop detail final UI | Yes |
| Shared public header/footer | Yes |
| Q-01 to Q-05 public quality guardrails required by UI | Yes |
| Dashboard implementation | No |
| Dashboard deploy workflows | No |
| Fable bulk planning docs | No |
| GitHub Actions production workflow changes | No |

## Validation in isolated worktree

| Check | Result |
|---|---|
| npm install --prefer-offline | Success |
| npm run lint | Success |
| npm run typecheck | Success |
| npm test | Success |
| npm run build | Success, 440/440 pages generated |
| Playwright / | Success |
| Playwright /area/osaka/ | Success |
| Playwright /area/nihonbashi/ | Success |
| Playwright shop detail | Success |
| Playwright dashboard isolation | Success |

Screenshots: /tmp/escomi-ui-final-isolated-crosscheck-20260712

## Deploy recommendation

This isolated branch is the safe candidate for preview deployment. Do not deploy the original mixed worktree as-is.

Recommended next step:

1. Push this branch.
2. Let Vercel/GitHub Actions create a preview deployment.
3. Verify preview URLs.
4. Promote/merge only after preview verification.

## Known non-blocking note

Stopping next start still prints a useSearchParams client-side rendering bailout log. The tested public pages and dashboard isolation pass, but this should be tracked as a separate technical cleanup.
