import unittest
import numpy as np
from rasterio.io import MemoryFile
from rasterio.transform import from_origin
from candor_ingest import round_mm, window

class ConversionTests(unittest.TestCase):
    def test_signed_half_away_ties(self):
        self.assertEqual(round_mm([.0005,-.0005,.0015,-.0015,1.2344,-1.2344]).tolist(),[1,-1,2,-2,1234,-1234])

    def test_invalid_elevations(self):
        for value in [float('nan'),float('inf'),-3.4028226550889045e38,2147484]:
            with self.assertRaises(ValueError):round_mm([value])

    def test_masked_and_out_of_bounds_windows(self):
        with MemoryFile() as memory:
            with memory.open(driver='GTiff',height=256,width=256,count=1,dtype='float32',nodata=-9999,transform=from_origin(0,256,1,1)) as ds:
                values=np.full((256,256),900,dtype='float32');ds.write(values,1)
                self.assertEqual(window(ds,0,0)[0,0],900)
                with self.assertRaises(ValueError):window(ds,1,0)
                values[128,128]=-9999;ds.write(values,1)
                with self.assertRaises(ValueError):window(ds,0,0)

if __name__=='__main__':unittest.main()
