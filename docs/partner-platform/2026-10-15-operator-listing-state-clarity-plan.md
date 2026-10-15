# Operator listing state clarity plan

## Goal

Make the operator's store list distinguish a store's public listing state from
Partner operational readiness. It adds an operator-only, reversible archive
state, but must not mutate any production store as part of this release work.

## Delivery

1. Read the public listing projection, legacy listing-state identities, and the
   service-only non-public managed-shop projection separately, then project
   `listed`, `unlisted`, or `deleted` for the operator list. This keeps a shop
   created directly in Web management discoverable and restorable even when it
   has no WordPress identity.
2. Provide `掲載中`, `掲載停止`, and `削除済み` tabs with filtered counts, while retaining the
   current search query and pagination in tab and page links.
3. Show the listing-state badge separately from the Partner account/readiness,
   review metrics, and review-channel availability.
4. Archive records without deleting their database record, private images, or
   review history. Restoring an archive must return it to `unlisted`, and
   requires a separate explicit publish action to list it again.
5. Keep unknown data truthful: do not turn unavailable data into zero, and do
   not infer that a missing safe projection means a Partner workspace was never
   created.
6. Verify the projection, UI contract, migration fixture, lint, typecheck, production build, and
   local authenticated desktop/mobile browser screens before opening a PR.

## Verification note

The archive/restore browser flow is independently exercised with the existing
private-asset upload step skipped only when the local Supabase Storage emulator
cannot accept its own current object upsert. Archive state, public exclusion,
deleted/unlisted tabs, managed detail routing, restore, and explicit republish
remain covered by that authenticated local browser run. The full asset-upload
path is kept separate from this state-management change.

## Non-goals

- No production database mutation, cache invalidation, redirect, physical deletion, or
  pricing/permission change.
- No change to the public route or to the store's present unlisted state.
