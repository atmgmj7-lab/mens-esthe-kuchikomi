# Eskomi Analytics / Action Center Design

## Design goal

Turn known workspace state into one safe next action. The first version is an explanation layer over existing metrics, not a BI platform.

## P0 action rules

| Condition | Action card | Data required | Scope |
|---|---|---|---|
| workspace is not eligible | Complete official-partner verification | workspace state | existing Partner lifecycle |
| no active QR / LINE / Website asset | Asset preparation is pending | canonical campaign availability | operator-controlled prerequisite |
| active asset, zero submissions | Share one neutral acquisition asset | own campaign counts | Partner action |
| pending > 0 | Reviews are awaiting moderation | own aggregate pending count | explanation only |
| published > 0 | Review results are available | public aggregate | link to Growth Center / public Shop page |
| Widget optional and ready | Preview then install on own site | widget URL | Partner action |

## P1_AFTER_P1 analytics

Once actual events exist, show daily/weekly counts for `open`, `start`, `submitted`, `pending`, `published` with channel comparison. The chart must state period, unit, source, and missing-data behavior. No rate is shown until numerator, denominator, and attribution window are approved.

## P2 reports

Monthly summary: published growth, lifecycle volume, active asset usage, and channel mix. Export / notification requires a separate privacy, audience, and retention design. No Google / MEO metric is included.

## Data dictionary

| Data | Grain | Source | Visibility | Update |
|---|---|---|---|---|
| campaign event | campaign / event | private campaign metrics | own aggregate | event write |
| review lifecycle count | workspace / state | Native Review | own aggregate | moderation/publication |
| review aggregate | shop | public adapter | public Widget / Shop contract | approved publication |
| AI telemetry | provider call | private telemetry | operations aggregate only | request completion |
