"""Build a human review page for every saved source/mask/cutout pair."""
import html,json,csv
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def main():
 meta=json.loads((ROOT/'static/rack/mask-manifest.json').read_text())
 products=json.loads((ROOT/'catalog.json').read_text(encoding='utf-8'))
 names={p['images'][0]:p['name'] for p in products if p.get('images')}
 base='https://our-souls-shop.onrender.com'
 cards=[]
 for source,item in meta.items():
  title=html.escape(names.get(source,Path(source).name));source_url=base+source
  cards.append(f'<article><h2>{title}</h2><div class="views"><figure><a href="{source_url}" target="_blank" rel="noopener"><img src="{source_url}" alt="Исходное фото" loading="lazy"></a><figcaption>Исходник</figcaption></figure><figure><a href="{base+item["mask"]}" target="_blank" rel="noopener"><img src="{base+item["mask"]}" alt="Маска" loading="lazy"></a><figcaption>Маска</figcaption></figure><figure><div class="cutout"><a href="{base+item["image"]}" target="_blank" rel="noopener"><img src="{base+item["image"]}" alt="{title}" loading="lazy"></a></div><figcaption>Готовая вырезка</figcaption></figure></div><p>{html.escape(source)} · RGB исходника сохранён в PNG-мастере</p></article>')
 page='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Our Souls — проверка масок</title><style>*{box-sizing:border-box}body{margin:0;background:#18241e;color:#edf2e9;font:15px/1.5 system-ui,sans-serif}header{position:sticky;top:0;padding:18px 4vw;background:#18241ef5;z-index:2;border-bottom:1px solid #53644f;display:flex;align-items:center;gap:20px;flex-wrap:wrap}h1{font-size:24px;margin:0}button{min-height:44px;padding:10px 18px;color:#15221a;background:#c0d1b8;border:0;cursor:pointer;border-radius:5px}main{max-width:1600px;margin:auto;padding:24px}article{padding:20px;margin-bottom:24px;border:1px solid #53644f;border-radius:6px}h2{font-size:20px;margin-top:0}.views{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}figure{margin:0;min-width:0}figure img{display:block;width:100%;height:400px;object-fit:contain}figure:nth-child(2) img{background:#000}.cutout{background:#263b2e}.light .cutout{background:#f3f4f0}.black .cutout{background:#090909}figcaption{padding-top:10px}p{font-size:12px;color:#bbcbb5;overflow-wrap:anywhere}@media(max-width:700px){main{padding:12px}article{padding:12px}.views{gap:8px}figure img{height:210px}h2{font-size:17px}}</style><header><h1>Our Souls · Маски каталога</h1><button data-bg="">Зелёный фон</button><button data-bg="light">Светлый фон</button><button data-bg="black">Чёрный фон</button></header><main>'
 page+=''.join(cards)+'</main><script>document.querySelectorAll("[data-bg]").forEach(button=>button.onclick=()=>document.body.className=button.dataset.bg)</script></html>'
 (ROOT/'docs/qa/mask-review.html').write_text(page,encoding='utf-8')
 (ROOT/'static/rack/review.html').write_text(page,encoding='utf-8')
 with (ROOT/'docs/qa/mask-files.csv').open('w',encoding='utf-8-sig',newline='') as file:
  writer=csv.writer(file,delimiter=';');writer.writerow(['Товар','Исходное фото','Маска PNG','Вырезка WebP','PNG мастер'])
  for source,item in meta.items():writer.writerow([names.get(source,Path(source).name),source,item['mask'],item['image'],Path(item['mask']).stem+'.png'])
 print('Review records:',len(meta))

if __name__=='__main__':main()
