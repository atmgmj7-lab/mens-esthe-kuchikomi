# Eskomi Review Inbox Design

## Two deliberately separate experiences

| Experience | User | Sees | Can do | Cannot do |
|---|---|---|---|---|
| Partner review status | owner / manager | aggregate submitted, pending, published and campaign counts | choose an acquisition asset; understand moderation status | read customer identity/body, decide moderation, publish, edit rating/tags |
| Operator Moderation Inbox | authorized Eskomi operator | pending queue, authorized detail, audit history | approve, reject, spam, publish within existing authority | bypass audit, expose private data to Partner, auto-publish from AI |

## Operator Inbox layout (P1_AFTER_P1)

- **Top filters:** status, date, workspace/shop only where authorized.
- **Main table:** lifecycle state, received time, campaign attribution indicator, reason for current action. Pagination first.
- **Detail panel:** original customer input only for authorized operator, moderation history, immutable rating/tags, recommended decision help.
- **Action rail:** approve / reject / spam / publish are distinct confirmed actions, with reason and audit event.

## AI boundary

AI Review Assist is customer-side draft assistance. It never changes rating, tags, facts, or sentiment; `HUMAN_REVIEW` and outage fallback remain available. Inbox may show an outcome marker only if it is already service-projected and carries no prompt, raw note, or provider secret.

## Empty/error/loading states

- No pending review: “現在、確認待ちの口コミはありません。”
- Permission mismatch: deny without revealing another workspace or review existence.
- Data unavailable: retry-safe message; never re-run a customer submission to refresh a list.
