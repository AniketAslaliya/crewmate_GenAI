import React, { useState, useRef, useEffect } from 'react';
import papi from '../Axios/paxios';
// framer-motion not required here
import api from '../Axios/axios';
const normalizeBbox = (bbox) => {
  // Support multiple bbox formats returned by backend
  // { xmin, ymin, xmax, ymax } or { x, y, w, h } or { left, top, width, height }
  if (!bbox) return null;
  // support array formats [x,y,w,h] or [xmin,ymin,xmax,ymax]
  if (Array.isArray(bbox) && bbox.length === 4) {
    const [a, b, c, d] = bbox.map(n => Number(n) || 0);
    // if values look like xmin,ymin,xmax,ymax (where c>a and d>b)
    if (c > a && d > b) {
      return { x: a, y: b, w: c - a, h: d - b };
    }
    // otherwise assume x,y,w,h
    return { x: a, y: b, w: c, h: d };
  }
  if (bbox.xmin !== undefined) {
    return { x: bbox.xmin, y: bbox.ymin, w: bbox.xmax - bbox.xmin, h: bbox.ymax - bbox.ymin };
  }
  if (bbox.x !== undefined && bbox.y !== undefined && bbox.w !== undefined) {
    return { x: bbox.x, y: bbox.y, w: bbox.w, h: bbox.h };
  }
  if (bbox.left !== undefined) {
    return { x: bbox.left, y: bbox.top, w: bbox.width, h: bbox.height };
  }
  return null;
};

// Helper: detect if a bbox looks normalized (fractions 0..1)
const looksNormalizedFraction = (b) => {
  if (!b) return false;
  const vals = [b.x, b.y, b.w, b.h].map(v => Number(v));
  if (vals.some(v => Number.isNaN(v))) return false;
  // if all values are between 0 and 1 (inclusive)
  return vals.every(v => v >= 0 && v <= 1);
};

