import json,sys,subprocess
src,out=sys.argv[1],sys.argv[2]
g=json.load(open(src))
nodes=[{'id':n['id'],'label':n.get('label',n['id']),'c':n.get('community',0),'cn':n.get('community_name') or f"Community {n.get('community',0)}",'f':n.get('source_file',''),'l':n.get('source_location','')} for n in g['nodes']]
ids={n['id'] for n in nodes}
links=[{'source':l['source'],'target':l['target'],'r':l.get('relation','')} for l in g['links'] if l['source'] in ids and l['target'] in ids]
data=json.dumps({'nodes':nodes,'links':links},separators=(',',':')).replace('</','<\\/')
subprocess.check_call(['npx','esbuild','app.js','--bundle','--minify','--format=iife','--outfile=bundle.js','--log-level=warning'])
js=open('bundle.js').read().replace('</script','<\\/script')
html=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Florida Kuwait codebase graph (3D)</title><style>
html,body{{margin:0;height:100%;background:#04060d;color:#dbe4ff;font:13px/1.4 system-ui,sans-serif;overflow:hidden}}
#g{{position:fixed;inset:0}}
.panel{{position:fixed;background:rgba(8,12,24,.82);backdrop-filter:blur(6px);border:1px solid #1d2a4a;border-radius:12px;padding:12px}}
#top{{top:12px;left:12px;width:min(300px,calc(100vw - 48px))}}
#top h1{{margin:0 0 4px;font-size:15px}} #stats{{color:#8aa0d6;margin-bottom:8px}}
#q{{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #28375f;background:#0b1226;color:#fff}}
#spin{{margin-top:8px;padding:6px 10px;border-radius:8px;border:1px solid #28375f;background:#0b1226;color:#dbe4ff;cursor:pointer}}
#legend{{margin-top:10px;max-height:34vh;overflow:auto;display:flex;flex-direction:column;gap:3px}}
#legend button{{display:flex;align-items:center;gap:8px;text-align:left;padding:4px 6px;border-radius:6px;border:1px solid transparent;background:none;color:#dbe4ff;cursor:pointer;font:inherit}}
#legend button.on,#legend button:hover{{border-color:#3a5099;background:#0f1a38}} #legend i{{width:10px;height:10px;border-radius:50%;flex:none}} #legend span{{margin-left:auto;color:#7f93c4}}
#info{{right:12px;top:12px;width:min(260px,calc(100vw - 48px));max-height:70vh;overflow:auto}}
#info h3{{margin:0 0 2px;font-size:15px;word-break:break-word}} .f,.hint{{color:#8aa0d6;margin:2px 0}} #info ul{{padding-left:16px;margin:6px 0}} #info li{{cursor:pointer;color:#9fc0ff}} #info li:hover{{text-decoration:underline}}
@media(max-width:640px){{#info{{top:auto;bottom:12px;max-height:30vh}} #legend{{max-height:18vh}}}}
</style></head><body><div id="g"></div>
<div class="panel" id="top"><h1>Florida Kuwait: codebase graph</h1><div id="stats"></div><input id="q" placeholder="Search a file, function or component" aria-label="Search"><button id="spin">Pause rotation</button><div id="legend"></div></div>
<div class="panel" id="info"></div>
<script>window.__GRAPH__={data};</script><script>{js}</script></body></html>'''
open(out,'w').write(html); print(len(nodes),len(links),len(html)//1024,'KB')
