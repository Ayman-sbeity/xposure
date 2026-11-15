import urllib.request,json,re,concurrent.futures
from pathlib import Path
from lxml import html
base='https://xposurelb.com'
paths=['/','/index.php/xposure-hostess-company-in-lebanon/','/index.php/xposure-services/','/index.php/portfolio/xposure-portfolio/','/index.php/contact/','/index.php/portfolios/xposures-success-at-horeca-exhibition-2024/','/index.php/portfolios/ezzeddine-plus-iftar-an-evening-of-exquisite-elegance-organized-by-xposure/']
def fetch(path):
 try:
  raw=urllib.request.urlopen(base+path,timeout=30).read();doc=html.fromstring(raw);name=path.strip('/').replace('/','_') or 'home'
  Path('source-export/raw/'+name+'.html').write_bytes(raw)
  for bad in doc.xpath('//script|//style|//nav|//footer|//header'):bad.drop_tree()
  text=[' '.join(x.split()) for x in doc.xpath('//main//text()') if x.strip()]
  if not text:text=[' '.join(doc.text_content().split())]
  imgs=[]
  orig=html.fromstring(raw)
  for el in orig.xpath('//img'):
   u=el.get('data-tgpli-src') or el.get('data-src') or el.get('src') or ''
   if 'wp-content/uploads' not in u:continue
   ss=el.get('data-tgpli-srcset') or el.get('srcset') or ''
   if ss:
    candidates=[z.strip().split()[0] for z in ss.split(',') if z.strip()];u=candidates[-1] if candidates else u
   imgs.append({'url':u,'alt':el.get('alt',''),'page':base+path})
  for u in re.findall(r'https?[^\s\"\'<>]+?\.(?:webp|jpg|jpeg|png)',raw.decode(errors='ignore')):
   if '/uploads/' in u:imgs.append({'url':u.replace('\\/','/'),'alt':'','page':base+path})
  return {'url':base+path,'text':text,'images':imgs}
 except Exception as e:return {'url':base+path,'error':str(e)}
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:pages=list(pool.map(fetch,paths))
Path('source-export/content/pages.json').write_text(json.dumps(pages,indent=2))
uniq={}
for p in pages:
 for i in p.get('images',[]):
  u=i['url'];key=re.sub(r'-(?:\d+x\d+|thegem[^/.]*)','',u)
  if key not in uniq:uniq[key]=i
Path('source-export/content/image-candidates.json').write_text(json.dumps(list(uniq.values()),indent=2))
print(json.dumps([{'url':p['url'],'images':len(p.get('images',[])),'error':p.get('error')} for p in pages]))
print(json.dumps(list(uniq.values())[:65],indent=2))
