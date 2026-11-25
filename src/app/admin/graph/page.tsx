export const dynamic = 'force-dynamic';

export default function GraphPage() {
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Codebase graph (3D)</h1>
          <p className="text-gray-500 text-sm max-w-2xl">Every file, function and component as a node, built by graphify from the code. Drag to rotate, scroll to zoom, click a node to light up what it connects to, search above, click a group on the left to isolate it. It shows the code as of the last deploy.</p>
        </div>
        <a href="/admin/graph/view" target="_blank" rel="noopener" className="btn-primary py-2 px-4 text-sm">Open full screen</a>
      </div>
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-[#04060d]">
        <iframe src="/admin/graph/view" title="Codebase graph in 3D" className="w-full block" style={{ height: 'calc(100vh - 220px)', minHeight: 420 }} loading="lazy" />
      </div>
    </div>
  );
}
