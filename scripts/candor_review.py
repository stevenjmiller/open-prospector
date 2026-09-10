"""Render candidate crop review, not a runtime renderer or a claim of safe driving."""
import argparse
import json
from pathlib import Path
import numpy as np
import rasterio
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.colors import LightSource, Normalize
from candor_ingest import source_label, check_dataset, window, metrics, file_digest, write_json

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("crops", nargs="+", help="Explicit candidate row,column pairs")
args = parser.parse_args()
source_label(args.source)
args.output.mkdir()
fig = plt.figure(figsize=(15, 8), layout="constrained", facecolor="#f7f8fa")
fig.suptitle("Candor Chasma | choose a terrain crop", fontsize=21, fontweight="bold", color="#182838")
entries = []
with rasterio.open(args.source) as ds:
    check_dataset(ds)
    for i, pair in enumerate(args.crops):
        row, column = map(int, pair.split(","))
        z = window(ds, row, column).astype(float)
        m = metrics(z)
        relative = z - z.min()
        ax = fig.add_subplot(2, len(args.crops), i + 1)
        rgb = LightSource(azdeg=315, altdeg=45).shade(relative, cmap=plt.get_cmap("terrain"), vmin=0, vmax=70, vert_exag=1, dx=1, dy=1)
        ax.imshow(rgb, extent=(0, 256, 0, 256))
        ax.contour(np.arange(256)+.5,255.5-np.arange(256),relative,levels=np.arange(10,71,10),colors="black",alpha=.35,linewidths=.55)
        ax.set_title(f"{chr(65+i)}  |  {m['relief_mm']/1000:.1f} m relief", fontsize=16, fontweight="bold")
        ax.set_xlabel("East (prototype metres)");ax.set_ylabel("North (prototype metres)")
        ax.text(.02,.98,f"Row {row}, column {column}\n{m['steep_cells_ppm']/10000:.1f}% of cells above 25°",transform=ax.transAxes,va="top",fontsize=10,bbox={"facecolor":"white","alpha":.85,"edgecolor":"none"})
        ax3 = fig.add_subplot(2,len(args.crops),len(args.crops)+i+1,projection="3d")
        y,x = np.mgrid[:256:4,:256:4]
        ax3.plot_surface(x,255-y,relative[::4,::4],cmap="terrain",norm=Normalize(0,70),linewidth=0,antialiased=True)
        ax3.set(xlim=(0,256),ylim=(0,256),zlim=(0,70),xlabel="East",ylabel="North",zlabel="Relief (m)")
        ax3.set_box_aspect((256,256,70));ax3.view_init(elev=30,azim=-55)
        ax3.set_title("3D shape • vertical scale 1:1",fontsize=11)
        entries.append({"label":chr(65+i),"source_row":row,"source_column":column,**m})
fig.text(.5,.01,"Each crop: 256 × 256 source pixels. Colour/contours show local height above the crop minimum. Shading is illustrative; no authored obstacles shown.",ha="center",fontsize=10)
fig.savefig(args.output/"candidates.png",dpi=140)
plt.close(fig)
write_json(args.output/"candidates.json",{"source_hash":file_digest(args.source),"review_status":"pending","candidates":entries})
print(args.output/"candidates.png")
