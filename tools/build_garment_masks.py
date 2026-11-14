"""Offline product matting. Model/build dependencies never run on the website.
Original RGB is retained in lossless masters; only the learned alpha is added.
"""
import argparse,hashlib,json,time
from pathlib import Path
import numpy as np
import onnxruntime as ort
from PIL import Image,ImageOps,ImageDraw

ROOT=Path(__file__).resolve().parents[1]
EXPECTED_MODEL_MD5='4fab47adc4ff364be1713e97b7e66334'

def write_json(path,data):
 temporary=path.with_suffix(path.suffix+'.tmp')
 temporary.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
 temporary.replace(path)

def run():
 parser=argparse.ArgumentParser()
 parser.add_argument('--model',type=Path,required=True)
 parser.add_argument('--masters',type=Path,required=True)
 parser.add_argument('--only',nargs='*')
 args=parser.parse_args()
 model_hash=hashlib.md5(args.model.read_bytes()).hexdigest()
 if model_hash!=EXPECTED_MODEL_MD5:raise ValueError('Model checksum does not match the published BiRefNet Lite release')
 options=ort.SessionOptions();options.intra_op_num_threads=4;options.inter_op_num_threads=1
 session=ort.InferenceSession(str(args.model),sess_options=options,providers=['CPUExecutionProvider'])
 print('Mask engine:',session.get_providers(),flush=True)
 manifest_path=ROOT/'static/rack/cutouts.json'
 manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
 meta_path=ROOT/'static/rack/mask-manifest.json'
 meta=json.loads(meta_path.read_text(encoding='utf-8')) if meta_path.exists() else {}
 masks=ROOT/'static/rack/masks';outputs=ROOT/'static/rack/masked'
 for folder in (masks,outputs,args.masters):folder.mkdir(parents=True,exist_ok=True)
 mean=np.array([.485,.456,.406],np.float32);std=np.array([.229,.224,.225],np.float32)
 for index,url in enumerate(list(manifest)):
  if args.only and Path(url).stem not in args.only:continue
  source=ROOT/url.lstrip('/');source_bytes=source.read_bytes();source_hash=hashlib.sha256(source_bytes).hexdigest()
  digest=hashlib.sha256(source_bytes+model_hash.encode()).hexdigest()[:20]
  mask_path=masks/(digest+'.png');target=outputs/(digest+'.webp');master=args.masters/(digest+'.png')
  if url in meta and meta[url].get('source_sha256')==source_hash and target.exists() and master.exists():
   manifest[url]='/static/rack/masked/'+target.name;print(f'{index+1}/{len(manifest)} cached {source.name}',flush=True);continue
  start=time.monotonic();original=ImageOps.exif_transpose(Image.open(source)).convert('RGB')
  image=np.asarray(original.resize((1024,1024),Image.Resampling.BILINEAR),dtype=np.float32)/255
  tensor=np.transpose((image-mean)/std,(2,0,1))[None].astype(np.float32)
  logits=session.run(None,{session.get_inputs()[0].name:tensor})[0][0,0]
  prob=1/(1+np.exp(-np.clip(logits,-60,60)))
  prob=(prob-prob.min())/max(1e-8,float(prob.max()-prob.min()))
  mask=Image.fromarray(np.uint8(np.clip(prob*255,0,255))).resize(original.size,Image.Resampling.LANCZOS)
  alpha=np.asarray(mask).copy();alpha[alpha<3]=0;alpha[alpha>252]=255
  mask=Image.fromarray(alpha);bbox=Image.fromarray(np.uint8(alpha>8)*255).getbbox()
  if bbox is None or np.mean(alpha>128)<.12:raise ValueError(f'Empty or implausible garment mask: {url}')
  mask.save(mask_path,optimize=True)
  rgba=original.copy();rgba.putalpha(mask)
  assert np.array_equal(np.asarray(rgba)[:,:,:3],np.asarray(original)), 'Original print RGB must not be changed'
  rgba.save(master,optimize=True)
  l,t,r,b=bbox;box=(max(0,l-2),max(0,t-2),min(original.width,r+2),min(original.height,b+2))
  web=rgba.crop(box);web.thumbnail((800,900),Image.Resampling.LANCZOS);web.save(target,'WEBP',quality=93,method=6)
  manifest[url]='/static/rack/masked/'+target.name
  meta[url]={'source_sha256':source_hash,'mask':'/static/rack/masks/'+mask_path.name,'image':manifest[url],
    'model':'BiRefNet-general-lite','model_md5':model_hash,'original_size':list(original.size),'bbox':list(box),'rgb_preserved_in_master':True}
  write_json(manifest_path,manifest)
  write_json(meta_path,meta)
  print(f'{index+1}/{len(manifest)} {source.name}: {time.monotonic()-start:.1f}s, {target.stat().st_size} bytes',flush=True)
 # Review actual alpha on light, dark and neutral surfaces; never recolour artwork.
 records=[(url,record) for url,record in meta.items() if not args.only or Path(url).stem in args.only]
 for offset in range(0,len(records),12):
  batch=records[offset:offset+12];sheet=Image.new('RGB',(1440,((len(batch)+3)//4)*390),'#e2e7e2');draw=ImageDraw.Draw(sheet)
  for n,(url,record) in enumerate(batch):
   x=(n%4)*360;y=(n//4)*390;panel=Image.new('RGB',(360,360),'#24372c')
   garment=Image.open(ROOT/record['image'].lstrip('/')).convert('RGBA');garment.thumbnail((330,340),Image.Resampling.LANCZOS)
   panel.paste(garment,((360-garment.width)//2,(360-garment.height)//2),garment);sheet.paste(panel,(x,y));draw.text((x+12,y+367),Path(url).name,fill='#17231b')
  sheet.save(args.masters/f'review-{offset//12+1}.jpg',quality=94)
 print('Finished',len(meta),'masks',flush=True)

if __name__=='__main__':run()
