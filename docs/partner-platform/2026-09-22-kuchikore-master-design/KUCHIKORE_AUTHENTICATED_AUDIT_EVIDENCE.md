# 認証済み監査 — 安全な証跡

## Read-only evidence ledger

| Area | Route class observed | Evidence captured | Excluded |
|---|---|---|---|
| Dashboard | authenticated dashboard | headings, KPI categories, period controls, table/card hierarchy | account-specific values and keyword data |
| Survey / AI | list, creation, preview | labels for QR/preview/result, guided AI question structure, language/start controls | form input and create/save action |
| Reviews | review list | distribution, state filters, language/search, empty state, detail-selection pattern | review bodies and customer identities |
| Reports | report list / monthly report | date cards, delta KPI, empty table, month selection | data export and account-specific report values |
| Store / staff | management screens | navigation labels, empty state, business-information category labels | edits, staff records, contact fields |
| LINE | list screen | column labels and delivery-state pattern | recipients and any sending control |

## Screenshot policy outcome

A cropped, in-session screenshot of the **staff-management empty state** was captured as visual evidence. Its crop excluded the sidebar and header context and displayed no staff records, customer data, email, phone, token, API key, or billing information. No screenshot file was retained in the repository. Other authenticated screens were retained as DOM / URL / action-taxonomy evidence only because they could contain unnecessary account or customer information.

## Browser safety confirmation

- Reused the user’s existing logged-in Chrome session.
- Did not re-login, inspect cookies/tokens/passwords, open a password manager, export session data, or alter profile storage.
- Did not submit, save, edit, create, delete, send, invite, reply, connect integrations, or change permissions.
