# Fitted garments

outfits.glb is a derivative of CharacterCreator CC0 generated garment assets,
pinned at 852e48f316b90a0937234886630e4fb4cdfd1f78:

- https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/output/clothing_tshirt.glb
- https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/output/clothing_hoodie.glb
- Licence: https://github.com/kblood/CharacterCreator/blob/852e48f316b90a0937234886630e4fb4cdfd1f78/LICENSE-NOTES.md#generated-files-owner-decision-2026-10-03

The original MakeHuman garments are CC0. The project-generated hood is also
CC0 under the source owner's generated-files declaration. Source generator
code is not included. Our offline builder uses our existing pose baker,
removes the separate hood for the long sleeve, applies one Loop subdivision
step with UV seams preserved, recomputes smooth normals and a 2 mm cloth offset.
All geometry uses the same pose and metric coordinates as the runway person.
The three variants have 6,112 / 12,704 / 9,632 triangles respectively.
The drawstrings are generated locally from curves.

Build: python tools/build_fitting_outfits.py <source directory>
No texture or pose inference API is used. This is a static presentation,
not a simulation of garment fit or a photorealistic reconstruction of a person.


## Detailed fitting person

person-detail.glb uses the same CC0 body, eyes, eyebrows, eyelashes, hair,
jeans and shoes as the runway model. It is a separate asset; the homepage
continues to use the smaller original. tools/build_detailed_person.py bakes
small source facial detail morphs and one Loop subdivision of visible skin
and hair. Face and hand silhouettes are smoothed together with their UV seams.
Source skin albedo remains 2048 px; normals and hair 1024 px, eyebrows and
lashes 512 px, eyes 1024 px. Total: 80,404 triangles, about 4.38 MB.
No downloaded scan, newly generated identity or subscription API is used.

Drawstrings now sample the actual hoodie triangle surface with ray casts.
Their eyelets use surface normals, and the cords follow the chest surface.
Canonical editor coordinates and the fitted person apply the same transform.
