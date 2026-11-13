# Implementation ledger — 2026-11-14-2d-storefront-redesign

Baseline: bd5e340. Branch: feat/2d-storefront. Existing check_shop.py: PASS.
Scope: implement approved 2D plan in existing Flask application; preserve prices, products and admin security.
Ruling: existing workflow already authorizes publishing; work locally and publish after verification without repeated permission prompts.
Ruling: use the existing photographic atlas initially while separating compositing/masks; improve assets without altering original catalog artwork.
Pre-flight: variants feed rack/product/cart; shared 2D preview feeds constructor/fitting/export; draft persistence excludes personal fitting photos.

- [x] Baseline and working branch.
- [x] Product schema and admin variants.
- [x] Rack and public theme.
- [x] 2D editor, local recovery and undo.
- [x] Photo fitting and shared order flow.
- [x] Reliability/metadata and verification.

Verification: check_shop PASS; Python 10 PASS; Node 9 PASS; browser rack/mobile/editor/photo/import/mixed cart/admin PASS. See 2d-acceptance.md for measured results and outstanding art/device checks.
Ruling: retain approved 512px photographic templates for this rollout; do not claim the planned new 2K photo masters were created. Original images remain available and all 3D assets are inactive.
