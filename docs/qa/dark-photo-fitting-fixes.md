# Dark imagery and fitting fixes — 17 November 2026

Requests: stronger dark identity; product shirt contained in viewport; no studio rectangle in product/service presentation; clearer print demonstration; repair photo fitting.

Implemented:
- Charcoal/black ribbon field, blood-red line accents and a restrained sheen; light forms/photo-editing surfaces remain readable. Reviewed contrast on six routes and corrected About, empty cart and project-menu text after the dark conversion.
- Product fronts and print-service example now use the existing reviewed alpha derivatives from cutouts.json. Gallery height is bounded by viewport; no source photograph was regenerated. Modal gray container removed. Constructor UI canvas clears to transparent instead of baking in a studio wash; production exports retain their neutral background.
- Services includes a magnified inset of the actual print, sourced from the same cutout.
- Photo fitting crops transparent margins before calculating placement, automatically detects pose after upload, derives width from shoulders and vertical proportion from hips, and offers separate length adjustment. Pose confidence is checked, anatomical left/right order is normalised, stale operations are cancelled. Optional exposed-hand overlay uses photo-adaptive skin chroma within pose regions, calculated once, not per animation frame. Original photo remains local and is not included in order archives.
- Removed the forced non-SIMD rejection; unsupported detector environments still report a recoverable manual-placement state.

Evidence: Chromium1440×1000 product image top200.25 / bottom920.25 within1000px, masked image URL for both product and service. Actual bundled MediaPipe worker completed on a cropped user-provided screenshot reference: automatic placement scale74%, length109%; no page or HTTP errors. This reference already contains a previous clothing overlay and is useful for pose/integration testing, not evidence of a photorealistic garment swap. Tested the pure geometry for hips, missing hips, reversed shoulders and low confidence. Python15 + Node22 tests passed.

Limit: this is improved2D registration, not generative virtual try-on. Existing clothing cannot be erased or realistic cloth drape synthesised by this method; crossed arms, loose hair and occlusion remain approximations. A neural try-on service needs separate assets/runtime and cannot honestly be replaced with an overlay. No third-party photo upload, paid API or fabricated production data was added.

Screenshots / checks: D:/Site Projects/Olya/Offer/.playwright-mcp/dark-fitting/.
