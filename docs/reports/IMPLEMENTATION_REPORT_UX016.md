# Plot Architect — UX-016 / semantic zoom drag fix

**Version:** Graphite v0.13.5-alpha (LOCAL ONLY)  
**Date:** 2026-11-01  
**Baseline:** verified `PA_LOCAL_V0134_UX015_SOURCE_20261101.zip` (v0.13.4-alpha).  
**User report:** at compact/map zoom levels, apparent event nodes could be selected/jumped-to but not dragged.

## Diagnosis

In UX-015, original `.node` elements are intentionally invisible and `pointer-events:none` in `compact` / `map`. Separate `.pa-semantic-item` overlay elements rendered a marker/title, but only implemented click/keyboard activation. Pointer drag existed on `.node` (full zoom) only, so at lower zoom dragging visibly failed.

## Change

- Pointer-drag attached to `.pa-semantic-item`: title and dot are both drag handles on mouse primary-button down. On compact: drag short card title; on map: drag dot or title.
- Use screen-to-world movement `delta / pan.scale`; preview repositioning of the selected group's underlying nodes and overlay labels/dots, with live edge redraw, without a persistent write per pointermove.
- On drop: restore transient positions, then use existing `previewNodeMove` + `askPreserveFieldTags` + `applyNodeMove` transaction for one Undo. Crossing semantic fields still offers keep/drop/cancel; group membership and editorial-field membership are preserved by existing workflow.
- On cancel/Escape restore positions without commit. Ctrl/Meta click still selects multiple events; ordinary map click still zooms; Space+left-drag or middle-drag starting on a semantic item pans the canvas.
- Updated overlay CSS: `touch-action:none` and `user-select:none`. No changes to node content, stored geometry defaults, graph contract or hosted Site.

## Tested

- 28/28 new Chromium browser checks, including single drag on compact label, group drag/Undo, map marker drag/Undo, click-to-zoom regression, Space+drag panning, prompt-on-tag-loss, Cancel, Keep, Undo and zero JavaScript exceptions.
- 30/30 UX-015 existing browser checks, dense 180-event synthetic smoke, 43/43 UX-014, 32/32 UX-013 layout, 12/12 UX-013 actions, 29/29 P4D browser regression, 19/19 persistence checks.
- 46/46 Node contract/backend tests; `npm run check` and `npm run build` pass.
- Actual workerd/D1 integration **NOT VERIFIED**; no hosted deploy or MCP update. The built standalone HTML is for local inspection; it does not change an existing Site.

## Files

- `PLOT_ARCHITECT_LOCAL_V0135_UX016_20261101.html`: standalone interactive local build.
- `PA_LOCAL_V0135_UX016_SOURCE_20261101.zip`: full source tree and tests.
- `test_ux016_drag.py`, `UX016_BROWSER_QA.json`: reproducible gesture QA.

## Remaining boundary

P5 MCP variant generation and P6 destructive atomic acceptance remain unimplemented. No production writes and no Work usage; legacy test campaigns remain untouched under PA-WORK-GUARD-01.
