import json,urllib.request,concurrent.futures,re
from pathlib import Path
from PIL import Image
from io import BytesIO
items=json.loads(Path('source-export/content/image-candidates.json').read_text());seen=set();out=[]
for i in items:
 u=i['url'];u='https:'+u if u.startswith('//') else u
 if u in seen:continue
 seen.add(u);i['url']=u;out.append(i)
Path('source-export/images').mkdir(exist_ok=True)
def download(pair):
 n,i=pair;u=i['url'];name=str(n).zfill(2)+'-'+u.rsplit('/',1)[1];i['file']='source-export/images/'+name
 try:
  b=urllib.request.urlopen(u,timeout=20).read();Path(i['file']).write_bytes(b)
  im=Image.open(BytesIO(b));i['width'],i['height']=im.size
  im.thumbnail((1800,1800));target='public/assets/'+name.rsplit('.',1)[0]+'.webp';im.save(target,'WEBP',quality=85);i['optimized']=target;i['bytes']=len(b)
 except Exception as e:i['error']=str(e)
 return i
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:r=list(pool.map(download,enumerate(out)))
Path('source-export/content/asset-manifest.json').write_text(json.dumps(r,indent=2));print(json.dumps([{'file':i.get('optimized'),'w':i.get('width'),'h':i.get('height'),'error':i.get('error')} for i in r]))
# contact sheet
thumbs=[]
from PIL import ImageDraw
for i in r:
 if 'optimized' not in i:continue
 im=Image.open(i['optimized']).convert('RGB');im.thumbnail((210,135));tile=Image.new('RGB',(230,170),'#eee');tile.paste(im,((230-im.width)//2,0));ImageDraw.Draw(tile).text((5,140),Path(i['optimized']).name[:33],fill='black');thumbs.append(tile)
sheet=Image.new('RGB',(230*5,170*((len(thumbs)+4)//5)),'white')
for n,t in enumerate(thumbs):sheet.paste(t,((n%5)*230,(n//5)*170))
sheet.save('/workspace/scratch/5041a997313b/tmp/xposure_assets.jpg')
