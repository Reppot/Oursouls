# Our Souls — red / white shop

Updated 17 November 2026 at the user's request. This direction supersedes the forest palette.

- Shared palette lives in static/theme/studio.css, the final theme authority. Interior background #FAF7F5, white surfaces #FFFFFF, raised #F5E9E7, text #42141C, secondary #76535A, controls #9F6D73, primary #B32132, hover #8D1729, button text white, focus #97152B.
- Distinct stepped gradient: #671425 → #A62537 → #D85B66 → #EFB3B8 → #F5DFDF → #FFFFFF. Each colour occupies one sixth, shared hard stops, 110-degree direction. No blurred interpolation. Use in the header strip, route-heading separator, footer edge and the bottom of the homepage. Large garment-viewing area stays white and quiet.
- Onest is self-hosted, normal UI14–16px. Compact navigation. No literary display type, no promotional copy or counters on the homepage.
- Preserve actual garment colours, photographs, print pixels, catalogue variant colours, natural wood hangers and neutral metal rail. Ambient halftone uses restrained red inks and still pauses for rack interaction and reduced motion.
- Homepage: all60 catalog garments, wheel/swipe/keyboard browsing and explicit return from product dialog. Neutral light product photos and constructor preview; no primitive3D.
- Constructor: garment / print / order steps, ten layers, mobile preview before controls, sticky print preview, HEX/RGB fabric colour. Colour swatches describe products and do not follow brand palette.
- Ready-item checkout prioritises Telegram text; custom artwork prioritises archive then manual Telegram attachment. Never fabricate prices, availability, measurements or product claims.
- Common hidden states override decorative display rules. Keep readable focus, labelled fields, keyboard access, reduced-motion support and responsive layouts.
- Existing masked catalogue images use offline-prepared alpha assets. Do not add browser segmentation or recolour images as part of theme work.

## Checked contrast

| Role | Colours | Ratio |
|---|---|---|
| Text | #42141c / #faf7f5 | 14.60:1 |
| Secondary | #76535a / #f5e9e7 | 5.61:1 |
| Button | #ffffff / #b32132 | 6.60:1 |
| Control border | #9f6d73 / #f5e9e7 | 3.60:1 |

## Motion and visual hierarchy

The rack is the focal experience. Keep palette bands legible but economical:4px header,5px heading signature,6px footer; the home bottom band stays broad. Prioritise product photography over framed panels. Services use a real catalog example, not a claim about a production facility.

Native WAAPI in static/theme/motion.js: short row arrivals after decode (520ms, capped120ms stagger), dialog opening300ms, editor step acknowledgement220ms. Home ink-pass700ms once. No animation dependency, scroll hijack or hidden content when scripts fail. Motion preference changes cancel active animations; reduced-motion retains colour feedback without spatial movement. Pointer hover effects are limited to hover-capable devices. Editor animation never intercepts form or canvas input.
