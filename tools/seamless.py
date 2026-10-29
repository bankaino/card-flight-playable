#!/usr/bin/env python3
"""seamless.py — make an art/gen tile repeat without a visible seam (run from the project root; writes back into art/gen, the original goes to art/raw/<name>_pre_seam.png).

    python3 tools/seamless.py NAME [x|y] [--r 0.12]

Half-shift blend: the image is rolled by half its size, so the roll has its seam in the middle and none at the edges; the output takes the rolled
copy exactly at the edges and fades to the original within `r` of the size. Prints the edge difference before/after (mean abs, 0..255).
"""
import sys, os, shutil
import numpy as np
from PIL import Image
a = [x for x in sys.argv[1:] if not x.startswith('--')]; name = a[0]; axis = a[1] if len(a) > 1 else 'x'
r = float(sys.argv[sys.argv.index('--r') + 1]) if '--r' in sys.argv else 0.12
src = os.path.join('art', 'gen', name + '.png'); im = Image.open(src).convert('RGBA'); A = np.array(im).astype(np.float32)
if axis == 'y': A = A.transpose(1, 0, 2)
H, W = A.shape[:2]
def edge(X): return float(np.abs(X[:, 0, :3] - X[:, -1, :3]).mean())
before = edge(A); S = np.roll(A, W // 2, axis=1)
x = np.arange(W, dtype=np.float32); d = np.minimum(x, W - 1 - x) / (r * W); m = np.clip(d, 0, 1); m = (m * m * (3 - 2 * m))[None, :, None]
O = A * m + S * (1 - m)
after = edge(O)
if axis == 'y': O = O.transpose(1, 0, 2)
os.makedirs(os.path.join('art', 'raw'), exist_ok=True); shutil.copy(src, os.path.join('art', 'raw', name + '_pre_seam.png'))
Image.fromarray(np.clip(O, 0, 255).astype(np.uint8), 'RGBA').save(src)
print(f'{name} {axis}: edge diff {before:.1f} -> {after:.1f}')
