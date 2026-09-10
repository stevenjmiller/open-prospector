import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonical, hashBytes, parseCanonical, readRasterFile, validateFixture } from '../packages/contracts/dist/index.js';
import { loadWorld } from '../packages/simulation-world/dist/index.js';
import { loadAssetFixture, loadMissionFixture } from '../packages/belief/dist/index.js';

export async function verifyCandor(root, sourcePath) {
  const read=async name=>readFile(join(root,name));
  const json=async name=>parseCanonical((await read(name)).toString('utf8').replace(/\n$/,''));
  const manifest=await json('fixture-manifest.json');validateFixture(manifest);
  assert.equal(manifest.fixture_id,'fixture:candor-sw-v0');assert.equal(manifest.status,'materialized');
  const preparationBytes=await read('preparation.json'),p=await json('preparation.json');
  assert.equal(hashBytes(preparationBytes),manifest.preparation.hash);
  assert.equal(p.source_hash,manifest.source.source_hash);
  assert.equal(p.source_row,manifest.crop.source_row);assert.equal(p.source_column,manifest.crop.source_column);
  assert.equal(p.source_scale_metres,'1.0115995086777');assert.equal(manifest.source.source_scale_mm_per_pixel,1012);
  assert.equal(manifest.grid.cell_size_mm,1000);assert.equal(manifest.crop.resampler,'nearest-pixel-1to1');
  assert.equal(hashBytes(await read('source-label.txt')),p.source_label_hash);
  assert.equal(hashBytes(await read('ingest-script.py')),p.script_hash);
  assert.equal(hashBytes(await read('review.json')),p.review_hash);
  const review=await json('review.json');assert.equal(review.decision,'approved');
  assert.equal(review.source_hash,p.source_hash);assert.equal(review.source_row,p.source_row);assert.equal(review.source_column,p.source_column);
  assert.ok(Object.keys(p.tool_binaries).length>=2,'Missing GDAL/wrapper binary hashes');
  for(const value of Object.values(p.tool_binaries))assert.match(value,/^sha256:[0-9a-f]{64}$/);
  const sourceWindow=await read('source-window.f32le');assert.equal(sourceWindow.length,256*256*4);
  assert.equal(hashBytes(sourceWindow),p.source_window_hash);
  const layers=new Map();
  for(const layer of manifest.layers){const bytes=readRasterFile(root,layer);assert.equal(layer.hash,p.layer_hashes[layer.name]);layers.set(layer.name,bytes);}
  const elevation=layers.get('truth-elevation');
  for(let i=0;i<65536;i++){
    const metres=sourceWindow.readFloatLE(i*4);assert.ok(Number.isFinite(metres)&&metres>=782.07&&metres<=1300.01);
    const expected=Math.sign(metres)*Math.floor(Math.abs(metres)*1000+.5);
    assert.equal(elevation.readInt32LE(i*4),expected,'Source pixel conversion mismatch at '+i);
  }
  if(sourcePath){
    const source=await readFile(sourcePath);assert.equal(hashBytes(source),p.source_hash);assert.equal(source.length,p.source_bytes);
    const label=(await read('source-label.txt')).toString('ascii');
    const recordBytes=Number(/RECORD_BYTES\s*=\s*(\d+)/.exec(label)[1]);
    const first=Number(/\^IMAGE\s*=\s*(\d+)/.exec(label)[1]);
    const width=Number(/LINE_SAMPLES\s*=\s*(\d+)/.exec(label)[1]);
    for(let row=0;row<256;row++){
      const start=(first-1)*recordBytes+((p.source_row+row)*width+p.source_column)*4;
      assert.deepEqual(source.subarray(start,start+1024),sourceWindow.subarray(row*1024,(row+1)*1024),'GDAL/source row mismatch');
    }
  }
  const world=loadWorld(root,manifest),asset=loadAssetFixture(root,manifest,'run:candor-verification','asset:rover-v0'),mission=loadMissionFixture(root,manifest,'run:candor-verification','asset:rover-v0');
  assert.equal(world.cell(220,45).obstacle,true);assert.equal(asset.cell({row:220,column:45}).obstacle,false);
  assert.equal(asset.stateHash(),mission.stateHash());
  return {profile:'candor-loader-evidence-v0',status:'verified',source_hash:p.source_hash,crop:manifest.crop,layer_hashes:p.layer_hashes,asset_initial_belief_hash:asset.stateHash(),mission_initial_belief_hash:mission.stateHash(),source_pixels_checked:65536,full_source_checked:Boolean(sourcePath)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{console.log(canonical(await verifyCandor(resolve(process.argv[2]??'fixtures/candor-sw-v0'),process.argv[3])));}
  catch(error){console.error(String(error));process.exitCode=1;}
}
