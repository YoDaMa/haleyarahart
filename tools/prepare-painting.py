#!/usr/bin/env python3
"""Prepare a painting photo for the site.

    python3 tools/prepare-painting.py PHOTO.jpg NUMBER [--title "Untitled X"]

PHOTO should already be cropped to just the painting (no wall, frame or
easel). NUMBER is the two-digit file number, e.g. 10. This writes, in
assets/img/works/:

    NN.jpg        full size (long side up to 2000px), opened in the viewer
    NN-1000.jpg   1000px on the long side, for the grid on sharp screens
    NN-640.jpg    640px on the long side, for the grid on ordinary screens

and prints the <li> to paste into index.html. The photo's color profile is
kept (iPhone photos are Display P3) and camera metadata is dropped.

Needs Pillow:  pip install pillow
"""
import argparse
import os
import re
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit('This needs Pillow:  pip install pillow')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WORKS = os.path.join(ROOT, 'assets', 'img', 'works')


def sizes_for(ar):
    """The width the painting is actually drawn at in each layout (see .plates in
    style.css). Plates are 4:5, so works narrower than that are limited by height."""
    f = min(1.0, 1.25 * ar)
    k = lambda base: base if f >= 0.999 else f'calc({base} * {f:.3f})'
    return (f'(max-width: 600px) min(calc(100vw - 56px), calc(72vh * {ar:.3f})), '
            f'(max-width: 1000px) {k("45vw")}, (min-width: 1680px) {k("500px")}, {k("30vw")}')


def save(img, path, long_side, quality, icc):
    w, h = img.size
    scale = min(1.0, long_side / max(w, h))
    out = img if scale == 1 else img.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    kwargs = dict(quality=quality, optimize=True, progressive=True, subsampling=2)
    if icc:
        kwargs['icc_profile'] = icc
    out.save(path, 'JPEG', **kwargs)
    return out.size


def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('photo')
    ap.add_argument('number', type=int)
    ap.add_argument('--title', default=None, help='title for the printed snippet')
    args = ap.parse_args()

    nn = f'{args.number:02d}'
    src = Image.open(args.photo)
    icc = src.info.get('icc_profile')
    img = ImageOps.exif_transpose(src).convert('RGB')

    full = os.path.join(WORKS, f'{nn}.jpg')
    if os.path.abspath(args.photo) != os.path.abspath(full):   # don't re-encode the full file onto itself
        save(img, full, 2000, 82, icc)
    m_w, m_h = save(img, os.path.join(WORKS, f'{nn}-1000.jpg'), 1000, 80, icc)
    s_w, _ = save(img, os.path.join(WORKS, f'{nn}-640.jpg'), 640, 80, icc)

    title = args.title or 'Untitled'
    p = 'assets/img/works/'
    print(f'''Wrote {nn}.jpg, {nn}-1000.jpg and {nn}-640.jpg. Paste this into the list of works in index.html:

          <li class="piece" id="{slug(title)}">
            <a class="piece__link" href="{p}{nn}.jpg">
              <span class="plate"><img src="{p}{nn}-1000.jpg"
                srcset="{p}{nn}-640.jpg {s_w}w, {p}{nn}-1000.jpg {m_w}w"
                sizes="{sizes_for(m_w / m_h)}"
                width="{m_w}" height="{m_h}" loading="lazy" decoding="async"
                alt="Describe the painting for people who can't see it."></span>
            </a>
            <div class="piece__caption">
              <p class="piece__fig"><i></i></p>
              <h3 class="piece__title">{title}</h3>
              <p class="piece__meta">Medium, size, year</p>
            </div>
          </li>''')


if __name__ == '__main__':
    main()
