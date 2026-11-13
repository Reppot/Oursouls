"""Produce web derivatives without changing composition or print artwork."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCES = ('static/theme/hero.png','static/theme/home-print-engraving.png',
           'static/theme/services-open-book.png','static/theme/constructor-preview-v2.png',
           'static/studio/garments-studio-v1.png')

if __name__ == '__main__':
    for name in SOURCES:
        source=ROOT/name
        with Image.open(source) as image:
            target=source.with_suffix('.webp')
            image.save(target,'WEBP',quality=91,method=6)
            print(f'{source.name}: {source.stat().st_size:,} -> {target.stat().st_size:,} bytes')
            if 'theme' in source.parts:
                small=image.copy();small.thumbnail((960,960))
                small.save(source.with_name(source.stem+'-mobile.webp'),'WEBP',quality=87,method=6)
