# Review entry person-rating integrity

## Goal

Prevent a rating selected for one therapist from being submitted for another
therapist after the reviewer changes the selected person, while retaining the
shared shop fields and the existing idempotent UI retry behavior.

## Plan and evidence

1. [x] Reproduce A=4 → B switch in the real v1.1 entry component fixture.
   The pre-fix assertion observed B's select still held `4`.
2. [x] Clear only the saved therapist rating when the selected therapist
   changes, and remount the person-rating select by selected assignment ID.
3. [x] Assert B's select is empty, then submit a newly entered B=5 value;
   the fixture records the B context and rating separately.
4. [x] Assert the store-only flow has no person-rating control and submits
   `therapistRating: null`.
5. [x] Simulate a committed response lost by the proxy and click the rendered
   `受付する` retry control. The UI restores the original receipt without
   test-side header injection.

## Boundaries

- The test uses local mock RPC/fixture services and headless Playwright only.
- It does not prove real Supabase/Auth/Storage/email or Mac Google Chrome.
- No production data, scheduler, credentials, migration, or deployment changed.
