# Our Souls — garment studio

- Theme: dark graphite/forest studio, natural beech hangers and steel rail. Product photographs carry colour; no light paper background or literary display serif.
- Tokens: page #15201D, surface #1E2D25, raised #293E31, text #EDF1EA, secondary #BDCBBF, action #C4D4BC, wine accent #D99AA6.
- Typeface: self-hosted Onest, SIL OFL included under static/theme/fonts. Interface 14–16 px, product names16–22 px; headings semibold. Tracking no tighter than−.04em.
- The homepage is a fully white canvas, including its compact header; dark forest text and controls retain the brand. No diagonal backdrop. Other shop pages retain the dark studio theme. The selected ambient layer is an offset halftone print screen in forest/wine ink. Keep a quiet zone behind clothes, pause during rack motion and dialogs, respect reduced motion and hidden tabs. No animation controls or explanatory copy in the customer interface.
- The home route contains only the full-catalog photographic rack and navigation. Preserve wheel/swipe, keyboard selection, explicit return and reduced motion. No counter or marketing sections.
- Catalogue: four/two-column photographs, one product link, name and truthful price; filters open on demand. Hash search opens and focuses the panel.
- Product: one main photo, real thumbnails only, adjacent size/colour/order controls. Never fabricate available colours or prices.
- Constructor: photographic 2D preview; garment/print/order stages; project import/new under a secondary menu. Neutral light photographic preview inside a dark workspace; exported production mockups retain their neutral backdrop. Mobile preview precedes settings and stays visible during print editing.
- All current catalogue fronts have offline BiRefNet alpha masks, lossless original-RGB masters and ready WebP derivatives. No customer-side segmentation for this catalogue. Preserve source/mask mapping and review new masks before publishing. Rack movement is time-based, speed-bounded and waits for decoded images.
- static/theme/studio.css is the final customer-theme authority. Do not add another competing stylesheet. Legacy CSS remains underneath; retire it incrementally against browser checks.


## Shared palette (17 November 2026)

CSS authority: semantic `--os-*` tokens in studio.css. Keep garment colours, uploaded designs and photographs unchanged.

| Role | HEX | Use |
|---|---|---|
| Canvas light | #FFFFFF | Home rack and header |
| Ink on light | #173B33 | Home navigation and controls |
| Background | #15201D | Interior pages |
| Surface / raised | #1E2D25 / #293E31 | Panels, dialogs, secondary controls |
| Field | #101B16 | Inputs |
| Text / secondary | #EDF1EA / #BDCBBF | Dark surface text |
| Control outline | #829785 | Visible input and control boundaries |
| Action / hover | #C4D4BC / #D6E3CF | Main action with #17221B text |
| Wine | #D99AA6 | Restrained brand accent |
| Focus | #E2BF89 | Keyboard focus, always visible |
| Error / success | #FFC2C8 / #B5D6B3 | Accompanied by text or icon |
| Photo surround | #F2F3EF | Neutral product and constructor scene |

Catalogue pages contain 12 products. Mobile navigation exposes auxiliary links when opened. Ready-item orders prioritise a Telegram message; custom designs prioritise ZIP download then Telegram attachment. Hidden controls must remain hidden regardless of button styling.

### Checked colour pairs

| Role | Foreground / background | Contrast |
|---|---|---|
| Main text | #edf1ea / #1e2d25 | 12.61:1 |
| Secondary text | #bdcbbf / #1e2d25 | 8.55:1 |
| Action text | #17221b / #c4d4bc | 10.53:1 |
| Home ink | #173b33 / #ffffff | 12.28:1 |
| Control outline | #829785 / #293e31 | 3.67:1 |
| Focus | #e2bf89 / #293e31 | 6.59:1 |
