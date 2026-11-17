# Our Souls — horror / editorial brutalism

Latest user direction (17 November2026): connect the brand to black and horror; brutalism. Supersedes pastel red/white styling while retaining its striped field and subtle sheen.

- Palette: structure #111111, paper white, neutral working surfaces #F3F3EF / #E9E9E5, primary text #111111, secondary #343434, blood-red action #B40020, bright focus on black #FF6573. Semantic variables in static/theme/studio.css remain authoritative.
- Black header/footer and constructor steps, heavy Onest headings, sharp edges, explicit borders. No gratuitous gore, loaded emblems, fake glitch errors or flashing. Natural wood hangers and garment/print colours remain untouched.
- Body background: hard-edged white/gray diagonal ribbons with thin red/black accents. One slowly translating white sheen; no filter, shader, extra canvas or library. Pause while editing/dragging, in dialogs and hidden tabs. Reduced motion is static. Keep photos and control panels readable and opaque.
- Homepage only rack and navigation. Critical head CSS shows a linked first-product photo until first rack image and hanger decode and layout finish. Never flash the obsolete two-column fallback or leave failed JavaScript hiding all useful navigation.
- Catalogue: all categories accessible before opening filters; native horizontal scroll on mobile, sticky toolbar,12 cards per page; first4 images eager. Explicit product return preserves the same-origin catalog query.
- Product: native required size radios from actual variant data; no invented size chart. Mobile action first focuses size selection, then submits the original validated form. Keep real availability and unknown prices truthful.
- Constructor: photo-based 2D, ten prints, front/back, custom HEX/RGB, import/export, honest fitting limits. Light upload/layer/transform controls with dark text; red artwork handles. Preview before controls on mobile.
- Motion: native WAAPI catalog arrivals, dialog opening300ms and editor-step220ms. Content visible if scripts fail. No scroll hijack or dependency added. Colour feedback remains under reduced motion.
- Detailed benchmark audit, evidence and remaining gaps: docs/qa/benchmark-audit-2026-11-17.md. Free-host cold start, actual product specifications and missing realistic fitting assets are separate limitations.

## Dark imagery and fitting

Dark scene field now dominates interior pages: charcoal ribbons and red slashes, white readable control panels. Product/gallery/service front images use existing transparent rack_image assets; source photos remain for production/other real angles. Product image must fit viewport. Print-service inset demonstrates actual artwork.

Photo fitting automatically registers cropped alpha artwork to shoulders/hips; independent length control and optional exposed-hand restoration. It is local2D registration, never advertised as neural cloth replacement or accurate sizing. Keep original photos out of order archives. Details and limitations: docs/qa/dark-photo-fitting-fixes.md.
