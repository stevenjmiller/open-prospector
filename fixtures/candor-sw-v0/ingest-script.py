"""Offline HiRISE/GDAL preparation. Runtime code never imports these dependencies."""
import argparse
import hashlib
import json
import math
import platform
import re
from pathlib import Path

import numpy as np
import rasterio
from rasterio.windows import Window

PRODUCT = "DTEEC_001918_1735_001984_1735_U01"
SIZE = 256


def digest(data):
    return "sha256:" + hashlib.sha256(data).hexdigest()


def file_digest(path):
    with open(path, "rb") as source:
        return "sha256:" + hashlib.file_digest(source, "sha256").hexdigest()


def write_json(path, value):
    path.write_text(json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def round_mm(values):
    values = np.asarray(values, dtype=np.float64)
    if not np.isfinite(values).all():
        raise ValueError("Nonfinite elevation")
    result = np.copysign(np.floor(np.abs(values) * 1000 + 0.5), values)
    if (result < -2147483648).any() or (result > 2147483647).any():
        raise ValueError("Elevation exceeds int32 millimetres")
    return result.astype("<i4")


def source_label(path):
    with open(path, "rb") as stream:
        prefix = stream.read(32768)
    record_bytes = int(re.search(rb"RECORD_BYTES\s*=\s*(\d+)", prefix)[1])
    records = int(re.search(rb"FILE_RECORDS\s*=\s*(\d+)", prefix)[1])
    if path.stat().st_size != record_bytes * records:
        raise ValueError("Source download is incomplete")
    label = prefix[:record_bytes]
    if PRODUCT.encode() not in label:
        raise ValueError("Unexpected source product")
    return label


def check_dataset(ds):
    t = ds.transform
    if ds.driver != "PDS" or ds.count != 1 or ds.dtypes != ("float32",):
        raise ValueError("Expected single-band float32 PDS")
    if not (t.a > 0 and t.e < 0 and t.b == 0 and t.d == 0):
        raise ValueError("Source is not north-up; no implicit rotation allowed")
    if ds.scales != (1.0,) or ds.offsets != (0.0,):
        raise ValueError("Unexpected source elevation scale/offset")


def window(ds, row, column):
    if row < 0 or column < 0 or row + SIZE > ds.height or column + SIZE > ds.width:
        raise ValueError("Crop outside source")
    value = ds.read(1, window=Window(column, row, SIZE, SIZE), masked=True)
    if np.ma.getmaskarray(value).any() or not np.isfinite(value.data).all():
        raise ValueError("Crop contains nodata")
    # The designated product's label supplies these valid elevation bounds.
    if value.min() < 782.07 or value.max() > 1300.01:
        raise ValueError("Crop exceeds PDS valid elevation bounds")
    return value.data.astype("<f4")


def metrics(values):
    z = values.astype(np.float64)
    dy, dx = np.gradient(z)
    slope = np.hypot(dx, dy)
    yy, xx = np.mgrid[:SIZE, :SIZE]
    plane = np.column_stack([xx.ravel(), yy.ravel(), np.ones(SIZE * SIZE)])
    fit = np.linalg.lstsq(plane, z.ravel(), rcond=None)[0]
    residual = z - (fit[0] * xx + fit[1] * yy + fit[2])
    return {"relief_mm": int(round_mm([z.max() - z.min()])[0]),
            "detrended_rms_mm": int(round_mm([np.sqrt(np.mean(residual ** 2))])[0]),
            "steep_cells_ppm": int(np.count_nonzero(slope > math.tan(math.radians(25))) * 1000000 // z.size)}


def inspect(source, output):
    label = source_label(source)
    output.mkdir()
    with rasterio.open(source) as ds:
        check_dataset(ds)
        candidates = []
        for row in range(0, ds.height - SIZE + 1, SIZE):
            for column in range(0, ds.width - SIZE + 1, SIZE):
                try:
                    values = window(ds, row, column)
                except ValueError:
                    continue
                candidates.append({"source_row": row, "source_column": column, **metrics(values)})
        write_json(output / "inspection.json", {"product_id": PRODUCT, "source_hash": file_digest(source),
            "source_bytes": source.stat().st_size, "rows": ds.height, "columns": ds.width,
            "gdal_version": rasterio.__gdal_version__, "rasterio_version": rasterio.__version__,
            "affine": [str(v) for v in list(ds.transform)[:6]], "crs_wkt": ds.crs.to_wkt(),
            "candidates": candidates})
        (output / "source-label.txt").write_bytes(label)
    print(f"Inspected {len(candidates)} completely valid crops; no crop approved or frozen.")


def materialize(source, output, row, column, review_path=None):
    label = source_label(source)
    with rasterio.open(source) as ds:
        check_dataset(ds)
        values = window(ds, row, column)
        elevation = round_mm(values)
        # Authored overlays; source elevations are never modified to invent hazards.
        yy, xx = np.mgrid[:SIZE, :SIZE]
        obstacles = ((xx == 45) & (((yy >= 207) & (yy <= 235)) | (yy == 205))).astype("u1")
        fence = ((yy < 20) & (xx < 20)).astype("u1")
        template = json.loads(Path("design/fixtures/vertical-slice/candor-sw-v0.fixture-manifest.json").read_text())
        template["status"] = "materialized"
        template["source"]["source_hash"] = file_digest(source)
        template["source"]["source_scale_mm_per_pixel"] = int(round_mm([ds.transform.a])[0])
        template["crop"].update(source_row=row, source_column=column)
        # Origin is the southwest crop corner in the original Mars projection.
        from rasterio.warp import transform
        x, y = ds.transform * (column, row + SIZE)
        lon, lat = transform(ds.crs, rasterio.crs.CRS.from_dict(proj="longlat", R=3396040), [x], [y])
        template["local_frame"].update(origin_latitude_microdegrees=int(round_mm([lat[0] * 1000])[0]),
            origin_longitude_microdegrees=int(round_mm([(lon[0] % 360) * 1000])[0]))
        arrays = {}
        for layer in template["layers"]:
            name = layer["name"]
            if name.endswith("-elevation"):
                array = elevation
            elif name == "truth-obstacles":
                array = obstacles
            elif name == "geofence":
                array = fence
            elif name.endswith("-known"):
                array = np.ones((SIZE, SIZE), dtype="u1")
            elif name.endswith("-uncertainty"):
                array = np.zeros((SIZE, SIZE), dtype="<u4")
            else:
                array = np.zeros((SIZE, SIZE), dtype="u1")
            data = array.tobytes(order="C")
            layer.update(hash=digest(data), byte_length=len(data))
            arrays[layer["path"]] = data
        binary_root = Path(rasterio.__file__).parent.parent
        binaries = sorted(set(binary_root.glob("rasterio.libs/*gdal*.dll")) | set(binary_root.glob("rasterio.libs/*gdal*.so*")) | set(binary_root.glob("rasterio/_io*.pyd")) | set(binary_root.glob("rasterio/_io*.so")))
        provenance = {"profile": "candor-preparation-v0", "source_hash": template["source"]["source_hash"],
            "source_bytes": source.stat().st_size, "source_label_hash": digest(label),
            "source_window_hash": digest(values.tobytes()), "source_row": row, "source_column": column,
            "source_shape": [ds.height, ds.width], "source_scale_metres": str(ds.transform.a),
            "source_affine": [str(v) for v in list(ds.transform)[:6]], "source_crs_wkt": ds.crs.to_wkt(),
            "source_datum": "Mars 2000 equipotential surface; retained, datum_elevation_mm=0",
            "origin_convention": "southwest crop corner; planetocentric latitude, east longitude",
            "rounding": "half-away-from-zero-to-mm", "resampler": "nearest-pixel-1to1",
            "script_hash": digest(Path(__file__).read_bytes().replace(b"\r\n", b"\n")), "python_version": platform.python_version(),
            "gdal_version": rasterio.__gdal_version__, "rasterio_version": rasterio.__version__,
            "numpy_version": np.__version__, "tool_binaries": {p.name: file_digest(p) for p in binaries},
            "overlays": "synthetic-v0 authored slump, rock and northwest geofence; all initial elevations known, obstacles hidden, uncertainty zero",
            "layer_hashes": {v["name"]: v["hash"] for v in template["layers"]}, "metrics": metrics(values)}
        review = None
        if review_path:
            review = json.loads(review_path.read_text(encoding="utf-8"))
            if (review.get("decision") != "approved" or review.get("source_hash") != provenance["source_hash"]
                    or review.get("source_row") != row or review.get("source_column") != column):
                raise ValueError("Review does not approve these source bytes and crop")
            review_bytes = (json.dumps(review, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
            provenance["review_hash"] = digest(review_bytes)
        output.mkdir()
        for name, data in arrays.items():
            (output / name).write_bytes(data)
        (output / "source-window.f32le").write_bytes(values.tobytes())
        (output / "source-label.txt").write_bytes(label)
        (output / "ingest-script.py").write_bytes(Path(__file__).read_bytes().replace(b"\r\n", b"\n"))
        if review is not None:
            (output / "review.json").write_bytes(review_bytes)
        write_json(output / "preparation.json", provenance)
        template["preparation"] = {"path": "preparation.json", "hash": file_digest(output / "preparation.json")}
        write_json(output / "fixture-manifest.json", template)
    print(f"Materialized {'reviewed crop' if review is not None else 'unreviewed candidate'} {row},{column}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["inspect", "materialize"])
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--row", type=int)
    parser.add_argument("--column", type=int)
    parser.add_argument("--review", type=Path, help="Human decision bound to source hash and crop")
    args = parser.parse_args()
    if args.command == "inspect":
        inspect(args.source, args.output)
    else:
        if args.row is None or args.column is None:
            parser.error("materialize requires explicit --row and --column")
        materialize(args.source, args.output, args.row, args.column, args.review)