const FormAutoFill = () => {
  const [file, setFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);
  const [fields, setFields] = useState([]);
  const [selectedField, setSelectedField] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  // Simple AcroForm flow (fillable PDFs)
  const [simpleFields, setSimpleFields] = useState([]); // array of field names
  const [simpleValues, setSimpleValues] = useState({});
  const [loadingExtractSimple, setLoadingExtractSimple] = useState(false);
  const [loadingFillSimple, setLoadingFillSimple] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [guideActive, setGuideActive] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [guideAnswers, setGuideAnswers] = useState({});
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const pdfCanvasRef = useRef(null);
  const [pdfRenderError, setPdfRenderError] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pdfRef = useRef(null);
  const pdfUrlRef = useRef(null);
  const initialValuesRef = useRef({ fieldValues: {}, simpleValues: {} });
  const [hasEdits, setHasEdits] = useState(false);

  // (simulation removed - component always calls backend APIs; client-side fallbacks remain)

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // cleanup pdf url/object on unmount
  useEffect(() => {
    return () => {
      try {
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      } catch (e) {}
      try {
        if (pdfRef.current && typeof pdfRef.current.destroy === 'function') pdfRef.current.destroy();
      } catch (e) {}
    };
  }, []);

  // helpers: base64 <-> array buffer conversions
  const blobToBase64 = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result; // data:<type>;base64,....
      resolve(dataUrl.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const base64ToUint8 = (b64) => {
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return arr;
  };

  // Save and restore UI state (file bytes, fields, values, page) to localStorage
  const STORAGE_KEY = 'formAutofill:state:v1';

  const saveStateToStorage = async (opts = {}) => {
    try {
      const payload = {
        fileName: file ? file.name : null,
        fileType: file ? file.type : null,
        isPdf: !!isPdf,
        currentPage: currentPage || 1,
        totalPages: totalPages || 1,
        fields: fields || [],
        fieldValues: fieldValues || {},
      };
      // include file bytes as base64 when available (avoid repeating conversion)
      if (file) {
        // if we already have pdfArrayBuffer for PDFs, use it
        if (isPdf && pdfArrayBuffer) {
          const arr = new Uint8Array(pdfArrayBuffer);
          // convert to base64
          let binary = '';
          for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
          payload.fileBase64 = btoa(binary);
        } else if (!isPdf && imageUrl) {
          // imageUrl might already be a data URL or object URL; try to capture the blob from the file
          try {
            const b64 = await blobToBase64(file);
            payload.fileBase64 = b64;
          } catch (e) {
            // fallback: skip file bytes
          }
        } else {
          // generic fallback: try to read file to base64
          try {
            const b64 = await blobToBase64(file);
            payload.fileBase64 = b64;
          } catch (e) {}
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.warn('saveStateToStorage failed', err);
    }
  };

  const restoreStateFromStorage = async () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj) return false;
      setFieldValues(obj.fieldValues || {});
      setFields(obj.fields || []);
      setCurrentPage(obj.currentPage || 1);
      setTotalPages(obj.totalPages || 1);
      if (obj.fileBase64 && obj.fileName) {
        const u8 = base64ToUint8(obj.fileBase64);
        const blob = new Blob([u8], { type: obj.fileType || 'application/pdf' });
        const f = new File([blob], obj.fileName, { type: obj.fileType || 'application/pdf' });
        setFile(f);
        const url = URL.createObjectURL(f);
        setImageUrl(url);
        setIsPdf(!!obj.isPdf);
        if (obj.isPdf) {
          try {
            // keep pdfArrayBuffer for label resolution
            setPdfArrayBuffer(u8.buffer);
            // render requested page
            await renderPdfToCanvas(f, obj.currentPage || 1);
          } catch (e) {
            console.warn('restore pdf render failed', e);
          }
        } else {
          // for images, when the imageUrl updates, repaint will be triggered
          setTimeout(() => repaintValuesOnCanvas(1), 200);
        }
        // mark restored values as initial (not user-edited)
        initialValuesRef.current = { fieldValues: obj.fieldValues || {}, simpleValues: {} };
      }
      return true;
    } catch (err) {
      console.warn('restoreStateFromStorage failed', err);
      return false;
    }
  };

  // restore on mount
  useEffect(() => {
    restoreStateFromStorage().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // save whenever key pieces of state change
  useEffect(() => {
    // fire-and-forget
    saveStateToStorage().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, fields, fieldValues, currentPage, totalPages, isPdf]);

  // mark dirty when user-edited values differ from initial snapshot
  useEffect(() => {
    try {
      const initial = initialValuesRef.current || { fieldValues: {}, simpleValues: {} };
      const cur = { fieldValues: fieldValues || {}, simpleValues: simpleValues || {} };
      const same = JSON.stringify(initial.fieldValues || {}) === JSON.stringify(cur.fieldValues || {}) && JSON.stringify(initial.simpleValues || {}) === JSON.stringify(cur.simpleValues || {});
      setHasEdits(!same);
    } catch (e) {
      setHasEdits(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldValues, simpleValues]);

  const onFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setImageUrl(url);
    const pdfCheck = f.type === 'application/pdf' || (f.name && f.name.toLowerCase().endsWith('.pdf'));
    setIsPdf(pdfCheck);
    setFields([]);
    setSelectedField(null);
    setFieldValues({});
    if (pdfCheck) {
      renderPdfToCanvas(f, 1);
      // store ArrayBuffer for pdf-js based label resolution
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPdfArrayBuffer(ev.target.result);
        };
        reader.readAsArrayBuffer(f);
      } catch (e) {
        console.warn('Could not read pdf array buffer', e);
      }
    }
  };

  // --- Simple AcroForm handlers (fillable PDF workflow) ---
  const extractAcroFields = async () => {
    if (!file) return alert('Please select a PDF first.');
    setLoadingExtractSimple(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/forms/extract', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const names = res.data.fields || [];
      setSimpleFields(names);
      const seed = {};
      names.forEach(n => seed[n] = '');
      setSimpleValues(seed);
    } catch (err) {
      console.error('extractAcroFields failed', err);
      alert('Failed to extract fields. Make sure the PDF has AcroForm fields.');
    } finally {
      setLoadingExtractSimple(false);
    }
  };

  const handleSimpleValueChange = (name, value) => {
    setSimpleValues(prev => ({ ...prev, [name]: value }));
  };

  const fillAndDownload = async () => {
    if (!file) return alert('No file to fill.');
    setLoadingFillSimple(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('values', JSON.stringify(simpleValues));
      const res = await api.post('/api/forms/fill', fd, { headers: { 'Content-Type': 'multipart/form-data' }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name ? `filled-${file.name}` : 'filled-form.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error('fillAndDownload failed', err);
      alert('Failed to fill or download PDF.');
    } finally {
      setLoadingFillSimple(false);
    }
  };

  const renderPdfToCanvas = async (file, startPage = 1) => {
    setPdfRenderError(null);
    let pdfjs = null;
    try {
      // try legacy build first (works with newer pdfjs-dist packages)
      pdfjs = await import('pdfjs-dist/legacy/build/pdf');
    } catch (e1) {
      try {
        pdfjs = await import('pdfjs-dist/build/pdf');
      } catch (e2) {
        console.error('pdfjs import failed', e1, e2);
        setPdfRenderError('Failed to load PDF renderer');
        return;
      }
    }

    try {
      // try to set worker from versioned CDN when possible
      if (pdfjs && pdfjs.GlobalWorkerOptions) {
        const ver = pdfjs.version || '2.16.105';
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver}/pdf.worker.min.js`;
      }

      const url = URL.createObjectURL(file);
      // keep the url/ref so we can revoke later when a new file is loaded
      if (pdfUrlRef.current) {
        try { URL.revokeObjectURL(pdfUrlRef.current); } catch (e) { /* ignore */ }
      }
      pdfUrlRef.current = url;

      const loadingTask = pdfjs.getDocument(url);
      const pdf = await loadingTask.promise;
      pdfRef.current = pdf;
      setTotalPages(pdf.numPages || 1);
      // render the requested startPage
      const page = await pdf.getPage(startPage);
      // pick a scale that renders at native page resolution but stays reasonable
      const viewport = page.getViewport({ scale: 1 });
      const canvas = pdfCanvasRef.current;
      if (!canvas) {
        setPdfRenderError('No canvas available to render PDF');
        return;
      }
      const context = canvas.getContext('2d');
      // set canvas internal size to page size
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // ensure responsive display
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      const renderContext = { canvasContext: context, viewport };
      await page.render(renderContext).promise;
      setNaturalSize({ w: viewport.width, h: viewport.height });
      setCurrentPage(startPage);
      // repaint any saved values for this page
      setTimeout(() => repaintValuesOnCanvas(startPage), 50);
    } catch (err) {
      console.error('PDF render failed', err);
      setPdfRenderError('Failed to render PDF preview');
    }
  };

  const renderPage = async (pageNum) => {
    try {
      if (!pdfRef.current) return;
      const pdf = pdfRef.current;
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      // resize canvas to new page
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      canvas.style.width = '100%';
      canvas.style.height = 'auto';
      await page.render({ canvasContext: ctx, viewport }).promise;
      setNaturalSize({ w: viewport.width, h: viewport.height });
      setCurrentPage(pageNum);
      // repaint saved values for the rendered page
      setTimeout(() => repaintValuesOnCanvas(pageNum), 50);
    } catch (err) {
      console.error('renderPage failed', err);
      setPdfRenderError('Failed to render PDF page');
    }
  };

  // repaint saved values onto the current canvas (for PDF pages or images)
  const repaintValuesOnCanvas = (pageNum) => {
    try {
      if (isPdf) {
        // for pdf, draw values for fields on the given page onto the pdf canvas
        fields.forEach(f => {
          const fPage = f.page || 1;
          if (fPage !== pageNum) return;
          const val = fieldValues[f.id];
          if (val) drawValueOnCanvas(f, val);
        });
      } else {
        // for images, create a new image with values baked in
        const canvas = applyAllValuesToCanvas();
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        setImageUrl(dataUrl);
      }
    } catch (err) {
      console.warn('repaintValuesOnCanvas failed', err);
    }
  };

  // heuristic detection of rectangular light fields from the rendered canvas
  const detectFieldBoxes = async () => {
    try {
      // get source canvas: pdf canvas if PDF, otherwise draw image to offscreen canvas
      let srcCanvas = null;
      if (isPdf && pdfCanvasRef.current) {
        srcCanvas = pdfCanvasRef.current;
      } else if (!isPdf && imgRef.current) {
        // draw image onto an offscreen canvas at its natural size
        const img = imgRef.current;
        const off = document.createElement('canvas');
        off.width = naturalSize.w || img.naturalWidth || img.width;
        off.height = naturalSize.h || img.naturalHeight || img.height;
        const ctx = off.getContext('2d');
        ctx.drawImage(img, 0, 0, off.width, off.height);
        srcCanvas = off;
      } else {
        return [];
      }

      const cw = srcCanvas.width;
      const ch = srcCanvas.height;
      const ctx = srcCanvas.getContext('2d');
      if (!ctx) return [];
      const step = Math.max(4, Math.floor(Math.min(cw, ch) / 200)); // adaptive sampling
      const gw = Math.floor(cw / step);
      const gh = Math.floor(ch / step);
      const imgData = ctx.getImageData(0, 0, cw, ch).data;
      const grid = new Uint8Array(gw * gh);
      // mark bright-ish cells as candidate (fields often have light backgrounds)
      for (let gy = 0; gy < gh; gy++) {
        for (let gx = 0; gx < gw; gx++) {
          const px = Math.min(cw - 1, gx * step);
          const py = Math.min(ch - 1, gy * step);
          const i = (py * cw + px) * 4;
          const r = imgData[i], g = imgData[i + 1], b = imgData[i + 2];
          // luminance
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          // consider candidate if bright or yellowish (form fields are often pale)
          const isYellow = (r > 200 && g > 180 && b < 180);
          if (lum > 220 || isYellow) grid[gy * gw + gx] = 1;
        }
      }

      // flood fill connected components on grid
      const visited = new Uint8Array(gw * gh);
      const boxes = [];
      const neigh = [[1,0],[-1,0],[0,1],[0,-1]];
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const idx = y * gw + x;
          if (visited[idx] || !grid[idx]) continue;
          // BFS
          const q = [idx];
          visited[idx] = 1;
          let minX = x, maxX = x, minY = y, maxY = y;
          while (q.length) {
            const cur = q.shift();
            const cx = cur % gw; const cy = Math.floor(cur / gw);
            for (const [dx,dy] of neigh) {
              const nx = cx + dx; const ny = cy + dy;
              if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
              const ni = ny * gw + nx;
              if (visited[ni]) continue;
              if (grid[ni]) {
                visited[ni] = 1;
                q.push(ni);
                minX = Math.min(minX, nx); maxX = Math.max(maxX, nx);
                minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
              }
            }
          }
          // convert grid bbox to pixel bbox
          const px = Math.max(0, minX * step);
          const py = Math.max(0, minY * step);
          const pw = Math.min(cw, (maxX - minX + 1) * step);
          const ph = Math.min(ch, (maxY - minY + 1) * step);
          // filter small
          if (pw > 40 && ph > 10) boxes.push({ x: px, y: py, w: pw, h: ph });
        }
      }

      if (boxes.length === 0) return [];

      // merge overlapping boxes
      const merged = [];
      const iou = (a,b) => {
        const ix = Math.max(a.x, b.x);
        const iy = Math.max(a.y, b.y);
        const ax = Math.min(a.x + a.w, b.x + b.w);
        const ay = Math.min(a.y + a.h, b.y + b.h);
        const iw = Math.max(0, ax - ix);
        const ih = Math.max(0, ay - iy);
        const inter = iw * ih;
        const uni = a.w * a.h + b.w * b.h - inter;
        return uni <= 0 ? 0 : inter / uni;
      };
      const used = new Array(boxes.length).fill(false);
      for (let i = 0; i < boxes.length; i++) {
        if (used[i]) continue;
        let base = { ...boxes[i] };
        for (let j = i + 1; j < boxes.length; j++) {
          if (used[j]) continue;
          if (iou(base, boxes[j]) > 0.15) {
            // merge
            const nx = Math.min(base.x, boxes[j].x);
            const ny = Math.min(base.y, boxes[j].y);
            const ax = Math.max(base.x + base.w, boxes[j].x + boxes[j].w);
            const ay = Math.max(base.y + base.h, boxes[j].y + boxes[j].h);
            base = { x: nx, y: ny, w: ax - nx, h: ay - ny };
            used[j] = true;
          }
        }
        merged.push(base);
      }

      // sort top-to-bottom, left-to-right
      merged.sort((a,b) => (a.y - b.y) || (a.x - b.x));

      // convert to normalized bbox relative to naturalSize
      const norm = merged.map(b => ({ x: b.x, y: b.y, w: b.w, h: b.h }));
      return norm;
    } catch (err) {
      console.error('detectFieldBoxes failed', err);
      return [];
    }
  };

  const analyze = async () => {
    if (!file) return alert('Please upload a form image or PDF first.');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await papi.post('/api/forms/analyze', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      // Expect res.data.fields = [{ id, label_text, suggestions: [], bbox: {...} }, ...]
      const returned = res.data.fields || [];
      // helper to generate fallback bboxes (stacked vertically across page)
      const generateFallbackBbox = (idx, total) => {
        const pageW = Math.max(800, naturalSize.w || 1000);
        const pageH = Math.max(1000, naturalSize.h || 1400);
        const margin = 40;
        const availH = pageH - margin * 2;
        const itemH = Math.max(24, Math.floor(availH / Math.max(1, total)) - 8);
        const x = margin;
        const y = margin + idx * (itemH + 8);
        const w = pageW - margin * 2;
        const h = itemH;
        return { x, y, w, h };
      };

      // helper: normalize page key from various backends
      const getFieldPage = (f) => {
        if (!f) return 1;
        const candidates = [f.page, f.pageNumber, f.page_num, f.pageNumber, f.pageno, f.pageNo, f.pageIndex, f.p];
        for (const c of candidates) {
          if (c === undefined || c === null) continue;
          const n = Number(c);
          if (!Number.isNaN(n) && n >= 1) return Math.floor(n);
        }
        return 1;
      };

      const normalized = returned.map((f, i) => {
        let bboxNorm = normalizeBbox(f.bbox);
        // If bbox looks like normalized fractions (0..1), convert to pixel coords using naturalSize or page fallback
        if (bboxNorm && looksNormalizedFraction(bboxNorm)) {
          const pageW = Math.max(800, naturalSize.w || 1000);
          const pageH = Math.max(1000, naturalSize.h || 1400);
          bboxNorm = {
            x: Math.round(bboxNorm.x * pageW),
            y: Math.round(bboxNorm.y * pageH),
            w: Math.round(bboxNorm.w * pageW),
            h: Math.round(bboxNorm.h * pageH),
          };
        }
        // if backend returned zeros or null bbox, create a fallback position
        if (!bboxNorm || ((bboxNorm.w === 0 || bboxNorm.h === 0) && Array.isArray(f.bbox) && f.bbox.every(v => v === 0))) {
          bboxNorm = generateFallbackBbox(i, returned.length);
        }
        return { ...f, bboxNorm, page: getFieldPage(f) };
      });
      setFields(normalized);
      // If this is a PDF and we have the ArrayBuffer, try to resolve friendly labels and thumbnails
      if (isPdf && pdfArrayBuffer) {
        // resolve labels but don't block UI; fire-and-forget
        resolveAllFieldLabels(normalized, pdfArrayBuffer).catch(err => console.warn('resolveAllFieldLabels failed', err));
      }
      // pick up any returned values from analysis
      const initialValues = {};
      normalized.forEach(f => { if (f.value) initialValues[f.id] = f.value });
      if (Object.keys(initialValues).length) setFieldValues(prev => ({ ...prev, ...initialValues }));
  // capture initial values snapshot so we can detect user edits
  initialValuesRef.current = { fieldValues: (Object.keys(initialValues).length ? { ...initialValues } : {}), simpleValues: {} };
      // clear previous selection
      setSelectedField(null);
    } catch (err) {
      console.error('Analyze failed', err);
      alert('Failed to analyze form.');
    } finally {
      setLoading(false);
    }
  };

  // sample loader removed - use backend analyze endpoint instead

  const onImageLoad = (e) => {
    const img = e.target;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const scaleBbox = (bbox) => {
    if (!bbox) return null;
    const el = isPdf ? pdfCanvasRef.current : imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const containerRect = containerRef.current ? containerRef.current.getBoundingClientRect() : null;
    const scaleX = rect.width / Math.max(1, naturalSize.w);
    const scaleY = rect.height / Math.max(1, naturalSize.h);

    // compute offset of the canvas/image inside the container so overlay coordinates are relative to container
    const offsetLeft = containerRect ? (rect.left - containerRect.left) : 0;
    const offsetTop = containerRect ? (rect.top - containerRect.top) : 0;

    // scaled positions
    let left = Math.round(offsetLeft + (bbox.x * scaleX));
    let top = Math.round(offsetTop + (bbox.y * scaleY));
    let width = Math.round(Math.max(1, bbox.w * scaleX));
    let height = Math.round(Math.max(1, bbox.h * scaleY));

    // clamp within container bounds if available
    if (containerRect) {
      left = Math.max(0, Math.min(left, Math.max(0, containerRect.width - width)));
      top = Math.max(0, Math.min(top, Math.max(0, containerRect.height - height)));
    }

    return { left, top, width, height };
  };

  // --- pdf.js based label + thumbnail resolver ---
  const resolveAllFieldLabels = async (fieldsList, pdfBuffer) => {
    if (!fieldsList || !fieldsList.length || !pdfBuffer) return;
    let pdfjs = null;
    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf');
    } catch (e) {
      console.error('pdfjs import failed for label resolution', e);
      return;
    }

    try {
      const loadingTask = pdfjs.getDocument({ data: pdfBuffer });
      const pdf = await loadingTask.promise;

      const updated = await Promise.all(fieldsList.map(async (f) => {
        try {
          const pageNum = f.page || 1;
          const page = await pdf.getPage(pageNum);
          // use a slightly larger scale for clearer thumbnails
          const scale = 1.5;
          const viewport = page.getViewport({ scale });
          const annotations = await page.getAnnotations();
          // try to find matching annotation by a few candidate props
          const ann = annotations.find(a => (a.fieldName && a.fieldName === f.id) || (a.name && a.name === f.id) || (a.id && a.id === f.id));
          let label = f.label_text || f.id;
          let thumb = null;

          if (ann && ann.rect) {
            // convert rect to viewport pixels
            const vpRect = viewport.convertToViewportRectangle(ann.rect);
            const left = Math.min(vpRect[0], vpRect[2]);
            const top = Math.min(vpRect[1], vpRect[3]);
            const width = Math.abs(vpRect[2] - vpRect[0]);
            const height = Math.abs(vpRect[3] - vpRect[1]);

            // get nearby text
            const textContent = await page.getTextContent();
            const tokens = textContent.items.map(item => {
              const tr = pdfjs.Util.transform(viewport.transform, item.transform);
              const x = tr[4];
              const y = tr[5];
              return { str: item.str, x, y, width: item.width || 0, height: Math.abs(item.transform && item.transform[0]) || 10 };
            });

            // compute center of field
            const cx = left + width / 2;
            const cy = top + height / 2;

            // score tokens by distance and prefer tokens above or left (negative dy)
            const scored = tokens.map(t => {
              const tx = t.x + (t.width / 2 || 0);
              const ty = t.y + (t.height / 2 || 0);
              const dx = tx - cx; const dy = ty - cy;
              const dist = Math.sqrt(dx*dx + dy*dy);
              return { t, dist, dy };
            }).filter(s => Number.isFinite(s.dist));
            scored.sort((a,b) => {
              // prefer above (negative dy) then distance
              const pa = (a.dy < 0) ? 0 : 1;
              const pb = (b.dy < 0) ? 0 : 1;
              if (pa !== pb) return pa - pb;
              return a.dist - b.dist;
            });
            const nearest = scored.slice(0, 6).map(s => s.t.str).join(' ').trim();
            if (nearest) label = nearest;

            // render page to offscreen canvas and crop thumbnail
            const off = document.createElement('canvas');
            off.width = Math.round(viewport.width);
            off.height = Math.round(viewport.height);
            const ctx = off.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;
            // crop into small thumbnail (pad a bit)
            const pad = 8;
            const sx = Math.max(0, Math.floor(left - pad));
            const sy = Math.max(0, Math.floor(top - pad));
            const sw = Math.min(off.width - sx, Math.ceil(width + pad * 2));
            const sh = Math.min(off.height - sy, Math.ceil(height + pad * 2));
            if (sw > 4 && sh > 4) {
              const thumbCanvas = document.createElement('canvas');
              const tW = Math.min(240, sw);
              const tH = Math.min(160, sh);
              thumbCanvas.width = tW; thumbCanvas.height = tH;
              const tctx = thumbCanvas.getContext('2d');
              tctx.drawImage(off, sx, sy, sw, sh, 0, 0, tW, tH);
              thumb = thumbCanvas.toDataURL('image/png');
            }
          } else {
            // try fallback: use page text to build a label from the top-left content
            try {
              const textContent = await page.getTextContent();
              const sample = (textContent.items || []).slice(0, 8).map(i => i.str).join(' ').trim();
              if (sample) label = sample.substring(0, 120);
            } catch (e) { /* ignore */ }
          }

          return { ...f, label, thumbnail: thumb };
        } catch (err) {
          console.warn('resolve field failed', f && f.id, err);
          return f;
        }
      }));

      // merge updated meta into existing fields state
      setFields(prev => prev.map(pf => {
        const u = updated.find(x => x.id === pf.id);
        return u ? { ...pf, label: u.label, thumbnail: u.thumbnail } : pf;
      }));
    } catch (err) {
      console.error('resolveAllFieldLabels main failure', err);
    }
  };

  const handleOverlayClick = (field) => {
    setSelectedField(field);
  };

  // draw single text into a canvas context within bbox
  const drawTextOnCtx = (ctx, bbox, text) => {
    if (!ctx || !bbox || !text) return;
    const padding = Math.max(4, Math.floor(bbox.h * 0.12));
    const fontSize = Math.max(10, Math.floor(bbox.h * 0.65));
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px sans-serif`;
    const x = bbox.x + padding;
    const y = bbox.y + bbox.h / 2;
    // simple clip to bbox
    ctx.beginPath();
    ctx.rect(bbox.x + 1, bbox.y + 1, Math.max(2, bbox.w - 2), Math.max(2, bbox.h - 2));
    ctx.clip();
    // draw text; if too long, truncate with ellipsis
    let draw = String(text || '');
    const maxWidth = Math.max(10, bbox.w - padding * 2);
    let measured = ctx.measureText(draw).width;
    if (measured > maxWidth) {
      while (draw.length > 0 && ctx.measureText(draw + '…').width > maxWidth) {
        draw = draw.slice(0, -1);
      }
      draw = draw + '…';
    }
    ctx.fillText(draw, x, y);
    ctx.restore();
  };

  const drawValueOnCanvas = (field, value) => {
    if (!field) return;
    const bbox = field.bboxNorm;
    if (!bbox) return;
    if (isPdf && pdfCanvasRef.current) {
      const canvas = pdfCanvasRef.current;
      const ctx = canvas.getContext('2d');
      drawTextOnCtx(ctx, bbox, value || '');
    } else if (!isPdf && imgRef.current) {
      // draw on offscreen canvas and update imageUrl to the new filled image
      const img = imgRef.current;
      const off = document.createElement('canvas');
      const w = naturalSize.w || img.naturalWidth || img.width;
      const h = naturalSize.h || img.naturalHeight || img.height;
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // bbox is relative to natural size
      drawTextOnCtx(ctx, bbox, value || '');
      const dataUrl = off.toDataURL('image/png');
      // update displayed image
      setImageUrl(dataUrl);
      // update naturalSize
      setNaturalSize({ w, h });
    }
  };

  const applyAllValuesToCanvas = () => {
    // apply all fieldValues onto a canvas copy for download
    if (isPdf && pdfCanvasRef.current) {
      const src = pdfCanvasRef.current;
      const copy = document.createElement('canvas');
      copy.width = src.width; copy.height = src.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(src, 0, 0);
      fields.forEach(f => {
        const val = fieldValues[f.id];
        if (val) drawTextOnCtx(ctx, f.bboxNorm, val);
      });
      return copy;
    }
    if (!isPdf && imgRef.current) {
      const img = imgRef.current;
      const off = document.createElement('canvas');
      const w = naturalSize.w || img.naturalWidth || img.width;
      const h = naturalSize.h || img.naturalHeight || img.height;
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      fields.forEach(f => {
        const val = fieldValues[f.id];
        if (val) drawTextOnCtx(ctx, f.bboxNorm, val);
      });
      return off;
    }
    return null;
  };

  // helper removed: using jsPDF instead of pdf-lib, so no longer need dataURL->Uint8 conversion

  const downloadFilled = async () => {
    try {
      const canvas = applyAllValuesToCanvas();
      if (!canvas) return alert('Nothing to download');
      const dataUrl = canvas.toDataURL('image/png');
  // create PDF using jsPDF by embedding the PNG
  const { jsPDF } = await import('jspdf');
  // jsPDF uses pt units by default; we'll use px via unit:'px' and set page size to the canvas size
  const orientation = canvas.width >= canvas.height ? 'l' : 'p';
  const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
  // addImage accepts dataURL
  pdf.addImage(dataUrl, 'PNG', 0, 0, canvas.width, canvas.height);
  const blob = pdf.output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (file && file.name) ? `filled-${file.name.replace(/\.[^.]+$/, '')}.pdf` : 'filled-form.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  // mark as saved: update initial snapshot and clear dirty flag
  try {
    initialValuesRef.current = { fieldValues: { ...fieldValues }, simpleValues: { ...simpleValues } };
    setHasEdits(false);
  } catch (e) {}
    } catch (err) {
      console.error('downloadFilled failed', err);
      alert('Failed to create download. Check console for details.');
    }
  };

  const suggestField = async (field) => {
    if (!field) return;
    setSuggestLoading(true);
    try {
      const payload = { fieldId: field.id, context: fieldValues };
      const res = await papi.post('/api/forms/suggest', payload);
      const sugg = res.data.suggestions || res.data.values || [];
      setSuggestions(sugg);
      if (sugg && sugg.length === 1) handleValueChange(field.id, sugg[0]);
    } catch (err) {
      console.error('Suggest failed', err);
      alert('Suggestion service failed. You can also type a prompt below to ask the AI (see examples).');
    } finally {
      setSuggestLoading(false);
    }
  };

  const autoFillAll = async () => {
    setSuggestLoading(true);
    try {
      const payload = { context: fieldValues };
      const res = await papi.post('/api/forms/suggest-all', payload);
      const map = res.data.values || {};
      setFieldValues(prev => ({ ...prev, ...map }));
      alert('Auto-fill applied for returned fields. Review before exporting.');
    } catch (err) {
      console.error('Auto-fill failed', err);
      alert('Auto-fill failed. Ensure the suggestion service is running on the server.');
    } finally {
      setSuggestLoading(false);
    }
  };

  const askAi = async (field) => {
    if (!aiPrompt) return alert('Please enter a question or prompt for the AI.');
    setAiLoading(true);
    try {
      const payload = { prompt: aiPrompt, fieldId: field ? field.id : null, context: fieldValues };
      const res = await papi.post('/api/forms/assist', payload);
      const answer = res.data.answer || res.data.suggestion || '';
      if (field && answer) handleValueChange(field.id, answer);
      setSuggestions(answer ? [answer] : []);
    } catch (err) {
      console.error('AI assist failed', err);
      alert('AI assist failed. See console for details.');
    } finally {
      setAiLoading(false);
    }
  };

  // --- user-help helpers ---
  const examplesForField = (field) => {
    if (!field) return [];
    const label = (field.label_text || field.id || '').toLowerCase();
    if (label.includes('given') || label.includes('first')) return ['John', 'Alice', 'Maria'];
    if (label.includes('family') || label.includes('last')) return ['Doe', 'Smith', 'Patel'];
    if (label.includes('email')) return ['name@example.com', 'user@company.com'];
    if (label.includes('phone')) return ['+1-555-123-4567', '+44 7700 900123'];
    if (label.includes('country')) return ['United States', 'India', 'United Kingdom'];
    if (label.includes('city')) return ['New York', 'Mumbai', 'London'];
    if (label.includes('postcode') || label.includes('zip')) return ['10001', '94105', 'SW1A 1AA'];
    if (label.includes('address')) return ['123 Example St', 'Flat 4B, 56 High St'];
    return ['Example value'];
  };

  const guideQuestionsForField = (field) => {
    if (!field) return [];
    const label = (field.label_text || field.id || '').toLowerCase();
    if (label.includes('given') || label.includes('first')) return [
      { id: 'q_name_type', text: 'Is this a personal or company name?', type: 'choice', options: ['Personal', 'Company'] },
      { id: 'q_preferred', text: 'Do you prefer a short or full given name?', type: 'choice', options: ['Short', 'Full'] },
    ];
    if (label.includes('country')) return [
      { id: 'q_region', text: 'Which continent or region is the address in?', type: 'choice', options: ['Americas', 'Europe', 'Asia', 'Africa', 'Oceania'] },
    ];
    if (label.includes('city') || label.includes('postcode')) return [
      { id: 'q_postcode', text: 'Do you know the postcode? (enter if yes)', type: 'text' },
    ];
    return [ { id: 'q_generic', text: `Provide any detail that helps fill ${field.label_text || field.id}`, type: 'text' } ];
  };

  // simulation helpers removed - backend assist/suggest endpoints are used instead

  const handleValueChange = (id, value) => {
    setFieldValues(prev => ({ ...prev, [id]: value }));
  };

  const exportValues = async () => {
    const payload = Object.entries(fieldValues).map(([id, value]) => ({ id, value }));
    try {
      await papi.post('/api/forms/export', { values: payload });
      alert('Export successful');
    } catch (err) {
      console.error('Export failed', err);
      alert('Export failed');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">AutoFill Forms</h2>
        {/* simulation mode removed - always uses backend APIs */}
      </div>
      <div className="mb-4 flex items-center gap-3">
        <input type="file" accept="image/*,.pdf" onChange={onFileChange} />
  <button onClick={analyze} disabled={!file || loading} className="px-4 py-2 bg-blue-600 text-white rounded-md">{loading ? 'Analyzing...' : 'Analyze Form'}</button>
  <button onClick={downloadFilled} disabled={!hasEdits} className={`px-4 py-2 rounded-md ${hasEdits ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'}`}>Download Filled</button>
        {/* <button onClick={extractAcroFields} disabled={!file || loadingExtractSimple} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{loadingExtractSimple ? 'Detecting fields...' : 'Detect AcroForm fields'}</button> */}
        {/* Sample loader removed */}
        {/* <button onClick={async () => {
          const boxes = await detectFieldBoxes();
          if (!boxes || boxes.length === 0) return alert('No candidate boxes detected');
          // map detected boxes to current fields
          setFields(prev => prev.map((f, i) => ({ ...f, bboxNorm: boxes[i] || f.bboxNorm })));
        }} disabled={!imageUrl} className="px-3 py-2 bg-gray-200 rounded-md">Auto-detect boxes</button> */}
      </div>

      <div className="flex gap-6">
        <div ref={containerRef} className="relative bg-gray-50 border rounded-md flex-1" style={{ minHeight: 500 }}>
            {/* page navigation for multipage PDFs */}
            {isPdf && totalPages > 1 && (
              <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-white/80 p-1 rounded">
                <button onClick={() => renderPage(Math.max(1, currentPage - 1))} disabled={currentPage <= 1} className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50">Prev</button>
                <div className="text-sm px-2">Page {currentPage} / {totalPages}</div>
                <button onClick={() => renderPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage >= totalPages} className="px-2 py-1 bg-gray-100 rounded disabled:opacity-50">Next</button>
                <div className="flex items-center ml-2">
                  <input type="number" min={1} max={totalPages} value={currentPage} onChange={(e) => {
                    const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                    renderPage(v);
                  }} className="w-16 px-2 py-1 border rounded text-sm" />
                </div>
              </div>
            )}
          {imageUrl ? (
            isPdf ? (
              <div className="w-full h-auto">
                <canvas ref={pdfCanvasRef} />
                {pdfRenderError && (
                  <div className="p-3 mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded">{pdfRenderError}</div>
                )}
              </div>
            ) : (
              <img ref={imgRef} src={imageUrl} alt="form" onLoad={onImageLoad} className="w-full h-auto block" />
            )
          ) : (
            <div className="p-6 text-gray-400">Upload a form image or PDF to begin.</div>
          )}

          {/* overlays */}
          {fields.map(f => {
            const fPage = f.page || 1;
            // only show overlays for the current PDF page (non-PDF images show all)
            if (isPdf && fPage !== currentPage) return null;
            const bbox = f.bboxNorm;
            const pos = scaleBbox(bbox);
            if (!bbox || !pos) return null;
            const value = fieldValues[f.id];
            const fontSize = Math.max(10, Math.floor(pos.height * 0.6));
            const displayLabel = f.label || f.label_text || f.id;
            return (
              <div key={f.id} onClick={() => handleOverlayClick(f)} style={{ left: pos.left, top: pos.top, width: pos.width, height: pos.height }} className="absolute border-2 text-xs border-blue-400/60 bg-blue-400/8 hover:bg-blue-400/12 cursor-pointer rounded-sm" title={displayLabel}>
                {/* show entered value as a DOM overlay so it's visible immediately */}
                {/* {value ? (
                  <div className="pointer-events-none text-xs overflow-hidden text-left" style={{ padding: 4, fontSize: fontSize, lineHeight: '1', color: '#000' }}>
                    {String(value)}
                  </div>
                ) : null} */}
                {/* tiny label badge */}
                {/* <div className="pointer-events-none absolute left-0 -top-5 bg-white/90 text-[0.5] text-gray-700 px-1 rounded">{displayLabel.length > 24 ? displayLabel.slice(0,24) + '…' : displayLabel}</div> */}
              </div>
             
            );
          })}
        </div>

        <div className="w-1/3 bg-white border rounded-md p-4">
          <h3 className="font-semibold mb-2">Field Inspector</h3>
          {/* Simple AcroForm UI: displayed when simpleFields are detected */}
          {simpleFields && simpleFields.length > 0 && (
            <div className="mb-4 p-3 border rounded bg-gray-50">
              <div className="text-sm font-medium mb-2">Detected form fields (fillable PDF)</div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {simpleFields.map(name => (
                  <div key={name} className="flex gap-2 items-center">
                    <label className="w-36 text-sm text-gray-700">{name}</label>
                    <input value={simpleValues[name] || ''} onChange={(e) => handleSimpleValueChange(name, e.target.value)} className="flex-1 border rounded px-2 py-1" />
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={fillAndDownload} disabled={loadingFillSimple} className="px-3 py-2 bg-green-600 text-white rounded">{loadingFillSimple ? 'Filling...' : 'Fill & Download'}</button>
                <button onClick={() => { setSimpleFields([]); setSimpleValues({}); }} className="px-3 py-2 bg-gray-100 rounded">Clear</button>
              </div>
            </div>
          )}
          {!selectedField ? (
            <div className="text-sm text-gray-500">
              {isPdf ? (
                `PDF preview shown. Showing page ${currentPage} of ${totalPages}. Click a highlighted box to inspect a field.`
              ) : (
                "Click a highlighted box on the left to inspect a field."
              )}
            </div>
          ) : (
            <div>
              <div className="text-sm text-gray-700 font-medium mb-1">{selectedField.label_text || selectedField.id}</div>
              <div className="text-xs text-gray-500 mb-3">Field ID: {selectedField.id}</div>
              {selectedField.description && (
                <div className="text-xs text-gray-400 mb-3 whitespace-pre-wrap">{selectedField.description}</div>
              )}

              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-1">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {(selectedField.suggestions || []).map((s, idx) => (
                    <button key={idx} onClick={() => handleValueChange(selectedField.id, s)} className="px-2 py-1 bg-gray-100 rounded text-sm">{s}</button>
                  ))}
                </div>
              </div>
              <div className="mb-3">
                <div className="text-xs text-gray-500 mb-2">Examples</div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {examplesForField(selectedField).map((ex, i) => (
                    <button key={i} onClick={() => handleValueChange(selectedField.id, ex)} className="px-2 py-1 bg-gray-50 border rounded text-sm">{ex}</button>
                  ))}
                </div>
               
              </div>

              {guideActive && (
                <div className="mb-3 p-3 bg-gray-50 rounded">
                  <div className="text-sm font-medium mb-2">Guided questions</div>
                  {guideQuestionsForField(selectedField).map((q, idx) => (
                    <div key={q.id} className={`mb-2 ${guideStep === idx ? '' : 'hidden'}`}>
                      <div className="text-xs text-gray-600 mb-1">{q.text}</div>
                      {q.type === 'choice' ? (
                        <div className="flex gap-2">
                          {q.options.map(opt => (
                            <button key={opt} onClick={() => setGuideAnswers(prev => ({ ...prev, [q.id]: opt }))} className={`px-3 py-2 rounded ${guideAnswers[q.id] === opt ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>{opt}</button>
                          ))}
                        </div>
                      ) : (
                        <input value={guideAnswers[q.id] || ''} onChange={(e) => setGuideAnswers(prev => ({ ...prev, [q.id]: e.target.value }))} className="w-full border rounded px-3 py-2" />
                      )}
                    </div>
                  ))}

                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setGuideStep(s => Math.max(0, s - 1))} className="px-3 py-2 bg-gray-100 rounded">Back</button>
                    <button onClick={() => setGuideStep(s => s + 1)} className="px-3 py-2 bg-gray-100 rounded">Next</button>
                    <button onClick={() => {
                      const guidePrompt = Object.entries(guideAnswers || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
                      setAiPrompt(guidePrompt);
                      askAi(selectedField);
                    }} className="px-3 py-2 bg-yellow-500 text-white rounded">Show suggestion</button>
                    <button onClick={() => setGuideActive(false)} className="px-3 py-2 bg-gray-200 rounded">Done</button>
                  </div>
                </div>
              )}

              <div className="mb-3">
                <label className="text-xs text-gray-500">Value</label>
                <input value={fieldValues[selectedField.id] || ''} onChange={(e) => handleValueChange(selectedField.id, e.target.value)} className="w-full mt-1 border rounded px-3 py-2" />
              </div>

              <div className="mb-3">
                
                {suggestions && suggestions.length > 0 && (
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Suggestions</div>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s, i) => (
                        <button key={i} onClick={() => handleValueChange(selectedField.id, s)} className="px-2 py-1 bg-gray-100 rounded text-sm">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <button onClick={() => { drawValueOnCanvas(selectedField, fieldValues[selectedField.id] || ''); setSelectedField(null); }} className="px-3 py-2 bg-gray-100 rounded">Done</button>
                <div className="flex items-center gap-2">
                  {/* <button onClick={() => exportValues()} className="px-3 py-2 bg-blue-600 text-white rounded">Export All</button> */}
                  <button onClick={() => downloadFilled()} className="px-3 py-2 bg-green-700 text-white rounded">Download Filled</button>
                </div>
              </div>
              
              
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormAutoFill;
