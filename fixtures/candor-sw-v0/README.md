# Reviewed Candor terrain fixture

Steve approved candidate **B** on **2026-09-10**: moderate ridges with **30.595 m**
of relief. The frozen crop starts at zero-based source row **7680**, column
**4096**, and is 256 by 256 pixels. See [the reviewed candidates](crop-review.png)
and the source-bound decision in review.json.

Run `npm run terrain` from the repository root. It requires no Python, GDAL or
network access. `npm run check` exercises the same world and observer loaders,
including scope isolation and delayed observation delivery, on these files.

Source: [HiRISE southwest Candor DTM](https://hirise.lpl.arizona.edu/dtm/dtm.php?ID=PSP_001918_1735),
product DTEEC_001918_1735_001984_1735_U01. Credit: NASA/JPL-Caltech/University of
Arizona. The source IMG is 274,282,496 bytes, SHA-256
`3e2a3be3176284b401a809afd69d8dab632ef839c4e5e79826a1889637f6801a`.
The large source is downloaded for preparation; it is not committed here.

## What is frozen

- Eleven scoped runtime rasters and their manifest.
- Exact source float32 crop and PDS label, retained for independent pixel checks.
- Hashed preparation metadata, including native affine/CRS, source and tool
  identities, reviewed offsets and the human decision.
- The exact ingestion script used to create the data.

Elevations retain the Mars 2000 equipotential datum, rounded half-away-from-zero
to signed integer millimetres. The label's native spacing is
**1.0115995086777 m/pixel**. The manifest records its nearest integer millimetre
value, **1012**; the prototype treats each pixel as one **1000 mm** cell, without
rotation, interpolation or height exaggeration. Horizontal distances are thus
about 1.15% shorter. The local origin metadata refers to the source crop's
southwest corner. Authoritative runtime coordinates remain local integers.

Slump/rock obstacle masks and the northwest geofence are **authored overlays**,
not hazards extracted from HiRISE. Both observers initially know the elevation
map but do not know those obstacles. Zero uncertainty is a prototype prior, not
a measurement of HiRISE accuracy. No physical-rover safety claim follows.

## Reproduce preparation

Python/GDAL are preparation dependencies only. On Windows with Python 3.14:

```powershell
python -m venv artifacts/candor-tools
artifacts/candor-tools/Scripts/python.exe -m pip install -r scripts/candor-requirements.txt
curl.exe --fail --location --output artifacts/candor-source.IMG https://hirise.lpl.arizona.edu/PDS/DTM/PSP/ORB_001900_001999/PSP_001918_1735_PSP_001984_1735/DTEEC_001918_1735_001984_1735_U01.IMG
artifacts/candor-tools/Scripts/python.exe scripts/test_candor_ingest.py
artifacts/candor-tools/Scripts/python.exe fixtures/candor-sw-v0/ingest-script.py materialize artifacts/candor-source.IMG artifacts/candor-rebuilt --row 7680 --column 4096 --review fixtures/candor-sw-v0/review.json
npm run terrain -- artifacts/candor-rebuilt artifacts/candor-source.IMG
```

Use new output paths. The final command also compares each crop row directly to
the full source IMG. Different platform/tool binaries legitimately have different
preparation provenance; the eleven terrain-layer hashes must still match. The
review and source hash remain bound. Inspect new candidates using
scripts/candor_ingest.py inspect and scripts/candor_review.py; changing the frozen
crop requires another explicit review, not silently replacing a golden fixture.

This is terrain loader/provenance acceptance. The campaign command still runs
its separately frozen synthetic scenario; it does not silently transplant that
mission, route or classifier record onto Candor.
