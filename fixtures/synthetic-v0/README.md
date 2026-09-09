# Synthetic v0

The authoritative manifest and formula are maintained in
`design/fixtures/vertical-slice`. No generated raster is an independently authored
fixture: `@open-prospector/simulation-world` regenerates all eleven layers and
checks their frozen hashes before writing.

Call `materializeSynthetic(newDirectory, manifest)` with the parsed authoritative
`synthetic-v0.fixture-manifest.json`. The destination must not exist. This source
directory contains documentation only; write generated layers to a new artifact
or temporary directory.

`generateSynthetic(manifest)` returns independent buffers keyed by layer name.
`loadWorld(directory, manifest)` is the privileged simulation adapter entry point;
it opens only truth elevation, truth obstacles, and public geofence. Observer
initial beliefs must be loaded through the belief package.
