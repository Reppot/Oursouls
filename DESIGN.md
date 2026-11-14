# Our Souls — garment studio

- Theme: dark graphite/forest studio, natural beech hangers and steel rail. Product photographs carry colour; no light paper background or literary display serif.
- Tokens: page #15201D, surface #1D2E22, scene #26382E–#3B5043, text #EDF1EA, secondary #B0BDB3, action #BACBB3, wine badge #8B3E4A.
- Typeface: self-hosted Onest, SIL OFL included under static/theme/fonts. Interface 14–16 px, product names16–22 px; headings semibold. Tracking no tighter than−.04em.
- The home route contains only the full-catalog photographic rack and navigation. Preserve wheel/swipe, keyboard selection, explicit return and reduced motion. No counter or marketing sections.
- Catalogue: four/two-column photographs, one product link, name and truthful price; filters open on demand. Hash search opens and focuses the panel.
- Product: one main photo, real thumbnails only, adjacent size/colour/order controls. Never fabricate available colours or prices.
- Constructor: photographic 2D preview; garment/print/order stages; project import/new under a secondary menu. UI preview dark; exported production mockups retain their neutral backdrop.
- Prepared transparent rack assets remain authoritative. For studio product photos without alpha, browser edge segmentation preserves RGB content and changes only alpha; bounded480px mask work runs in a module worker with fallback. This is tailored to centred studio garment shots, not arbitrary lifestyle photographs.
- static/theme/studio.css is the final customer-theme authority. Do not add another competing stylesheet. Legacy CSS remains underneath; retire it incrementally against browser checks.
