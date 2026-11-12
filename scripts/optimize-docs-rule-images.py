"""Lossless local encoding for prepare-fimel-card-rules.ts output; never edits source files."""
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image

root = Path(sys.argv[1]).resolve()
assert root.is_relative_to(Path('.artifacts').resolve()), 'Only an ignored preparation directory is allowed'
plan = json.loads((root / 'plan.json').read_text(encoding='utf-8'))
original_total = optimized_total = converted = 0
for index, asset in enumerate(plan['images']):
    original = (root / asset['file']).read_bytes()
    assert hashlib.sha256(original).hexdigest() == asset['sha256']
    with Image.open(io.BytesIO(original)) as image:
        pixels = image.convert('RGBA').tobytes()
        encoded = io.BytesIO()
        image.save(encoded, format='WEBP', lossless=True, quality=100, method=6, exact=True,
                   icc_profile=image.info.get('icc_profile', b''))
        candidate = encoded.getvalue()
        with Image.open(io.BytesIO(candidate)) as check:
            assert check.size == image.size and check.convert('RGBA').tobytes() == pixels, 'Lossless pixel check failed'
    original_total += len(original)
    asset['originalSha256'] = asset['sha256']
    asset['originalSize'] = len(original)
    asset['pixelSha256'] = hashlib.sha256(pixels).hexdigest()
    asset['losslessPixelMatch'] = True
    if len(candidate) < len(original):
        digest = hashlib.sha256(candidate).hexdigest()
        asset.update(file=f'images/{digest}.webp', sha256=digest, size=len(candidate), mime='image/webp')
        (root / asset['file']).write_bytes(candidate)
        converted += 1
    optimized_total += asset['size']
    if (index + 1) % 50 == 0:
        print(f'Checked {index + 1}/{len(plan["images"])} images', flush=True)
plan['compression'] = dict(originalBytes=original_total, optimizedBytes=optimized_total,
                           convertedToWebp=converted, keptPng=len(plan['images']) - converted,
                           allPixelsIdentical=True, savedPercent=round(100 * (1 - optimized_total / original_total), 2))
(root / 'optimized-plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(plan['compression']))
