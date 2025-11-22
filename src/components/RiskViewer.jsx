import React, { useEffect, useRef, useState } from 'react';

// Minimal viewer that renders a PDF page to a canvas and overlays risk boxes
// Reuses the same dynamic import approach as FormAutoFill to avoid bundling pdfjs
const RiskViewer = ({ fileUrl, fileBlob, riskData, onClose }) => {
  const canvasRef = useRef(null);
  const [pdfRef, setPdfRef] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [renderError, setRenderError] = useState(null);
  const [normalizedBoxes, setNormalizedBoxes] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadPdf() {
      setRenderError(null);
      setIsLoading(true);
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf');
        if (pdfjs && pdfjs.GlobalWorkerOptions) {
          const ver = pdfjs.version || '2.16.105';
          pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver}/pdf.worker.min.js`;
        }

        const src = fileBlob || (fileUrl ? { url: fileUrl } : null);
        if (!src) {
          setRenderError('No file available to preview');
          return;
        }

        const loadingTask = fileBlob
          ? pdfjs.getDocument({ data: await fileBlob.arrayBuffer() })
          : pdfjs.getDocument(src.url || src);

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setPdfRef(pdf);
        setTotalPages(pdf.numPages || 1);
      } catch (err) {
        console.error('RiskViewer loadPdf failed', err);
        setRenderError('Failed to load PDF');
      } finally {
        // keep loading visible until first render completes
      }
    }

    loadPdf();
    return () => { cancelled = true; if (pdfRef && pdfRef.destroy) try { pdfRef.destroy(); } catch(e){} };
  }, [fileUrl, fileBlob]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      setRenderError(null);
      setIsLoading(true);
      if (!pdfRef) return;
      try {
        const page = await pdfRef.getPage(pageNum);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1 });
        const canvas = canvasRef.current;
        if (!canvas) { setRenderError('No canvas to render'); return; }
        const ctx = canvas.getContext('2d');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        await page.render({ canvasContext: ctx, viewport }).promise;

        // draw overlays if riskData contains boxes
        try {
          // reset normalized boxes for this render; will be filled if overlays exist
          setNormalizedBoxes([]);
          const overlays = extractBoxesForPage(riskData, pageNum);
          if (overlays && overlays.length) {
            ctx.save();
            // overlays is a flat array of enriched boxes
            const pageNormalized = [];
              // Helper: optionally de-emphasize specific noisy boxes by exact coordinate match (tolerance)
              const shouldDeemphasizeRaw = (raw) => {
                if (!raw) return false;
                const tx = 110.51995579200003;
                const ty = 438.3743534503152;
                const tw = 441.327447529472;
                const th = 13.197194721120013;
                const eps = 0.5; // tolerance in pixels
                const rx = Number(raw.x ?? raw.left ?? (Array.isArray(raw) ? raw[0] : NaN));
                const ry = Number(raw.y ?? raw.top ?? (Array.isArray(raw) ? raw[1] : NaN));
                const rw = Number(raw.width ?? raw.w ?? (Array.isArray(raw) ? (raw[2] - (raw[0]||0)) : NaN));
                const rh = Number(raw.height ?? raw.h ?? (Array.isArray(raw) ? (raw[3] - (raw[1]||0)) : NaN));
                if ([rx, ry, rw, rh].some(v => !Number.isFinite(v))) return false;
                return Math.abs(rx - tx) <= eps && Math.abs(ry - ty) <= eps && Math.abs(rw - tw) <= eps && Math.abs(rh - th) <= eps;
              };

              overlays.forEach(box => {
              // prefer the raw box data if present
              const raw = box._raw || box;
              const candidate = (raw && (raw.x !== undefined || raw.left !== undefined || Array.isArray(raw))) ? raw : box;
              const b = normalizeBox(candidate, viewport, canvas);
              if (!b) return;

              // Determine overlay color by risk level (High -> soft red, Medium -> soft yellow, Low -> green)
              const levelRaw = (box.risk_level || box.level || '').toString().toLowerCase();
              // soft red and soft yellow palette for smoother display
              let strokeColor = 'rgba(239,68,68,0.95)'; // soft red (tailwind red-500)
              let fillColor = 'rgba(239,68,68,0.12)';
              if (levelRaw.includes('medium') || levelRaw.includes('med')) {
                strokeColor = 'rgba(250,204,21,0.95)'; // soft yellow (yellow-400)
                fillColor = 'rgba(250,204,21,0.12)';
              } else if (levelRaw.includes('low')) {
                strokeColor = 'rgba(34,197,94,0.95)';
                fillColor = 'rgba(34,197,94,0.12)';
              } else if (levelRaw.includes('critical') || levelRaw.includes('very high')) {
                strokeColor = 'rgba(185,28,28,0.98)';
                fillColor = 'rgba(185,28,28,0.18)';
              }

              // detect noisy box candidates (we'll de-emphasize rather than remove)
              const isDeemphasized = shouldDeemphasizeRaw(box._raw || box);

              if (isDeemphasized) {
                // low-contrast gray outline and very faint fill for de-emphasis
                ctx.strokeStyle = 'rgba(107,114,128,0.35)'; // gray-500 softened
                ctx.lineWidth = Math.max(1, Math.round(Math.max(1, Math.min(canvas.width, canvas.height)) * 0.002));
                ctx.strokeRect(b.x, b.y, b.w, b.h);
                ctx.fillStyle = 'rgba(229,231,235,0.06)'; // gray-200 very faint
                ctx.fillRect(b.x, b.y, b.w, b.h);
              } else {
                ctx.strokeStyle = strokeColor;
                ctx.lineWidth = Math.max(2, Math.min(8, Math.round(Math.max(1, Math.min(canvas.width, canvas.height)) * 0.004)));
                ctx.strokeRect(b.x, b.y, b.w, b.h);
                ctx.fillStyle = fillColor;
                ctx.fillRect(b.x, b.y, b.w, b.h);
              }

              // Do not draw textual risk tag on every box. Risk level is shown in the Field Details panel when selected.
              // Instead draw a subtle colored corner marker to indicate severity visually.
              try {
                if (!isDeemphasized) {
                  const markerSize = Math.max(8, Math.round(Math.min(20, canvas.width * 0.012)));
                  ctx.fillStyle = strokeColor;
                  ctx.fillRect(b.x - 1, b.y - 1, markerSize, markerSize);
                }
              } catch (e) {
                // ignore marker draw failures
              }
              // save normalized box info for hit-testing
              pageNormalized.push({ box, normalized: b });
            });
            ctx.restore();
            // store normalized boxes for click detection
            setNormalizedBoxes(pageNormalized);
          }
        } catch (e) {
          console.warn('Failed to draw overlays', e);
        }
        setIsLoading(false);
      } catch (err) {
        console.error('RiskViewer render failed', err);
        setRenderError('Failed to render page');
        setIsLoading(false);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [pdfRef, pageNum, riskData]);

  function extractBoxesForPage(data, p) {
    if (!data) return [];
    // Normalize and flatten many possible formats into a flat array of boxes with optional metadata
    const out = [];

    const pushBox = (entry, parentMeta = {}) => {
      if (!entry) return;
      if (Array.isArray(entry)) {
        entry.forEach(e => pushBox(e, parentMeta));
        return;
      }
      const box = entry;
      out.push({
        _raw: box,
        page: box.page || parentMeta.page || parentMeta.page_number || 1,
        risk_level: parentMeta.risk_level || box.risk_level || box.level || null,
        category: parentMeta.category || box.category || null,
        // include more parent metadata so child coordinate entries surface parent info
        original_text: parentMeta.original_text || parentMeta.text_fragment || box.original_text || box.text_fragment || null,
        text_fragment: parentMeta.text_fragment || box.text_fragment || null,
        explanation: parentMeta.explanation || box.explanation || null,
        recommendation: parentMeta.recommendation || box.recommendation || null,
        compliance_check: parentMeta.compliance_check || box.compliance_check || null,
      });
    };

    if (Array.isArray(data)) {
      data.forEach(d => {
        const pageNum = d.page || d.page_number || 1;
        const coords = d.coordinates || d.coords || d.bbox || d.box || d.rect || d.bboxNorm || null;
        const meta = {
          page: pageNum,
          risk_level: d.risk_level || d.level,
          category: d.category,
          explanation: d.explanation,
          recommendation: d.recommendation,
          compliance_check: d.compliance_check,
          original_text: d.original_text,
          text_fragment: d.text_fragment
        };
        if (coords) pushBox(coords, meta);
        else pushBox(d, meta);
      });
      return out.filter(b => Number(b.page || 1) === p);
    }

    if (data.result && Array.isArray(data.result)) {
      data.result.forEach(d => {
        const pageNum = d.page || d.page_number || 1;
        const coords = d.coordinates || d.coords || d.bbox || d.box || d.rect || d.bboxNorm || null;
        const meta = {
          page: pageNum,
          risk_level: d.risk_level || d.level,
          category: d.category,
          explanation: d.explanation,
          recommendation: d.recommendation,
          compliance_check: d.compliance_check,
          original_text: d.original_text,
          text_fragment: d.text_fragment
        };
        if (coords) pushBox(coords, meta);
        else pushBox(d, meta);
      });
      return out.filter(b => Number(b.page || 1) === p);
    }

    // Some services return a top-level `risks` array
    if (data.risks && Array.isArray(data.risks)) {
      data.risks.forEach(d => {
        const pageNum = d.page || d.page_number || 1;
        const coords = d.coordinates || d.coords || d.bbox || d.box || d.rect || d.bboxNorm || null;
        const meta = {
          page: pageNum,
          risk_level: d.risk_level || d.level,
          category: d.category,
          explanation: d.explanation,
          recommendation: d.recommendation,
          compliance_check: d.compliance_check,
          original_text: d.original_text,
          text_fragment: d.text_fragment
        };
        if (coords) pushBox(coords, meta);
        else pushBox(d, meta);
      });
      return out.filter(b => Number(b.page || 1) === p);
    }

    if (data.fields && Array.isArray(data.fields)) {
      data.fields.forEach(d => {
        const pageNum = d.page || 1;
        const coords = d.coordinates || d.coords || d.bbox || d.box || d.rect || d.bboxNorm || null;
        const meta = {
          page: pageNum,
          risk_level: d.risk_level || d.level,
          category: d.category,
          explanation: d.explanation,
          recommendation: d.recommendation,
          compliance_check: d.compliance_check,
          original_text: d.original_text,
          text_fragment: d.text_fragment
        };
        if (coords) pushBox(coords, meta);
        else pushBox(d, meta);
      });
      return out.filter(b => Number(b.page || 1) === p);
    }

    return [];
  }

  // Handle clicks on the canvas to detect clicks on overlays
  useEffect(() => {
    // keyboard navigation: left/right to change pages
    const onKey = (e) => {
      if (e.key === 'ArrowRight') {
        setPageNum(p => Math.min(totalPages, p + 1));
      } else if (e.key === 'ArrowLeft') {
        setPageNum(p => Math.max(1, p - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [totalPages]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onClick = (ev) => {
      try {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (ev.clientX - rect.left) * scaleX;
        const y = (ev.clientY - rect.top) * scaleY;
        // hit-test against normalizedBoxes
        for (const entry of normalizedBoxes) {
          const r = entry.normalized;
          if (!r) continue;
          if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            // found
            setSelectedBox({ meta: entry.box, coords: r });
            return;
          }
        }
        // if clicked outside any box, clear selection
        setSelectedBox(null);
      } catch (err) {
        console.error('Canvas click handler error', err);
      }
    };
    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [normalizedBoxes]);

  function normalizeBox(box, viewport, canvas) {
    if (!box) return null;
    // support array formats [x,y,w,h] or [xmin,ymin,xmax,ymax]
    let x=0,y=0,w=0,h=0;
    if (Array.isArray(box) && box.length === 4) {
      const [a,b,c,d] = box.map(Number);
      // Determine if array represents [x,y,w,h] or [xmin,ymin,xmax,ymax]
      // If c and d look like extents larger than a/b, treat as xmax/xmax -> convert to w/h
      if (c > a && d > b && (c - a) <= viewport.width && (d - b) <= viewport.height) {
        // treat as [xmin, ymin, xmax, ymax]
        x = a; y = b; w = c - a; h = d - b;
      } else {
        // fallback: assume [x,y,w,h]
        x = a; y = b; w = c; h = d;
      }
    } else if (box.x !== undefined) { x = Number(box.x); y = Number(box.y); w = Number(box.w || box.width || 0); h = Number(box.h || box.height || 0); }
    else if (box.left !== undefined) { x = Number(box.left); y = Number(box.top); w = Number(box.width); h = Number(box.height); }
    else return null;

    // if bbox looks normalized (0..1) convert to viewport pixels
    let usedPdfCoordinates = false;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1 && w >= 0 && w <= 1 && h >= 0 && h <= 1) {
      // normalized coordinates (likely PDF-relative); convert to viewport pixels
      x = x * viewport.width;
      y = y * viewport.height;
      w = w * viewport.width;
      h = h * viewport.height;
      // Treat normalized coords as PDF-space (origin at bottom-left) so we flip Y below.
      usedPdfCoordinates = true;
    } else if (x >= 0 && y >= 0 && (x <= viewport.width || y <= viewport.height || w <= viewport.width || h <= viewport.height)) {
      // Coordinates appear to be in PDF page points (0..viewport.width/height)
      usedPdfCoordinates = true;
      // keep them as-is for now; we'll convert Y below (PDF origin at bottom-left)
    }

    // If coordinates were given in PDF space (origin bottom-left), we'll decide whether to flip
    // by sampling the rendered canvas pixel luminance under the flipped vs non-flipped candidate.
    if (usedPdfCoordinates) {
      const flipY = (yv, hv) => Math.round(viewport.height - (yv + hv));
      const yFlipped = flipY(y, h);
      const yNotFlipped = Math.round(y);

      // clamp helper
      const clampRect = (xx, yy, ww, hh) => {
        const cx = Math.max(0, Math.min(Math.round(xx), canvas.width - 1));
        const cy = Math.max(0, Math.min(Math.round(yy), canvas.height - 1));
        const cw = Math.max(1, Math.min(Math.round(ww), canvas.width - cx));
        const ch = Math.max(1, Math.min(Math.round(hh), canvas.height - cy));
        return { cx, cy, cw, ch };
      };

      // attempt to sample a small region in the center of the box to detect text (darker)
      try {
        const ctx = canvas.getContext('2d');
        if (ctx && typeof ctx.getImageData === 'function') {
          const sampleSize = 5; // 5x5 sample
          const centerX = x + w / 2;
          const centerXF = Math.round(centerX - Math.floor(sampleSize / 2));

          const flippedRect = clampRect(centerXF, yFlipped + Math.round(h / 2) - Math.floor(sampleSize / 2), sampleSize, sampleSize);
          const notFlippedRect = clampRect(centerXF, yNotFlipped + Math.round(h / 2) - Math.floor(sampleSize / 2), sampleSize, sampleSize);

          const sampleLum = (rect) => {
            if (rect.cw <= 0 || rect.ch <= 0) return Number.POSITIVE_INFINITY;
            const img = ctx.getImageData(rect.cx, rect.cy, rect.cw, rect.ch).data;
            let sum = 0; let count = 0;
            for (let i = 0; i < img.length; i += 4) {
              const r = img[i], g = img[i+1], b = img[i+2];
              // luminance
              const lum = 0.299*r + 0.587*g + 0.114*b;
              sum += lum; count++;
            }
            return sum / Math.max(1, count);
          };

          const lumFlipped = sampleLum(flippedRect);
          const lumNot = sampleLum(notFlippedRect);

          // choose the mapping that is darker (lower luminance) since that likely overlaps text
          if (Number.isFinite(lumFlipped) && Number.isFinite(lumNot)) {
            if (lumFlipped <= lumNot) {
              y = yFlipped;
            } else {
              y = yNotFlipped;
            }
          } else {
            // fallback to flipping (original behavior)
            y = yFlipped;
          }
        } else {
          // no ctx available, fallback to flipping
          y = Math.round(viewport.height - (y + h));
        }
      } catch (e) {
        // if getImageData throws (unlikely here), fallback to flipping
        y = Math.round(viewport.height - (y + h));
      }
    }

    // Round to integer pixels
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);

    // clamp
    x = Math.max(0, Math.min(x, canvas.width));
    y = Math.max(0, Math.min(y, canvas.height));
    w = Math.max(1, Math.min(w, canvas.width - x));
    h = Math.max(1, Math.min(h, canvas.height - y));
    return { x, y, w, h };
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-semibold text-gray-900">Risk Analysis Preview</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded">Close</button>
          </div>
        </div>
        <div className="p-3 flex gap-4">
          <div className="flex-1 relative">
            {renderError && <div className="text-red-600 mb-2">{renderError}</div>}
            {/* Sticky pagination controls like FormAutoFill */}
            {totalPages > 1 && (
              <div className="z-30 inline-flex items-center gap-1 sm:gap-2 bg-white/95 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg shadow-md border border-gray-200 absolute" style={{ top: 12, left: 12 }}>
                <button
                  onClick={() => setPageNum(Math.max(1, pageNum - 1))}
                  disabled={pageNum <= 1}
                  className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <div className="text-xs sm:text-sm px-1 sm:px-2 font-medium">
                  {pageNum} / {totalPages}
                </div>
                <button
                  onClick={() => setPageNum(Math.min(totalPages, pageNum + 1))}
                  disabled={pageNum >= totalPages}
                  className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageNum}
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                    setPageNum(v);
                  }}
                  className="w-12 sm:w-14 px-1 sm:px-2 py-1 border rounded text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            )}
            <div className="w-full">
              <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          </div>

          {/* Details panel for clicked field */}
          <div className="w-80 max-h-[70vh] overflow-auto bg-gray-50 border-l border-gray-100 p-3 rounded-r-lg">
            <h4 className="font-semibold text-gray-800 mb-2">Field Details</h4>
            {!selectedBox && <div className="text-sm text-gray-500">Click a highlighted field on the document to see details here.</div>}
            {selectedBox && (
              <div className="space-y-2 text-sm text-gray-700">
                <div><strong>Category:</strong> <span className="font-medium">{selectedBox.meta?.category || selectedBox.meta?.risk_level || '—'}</span></div>
                <div><strong>Risk Level:</strong> <span className="font-medium">{selectedBox.meta?.risk_level || 'Unknown'}</span></div>
                {selectedBox.meta?.compliance_check && (
                  <div><strong>Compliance Check:</strong>
                    <div className="mt-1 p-2 bg-white border rounded text-xs text-gray-800">{selectedBox.meta.compliance_check}</div>
                  </div>
                )}
                {/* Text fragment or original_text */}
                {/* {(selectedBox.meta?.text_fragment || selectedBox.meta?.original_text) && (
                //   <div><strong>Text:</strong>
                //     <div className="mt-1 p-2 bg-white border rounded text-xs text-gray-800">
                //       {(() => {
                //         const rawText = selectedBox.meta.text_fragment || selectedBox.meta.original_text || '';
                //         // remove a noisy legal boilerplate sentence if present
                //         const noise = 'executed such further acts, deeds and things as to more fully effectively convey title to the';
                //         let cleaned = rawText.replace(/\s+/g, ' ').trim();
                //         if (cleaned.includes(noise)) {
                //           cleaned = cleaned.replace(noise, '').replace(/\s+/g, ' ').trim();
                //           if (cleaned) cleaned += ' [… boilerplate trimmed]';
                //         }
                //         return cleaned;
                //       })()}
                //     </div>
                //   </div>
                )} */}
                {/* {selectedBox.meta?._raw && (
                //   <div>
                //     <strong>Coordinates:</strong>
                //     <div className="mt-1 space-y-1 text-xs text-gray-700">
                //      
                //       {Array.isArray(selectedBox.meta._raw) ? (
                //         selectedBox.meta._raw.map((r, i) => (
                //           <div key={i} className="p-1 bg-white border rounded">{`#${i+1}: x:${r.x ?? r.left ?? r[0]} y:${r.y ?? r.top ?? r[1]} w:${r.width ?? r.w ?? (r[2] - (r[0]||0)) ?? r[2]} h:${r.height ?? r.h ?? (r[3] - (r[1]||0)) ?? r[3]}`}</div>
                //         ))
                //       ) : (
                //         <div className="p-1 bg-white border rounded">{`x:${selectedBox.meta._raw.x ?? selectedBox.meta._raw.left ?? ''} y:${selectedBox.meta._raw.y ?? selectedBox.meta._raw.top ?? ''} w:${selectedBox.meta._raw.width ?? selectedBox.meta._raw.w ?? ''} h:${selectedBox.meta._raw.height ?? selectedBox.meta._raw.h ?? ''}`}</div>
                //       )}
                //     </div>
                //   </div>
                )} */}
                {selectedBox.meta?.explanation && (
                  <div><strong>Explanation:</strong>
                    <div className="mt-1 p-2 bg-white border rounded text-xs text-gray-800">{selectedBox.meta.explanation}</div>
                  </div>
                )}
                {selectedBox.meta?.recommendation && (
                  <div><strong>Recommendation:</strong>
                    <div className="mt-1 p-2 bg-white border rounded text-xs text-gray-800">{selectedBox.meta.recommendation}</div>
                  </div>
                )}
                <div className="pt-2 flex gap-2">
                  <button onClick={() => setSelectedBox(null)} className="px-3 py-1 bg-blue-600 text-white rounded">Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskViewer;
