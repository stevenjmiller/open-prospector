# Vertical-slice fixture work

`candor-sw-v0.fixture-manifest.json` now points to the approved materialized
fixture in `fixtures/candor-sw-v0`. Steve reviewed candidate B on 2026-09-10;
source row 7680, column 4096 is frozen. The materialized fixture's review JSON records the
decision. PC8 records the precise native scale and preparation custody.
Any replacement ingest must:

1. download and hash the HiRISE PDS DTM;
2. record GDAL and conversion-script versions;
3. select a fully valid 256 by 256 source window and obtain human review of its
   useful relief;
4. convert it to the eleven scoped binary layers in the implementation brief,
   applying the declared one-source-pixel-to-one-1,000-mm-cell v0 convention;
5. add authored slump, rock, geofence, known mask, and uncertainty layers as
   scenario overlays rather than corrupting source elevation provenance;
6. replace every null, set status `materialized`, and pass the same loader and
   leak tests as the synthetic fixture.

The continuous synthetic fixture and reviewed Candor fixture use the same
manifest and runtime layer formats. Candor's preparation sidecar additionally
binds the source label/crop, conversion script, tool hashes and human review.

## Synthetic v0 generator

The generator source fingerprint is SHA-256 over these exact UTF-8 bytes with LF
after every shown line, including the last:

```text
synthetic-v0-formula-1
elevation_mm=10*row+5*column
truth_obstacles=column45,row207..235;row205,column45
geofence=rows0..19,columns0..19
initial_known=all
initial_obstacles=none
initial_uncertainty_mm=0
```

Iterate rasters row-major. Encode elevation as little-endian signed int32,
uncertainty as little-endian unsigned int32, and masks as one byte per cell. The
expected hashes are frozen in `synthetic-v0.fixture-manifest.json`. Both initial
beliefs know all elevations but neither knows the slump or rock obstacle. The
planning-entry sweep discovers the nearby slump; the more distant rock remains
hidden until the executing obstacle sensor reaches it.
