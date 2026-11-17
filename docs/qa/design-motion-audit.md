# Design and motion audit — 17 November 2026

Scope: current red/white storefront. Preserve six hard-stop colours and the photographic rack.

Observed on live catalog/services: repeated full-width stripes compete with hierarchy; panel borders and control borders have equal visual strength; service hero is an empty colour block rather than clothing imagery; every service is a framed icon card; catalog images above the fold are all lazy; dialogs and editor stage changes lack visual continuity.

Motion thesis: the rack remains the focal interaction. Its lower colour strip reveals once like a print pass. Catalog imagery arrives as a short ordered row after image decoding, never delaying navigation. Dialogs settle into focus; editor panels acknowledge step changes. Feedback is150–220ms, arrivals260–520ms, reduced motion removes spatial movement. No new animation dependencies, scrolling hijack, perpetual loops or hidden-by-default content.

Implemented: finer4px header band, compact5px heading band, quieter decorative panel edges, clipped catalog photo surfaces with restrained hover zoom, prompt loading of the first4 images, product-image hero on services, open service rows instead of icon boxes, WAAPI list/dialog/editor feedback and a single CSS ink-pass on the home band.

Verified: Python15 + Node20 tests passed. Chromium1440×1000 and390×844: first4 photos eager, service image decodes, no horizontal overflow, dialog has an active opening animation and Escape closes it, repeated open/return works, constructor sample1/10, both ready and custom checkout work. Reduced motion: band animation none and dialog animation count0. JavaScript disabled: all12 catalog cards remain rendered. Page errors0. No messages sent. Screenshots and checks: D:/Site Projects/Olya/Offer/.playwright-mcp/motion-review/.

Remaining priorities: consistent studio light/scale across all catalogue photos; confirmed fabric and size information; service-specific production/detail photographs rather than the current garment example; test loading on a slow mobile connection. These need real assets or additional device checks and are not solved by motion alone.
 Physical iPhone/Safari and low-end hardware still require separate testing. The free-host cold start remains outside this visual pass.
