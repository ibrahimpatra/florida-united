import ForceGraph3D from '3d-force-graph';
const D = window.__GRAPH__;
const deg = {}; D.links.forEach(l => { deg[l.source] = (deg[l.source] || 0) + 1; deg[l.target] = (deg[l.target] || 0) + 1; });
const comms = [...new Set(D.nodes.map(n => n.c))].sort((a, b) => a - b);
const hue = c => `hsl(${(comms.indexOf(c) * 137.508) % 360}, 80%, 62%)`;
D.nodes.forEach(n => { n.color = hue(n.c); n.val = 1 + Math.sqrt(deg[n.id] || 0) * 1.6; });
const byId = new Map(D.nodes.map(n => [n.id, n]));
const nb = new Map(D.nodes.map(n => [n.id, new Set()]));
D.links.forEach(l => { nb.get(l.source)?.add(l.target); nb.get(l.target)?.add(l.source); });
let hi = null, filter = null, query = '';
const visible = n => (filter === null || n.c === filter) && (!query || n.label.toLowerCase().includes(query) || n.f.toLowerCase().includes(query));
const el = document.getElementById('g');
const G = ForceGraph3D()(el).backgroundColor('#04060d').graphData({ nodes: D.nodes, links: D.links })
  .nodeLabel(n => `<b>${n.label}</b><br>${n.f}<br><i>${n.cn}</i> · ${deg[n.id] || 0} links`)
  .nodeColor(n => hi ? (n === hi || nb.get(hi.id).has(n.id) ? n.color : '#1b2233') : n.color)
  .linkOpacity(0.7).nodeVal('val').nodeRelSize(3).nodeOpacity(0.95).nodeResolution(10)
  .nodeVisibility(visible)
  .linkVisibility(l => visible(l.source) && visible(l.target))
  .linkColor(l => hi ? (l.source === hi || l.target === hi ? '#ffd166' : 'rgba(80,90,120,0.08)') : 'rgba(150,180,255,0.55)')
  .linkWidth(l => hi && (l.source === hi || l.target === hi) ? 1.5 : 0.5)
  .linkDirectionalParticles(l => hi && (l.source === hi || l.target === hi) ? 4 : 0).linkDirectionalParticleWidth(2.2).linkDirectionalParticleSpeed(0.012)
  .onNodeClick(n => { hi = n; refresh(); const d = 90 + (deg[n.id] || 0); const r = 1 + d / Math.hypot(n.x, n.y, n.z);
    G.cameraPosition({ x: n.x * r, y: n.y * r, z: n.z * r }, n, 900); info(n); })
  .onBackgroundClick(() => { hi = null; refresh(); info(null); })
  .cooldownTicks(260).warmupTicks(30);
G.d3Force('charge').strength(-28);
G.d3Force('link').distance(l => 18 + 4 * Math.min(8, Math.sqrt(Math.max(deg[l.source.id ?? l.source] || 1, 1))));
const refresh = () => G.nodeColor(G.nodeColor()).linkColor(G.linkColor()).nodeVisibility(visible).linkVisibility(l => visible(l.source) && visible(l.target)).linkWidth(G.linkWidth()).linkDirectionalParticles(G.linkDirectionalParticles());
const panel = document.getElementById('info');
function info(n) {
  if (!n) { panel.innerHTML = '<p class="hint">Click a node to light up its connections. Drag to rotate, scroll to zoom, right-drag to pan.</p>'; return; }
  const ns = [...nb.get(n.id)].map(i => byId.get(i)).filter(Boolean).sort((a, b) => (deg[b.id] || 0) - (deg[a.id] || 0)).slice(0, 14);
  panel.innerHTML = `<h3>${n.label}</h3><p class="f">${n.f}${n.l ? ' · ' + n.l : ''}</p><p>${n.cn}</p><p><b>${deg[n.id] || 0}</b> connections</p><ul>${ns.map(x => `<li data-id="${x.id}">${x.label}</li>`).join('')}</ul>`;
  panel.querySelectorAll('li').forEach(li => li.onclick = () => { const t = byId.get(li.dataset.id); if (t) G.onNodeClick()(t); });
}
info(null);
// legend: the 14 biggest communities
const size = {}; D.nodes.forEach(n => size[n.c] = (size[n.c] || 0) + 1);
const top = Object.entries(size).sort((a, b) => b[1] - a[1]).slice(0, 14);
const cname = {}; D.nodes.forEach(n => cname[n.c] = n.cn);
const lg = document.getElementById('legend');
lg.innerHTML = top.map(([c, k]) => `<button data-c="${c}"><i style="background:${hue(+c)}"></i>${cname[c]} <span>${k}</span></button>`).join('');
lg.querySelectorAll('button').forEach(b => b.onclick = () => { const c = +b.dataset.c; filter = filter === c ? null : c; lg.querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.c === filter)); refresh(); G.zoomToFit(600, 40, visible); });
document.getElementById('q').oninput = e => { query = e.target.value.trim().toLowerCase(); refresh(); };
document.getElementById('q').onkeydown = e => { if (e.key === 'Enter') G.zoomToFit(600, 40, visible); };
let spin = true; const btn = document.getElementById('spin');
const ctl = G.controls(); ctl.autoRotate = true; ctl.autoRotateSpeed = 0.5;
btn.onclick = () => { spin = !spin; ctl.autoRotate = spin; btn.textContent = spin ? 'Pause rotation' : 'Rotate'; };
el.addEventListener('pointerdown', () => { ctl.autoRotate = false; spin = false; btn.textContent = 'Rotate'; });
document.getElementById('stats').textContent = `${D.nodes.length} nodes · ${D.links.length} links · ${comms.length} communities`;
window.addEventListener('resize', () => G.width(innerWidth).height(innerHeight));
