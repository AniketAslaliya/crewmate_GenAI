import React, { useState, useRef, useEffect } from 'react';
import papi from '../Axios/paxios';
// framer-motion not required here
import api from '../Axios/axios';
import { useToast } from '../components/ToastProvider';
import { useLanguage } from '../context/LanguageContext';
import SpeakerButton from '../components/SpeakerButton';
import { useGuestAccess } from '../hooks/useGuestAccess';
import GuestAccessModal from '../components/GuestAccessModal';
import { validateFile } from '../utils/inputSecurity';
import formAnalysisService from '../services/formAnalysisService';
import formStorageService from '../services/formStorageService';
import useAuthStore from '../context/AuthContext';

// Helper functions (can stay as const, they are at the top level)
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
  // selection box state for manual box creation / adjustment (pixel coords relative to container)
  const [selectionBox, setSelectionBox] = useState(null);
  const dragRef = useRef({ mode: null, dir: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, origW: 0, origH: 0 });
  const toast = useToast();
  const { language, setLanguage } = useLanguage();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [currentFormId, setCurrentFormId] = useState(null); // Track current form in Dropbox
  const [savedForms, setSavedForms] = useState([]); // List of saved forms
  const [showSavedForms, setShowSavedForms] = useState(false); // Show saved forms modal
  const [loadingSavedForms, setLoadingSavedForms] = useState(false);
  const [fieldImagePositions, setFieldImagePositions] = useState({}); // Store image positions {fieldId: {x: %, y: %, scale: 1}}
  const [draggingImageFieldId, setDraggingImageFieldId] = useState(null);
  const imageDragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const { checkGuestAccess, showGuestModal, closeGuestModal, blockedFeature } = useGuestAccess();

  // Voice recording refs/state for form voice input
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [spokenLang, setSpokenLang] = useState('hi-IN');

  // Comprehensive file validation with security checks (same as LegalDesk)
  const validateFileWithSecurity = (file) => {
    const validation = validateFile(file, {
      maxSizeMB: 100,
      allowedExtensions: ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp'],
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp'
      ]
    });

    if (!validation.isValid) {
      validation.errors.forEach(error => toast.error(error));
      return { isValid: false };
    }

    return { isValid: true, sanitizedFileName: validation.sanitizedFileName };
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिन्दी' },
    { code: 'gu', name: 'ગુજરાતી' },
    { code: 'mr', name: 'मराठी' },
    { code: 'ta', name: 'தமிழ்' },
    { code: 'te', name: 'తెలుగు' },
    { code: 'bn', name: 'বাংলা' },
    { code: 'kn', name: 'ಕನ್ನಡ' },
    { code: 'ml', name: 'മലയാളം' },
    { code: 'pa', name: 'ਪੰਜਾਬੀ' }
  ];

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

  // keyboard navigation for pages: left/right arrows
  useEffect(() => {
    const onKey = (e) => {
      if (!isPdf || totalPages <= 1) return;
      if (e.key === 'ArrowRight') {
        renderPage(Math.min(totalPages, currentPage + 1));
      } else if (e.key === 'ArrowLeft') {
        renderPage(Math.max(1, currentPage - 1));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isPdf, currentPage, totalPages]);

  // Load saved forms on mount to show in empty state
  useEffect(() => {
    loadSavedForms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for analysis completion from the persistent service
  useEffect(() => {
    const removeListener = formAnalysisService.addListener((fileId, result) => {
      // Only handle results for the current analysis
      if (fileId !== currentAnalysisId) return;
      
      setLoading(false);
      
      if (result.success) {
        // Process the fields
        const returned = result.fields || [];
        
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

        const getFieldPage = (f) => {
          if (!f) return 1;
          const candidates = [f.page, f.page_number, f.pageNumber, f.page_num, f.pageNum, f.pageno, f.pageNo, f.pageIndex, f.p];
          for (const c of candidates) {
            if (c === undefined || c === null) continue;
            const n = Number(c);
            if (!Number.isNaN(n) && n >= 1) return Math.floor(n);
          }
          return 1;
        };

        const normalized = returned.map((f, i) => {
          let bboxNorm = normalizeBbox(f.bbox);
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
          if (!bboxNorm || ((bboxNorm.w === 0 || bboxNorm.h === 0) && Array.isArray(f.bbox) && f.bbox.every(v => v === 0))) {
            bboxNorm = generateFallbackBbox(i, returned.length);
          }
          return { ...f, bboxNorm, page: getFieldPage(f) };
        });
        
        setFields(normalized);
        
        if (isPdf && pdfArrayBuffer) {
          resolveAllFieldLabels(normalized, pdfArrayBuffer).catch(err => console.warn('resolveAllFieldLabels failed', err));
        }
        
        const initialValues = {};
        normalized.forEach(f => { if (f.value) initialValues[f.id] = f.value });
        if (Object.keys(initialValues).length) setFieldValues(prev => ({ ...prev, ...initialValues }));
        initialValuesRef.current = { fieldValues: (Object.keys(initialValues).length ? { ...initialValues } : {}), simpleValues: {} };
        setSelectedField(null);
        
        // Save analyzed fields to backend
        if (currentFormId) {
          formStorageService.saveAnalyzedFields(currentFormId, normalized)
            .then(() => {
              toast.success('✅ Analysis completed and saved! Start filling fields.');
            })
            .catch(err => {
              console.warn('Failed to save fields:', err);
              toast.success('✅ Analysis completed! Fields are now available.');
            });
        } else {
          toast.success('✅ Analysis completed! Fields are now available.');
        }
      } else {
        toast.error(result.error || 'Analysis failed');
      }
    });

    return removeListener;
  }, [currentAnalysisId, currentFormId, naturalSize, isPdf, pdfArrayBuffer, toast]);
  
  // --- FIX: All internal functions changed to `function` declarations ---
  // This ensures they are all hoisted and available to be called by
  // useEffects or other handlers, regardless of their definition order.

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

  // Create a new selection box centered in the container
  // (Manual creation removed) selection boxes are opened by clicking detected overlays

  // Pointer handlers for drag/move/resize
  // Create a new selection box centered in the container
  function createNewBox() {
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    const w = Math.max(40, Math.round(rect.width * 0.3));
    const h = Math.max(20, Math.round(rect.height * 0.08));
    const left = Math.round((rect.width - w) / 2);
    const top = Math.round((rect.height - h) / 2);
    setSelectionBox({ left, top, width: w, height: h, page: currentPage });
    setSelectedField(null);
  };
  function startMove(e) {
    if (!selectionBox) return;
    e.preventDefault();
    dragRef.current = { mode: 'move', dir: null, startX: e.clientX, startY: e.clientY, origLeft: selectionBox.left, origTop: selectionBox.top, origW: selectionBox.width, origH: selectionBox.height };
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', stopPointer);
  };

  function startResize(dir, e) {
    if (!selectionBox) return;
    e.stopPropagation(); e.preventDefault();
    dragRef.current = { mode: 'resize', dir, startX: e.clientX, startY: e.clientY, origLeft: selectionBox.left, origTop: selectionBox.top, origW: selectionBox.width, origH: selectionBox.height };
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('mouseup', stopPointer);
  };

  function onPointerMove(ev) {
    const d = dragRef.current;
    if (!d || !selectionBox) return;
    const dx = ev.clientX - d.startX;
    const dy = ev.clientY - d.startY;
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    let left = d.origLeft, top = d.origTop, w = d.origW, h = d.origH;
    if (d.mode === 'move') {
      left = Math.max(0, Math.min(Math.round(d.origLeft + dx), Math.max(0, rect.width - w)));
      top = Math.max(0, Math.min(Math.round(d.origTop + dy), Math.max(0, rect.height - h)));
    } else if (d.mode === 'resize') {
      const dir = d.dir;
      // handle horizontal edges
      if (dir.includes('e')) {
        w = Math.max(8, Math.round(d.origW + dx));
        if (left + w > rect.width) w = Math.max(8, rect.width - left);
      }
      if (dir.includes('s')) {
        h = Math.max(6, Math.round(d.origH + dy));
        if (top + h > rect.height) h = Math.max(6, rect.height - top);
      }
      if (dir.includes('w')) {
        left = Math.max(0, Math.round(d.origLeft + dx));
        w = Math.max(8, Math.round(d.origW - dx));
        if (left + w > rect.width) w = Math.max(8, rect.width - left);
      }
      if (dir.includes('n')) {
        top = Math.max(0, Math.round(d.origTop + dy));
        h = Math.max(6, Math.round(d.origH - dy));
        if (top + h > rect.height) h = Math.max(6, rect.height - top);
      }
      // clamp
      left = Math.max(0, Math.min(left, Math.max(0, rect.width - w)));
      top = Math.max(0, Math.min(top, Math.max(0, rect.height - h)));
    }
    setSelectionBox(prev => prev ? ({ ...prev, left, top, width: w, height: h }) : prev);
  };

  function stopPointer() {
    dragRef.current = { mode: null, dir: null, startX: 0, startY: 0, origLeft: 0, origTop: 0, origW: 0, origH: 0 };
    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('mouseup', stopPointer);
  };

  function saveSelectionAsField() {
    if (!selectionBox) return;
    const cont = containerRef.current;
    if (!cont) return;
    const rect = cont.getBoundingClientRect();
    const el = isPdf ? pdfCanvasRef.current : imgRef.current;
    const elRect = el ? el.getBoundingClientRect() : rect;
    const scaleX = elRect.width / Math.max(1, naturalSize.w);
    const scaleY = elRect.height / Math.max(1, naturalSize.h);
    const offsetLeft = elRect.left - rect.left;
    const offsetTop = elRect.top - rect.top;
    const natX = Math.round((selectionBox.left - offsetLeft) / scaleX);
    const natY = Math.round((selectionBox.top - offsetTop) / scaleY);
    const natW = Math.round(selectionBox.width / scaleX);
    const natH = Math.round(selectionBox.height / scaleY);
    if (selectedField && selectedField.id) {
      // update existing field's bbox
      const updated = fields.map(f => f.id === selectedField.id ? { ...f, bboxNorm: { x: natX, y: natY, w: natW, h: natH }, page: currentPage } : f);
      setFields(updated);
      // reflect new bbox in selectedField reference
      const updatedField = updated.find(f => f.id === selectedField.id);
      setSelectedField(updatedField);
      setSelectionBox(null);
      toast.success('Field box updated.');
    } else {
      const newField = { id: `custom-${Date.now()}`, label_text: 'Custom field', bboxNorm: { x: natX, y: natY, w: natW, h: natH }, page: currentPage };
      setFields(prev => [...prev, newField]);
      setSelectedField(newField);
      setSelectionBox(null);
      toast.success('Custom field created. Inspect and adjust values in the Field Inspector.');
    }
  };

  // Auto-save removed - values are only saved when "Done" is clicked

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

  function onFileChange(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    
    // Validate file with security checks
    const validation = validateFileWithSecurity(f);
    if (!validation.isValid) {
      e.target.value = ''; // Reset input
      return;
    }
    
    setSelectedFile(f);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      
      // Validate file with security checks
      const validation = validateFileWithSecurity(file);
      if (!validation.isValid) {
        return;
      }
      
      setSelectedFile(file);
    }
  };

  async function handleUploadAndAnalyze(selectedLang) {
    if (!checkGuestAccess('Upload Form')) return;
    if (!selectedFile) return;
    
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setImageUrl(url);
    const pdfCheck = selectedFile.type === 'application/pdf' || (selectedFile.name && selectedFile.name.toLowerCase().endsWith('.pdf'));
    setIsPdf(pdfCheck);
    setFields([]);
    setSelectedField(null);
    setFieldValues({});
    
    if (pdfCheck) {
      await renderPdfToCanvas(selectedFile, 1);
      // store ArrayBuffer for pdf-js based label resolution
      try {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPdfArrayBuffer(ev.target.result);
        };
        reader.readAsArrayBuffer(selectedFile);
      } catch (e) {
        console.warn('Could not read pdf array buffer', e);
      }
    }
    
    // Close modal and start analysis
    setShowUploadModal(false);
    setLanguage(selectedLang);
    
    // Upload to cloud storage first
    toast.info('📤 Uploading form to cloud storage...');
    try {
      const uploadedForm = await formStorageService.uploadForm(selectedFile, selectedLang);
      setCurrentFormId(uploadedForm.formId);
    } catch (error) {
      console.error('Failed to upload to cloud storage:', error);
      toast.error('Failed to save to cloud, but continuing with analysis...');
    }
    
    // Start analysis using persistent service (continues even if component unmounts)
    setLoading(true);
    toast.info('⏳ Analysis started. This may take a few minutes. You can navigate to other pages while processing.');
    
    // Use the persistent service - it returns immediately but the request continues
    const { id, isNew } = formAnalysisService.startAnalysis(selectedFile, selectedLang);
    setCurrentAnalysisId(id);
    setSelectedFile(null);
    
    // If this is a cached result, the listener will fire immediately
    // Otherwise, the listener will fire when the HTTP request completes
  };

  // --- Simple AcroForm handlers (fillable PDF workflow) ---
  async function extractAcroFields() {
    if (!file) { toast.error('Please select a PDF first.'); return; }
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
      toast.error('Failed to extract fields. Make sure the PDF has AcroForm fields.');
    } finally {
      setLoadingExtractSimple(false);
    }
  };

  function handleSimpleValueChange(name, value) {
    setSimpleValues(prev => ({ ...prev, [name]: value }));
  };

  async function fillAndDownload() {
    if (!file) { toast.error('No file to fill.'); return; }
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
      toast.error('Failed to fill or download PDF.');
    } finally {
      setLoadingFillSimple(false);
    }
  };

  async function renderPdfToCanvas(file, startPage = 1) {
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
      // --- REFACTOR --- No longer need to repaint values; DOM overlays will handle it.
      // setTimeout(() => repaintValuesOnCanvas(startPage), 50);
    } catch (err) {
      console.error('PDF render failed', err);
      setPdfRenderError('Failed to render PDF preview');
    }
  };

  async function renderPage(pageNum) {
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
      // --- REFACTOR --- No longer need to repaint values; DOM overlays will handle it.
      // setTimeout(() => repaintValuesOnCanvas(pageNum), 50);
    } catch (err) {
      console.error('renderPage failed', err);
      setPdfRenderError('Failed to render PDF page');
    }
  };

  // --- REFACTOR --- repaintValuesOnCanvas is no longer needed.
  // Values are rendered as DOM overlays in the JSX.
  // const repaintValuesOnCanvas = (pageNum) => { ... };

  // heuristic detection of rectangular light fields from the rendered canvas
  async function detectFieldBoxes() {
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

  function analyze() {
    if (!checkGuestAccess('Analyze Form')) return;
    if (!file) { toast.error('Please upload a form image or PDF first.'); return; }
    setLoading(true);
    toast.info('⏳ Analysis started. This may take a few minutes. You can navigate to other pages while processing.');
    
    // Use the persistent service - it returns immediately but the request continues
    const { id, isNew } = formAnalysisService.startAnalysis(file, language);
    setCurrentAnalysisId(id);
    
    // The listener in useEffect will handle the completion
    console.log(`Analysis ${isNew ? 'started' : 'already running'} with ID:`, id);
  };

  // heuristic detection of rectangular light fields from the rendered canvas
  async function detectFieldBoxes() {
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

  // Load saved forms from Dropbox
  async function loadSavedForms() {
    if (!checkGuestAccess('View Saved Forms')) return;
    
    setLoadingSavedForms(true);
    try {
      const result = await formStorageService.listForms({ limit: 100 });
      setSavedForms(result.forms || []);
    } catch (error) {
      console.error('Failed to load saved forms:', error);
      toast.error('Failed to load saved forms');
    } finally {
      setLoadingSavedForms(false);
    }
  };

  // Load a saved form
  async function loadSavedForm(formData) {
    try {
      setLoading(true);
      setShowSavedForms(false);
      
      toast.info('📥 Loading form...');
      
      // Get download link (backend proxy URL to avoid CORS)
      const downloadUrl = await formStorageService.getDownloadLink(formData.formId);
      
      if (!downloadUrl) {
        throw new Error('Failed to get download URL');
      }
      
      console.log('Fetching from proxy URL:', downloadUrl);
      
      // Get auth token
      const token = useAuthStore.getState().token;
      
      // Fetch the file through backend proxy (no CORS issues)
      const response = await fetch(downloadUrl, {
        method: 'GET',
        credentials: 'include', // Include auth cookies
        headers: {
          'Accept': '*/*',
          'Authorization': token ? `Bearer ${token}` : ''
        }
      });
      
      if (!response.ok) {
        console.error('Fetch failed:', response.status, response.statusText);
        throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      if (!blob || blob.size === 0) {
        throw new Error('Downloaded file is empty');
      }
      
      console.log('✅ Downloaded blob:', blob.size, 'bytes, type:', blob.type);
      
      // Ensure mime type is correct
      const mimeType = formData.mimeType || blob.type || 'application/pdf';
      
      const fetchedFile = new File([blob], formData.originalFileName, { 
        type: mimeType 
      });
      
      console.log('✅ Created File object:', fetchedFile.name, fetchedFile.type, fetchedFile.size);
      
      // Load the file
      setFile(fetchedFile);
      const url = URL.createObjectURL(fetchedFile);
      setImageUrl(url);
      const pdfCheck = mimeType === 'application/pdf' || formData.originalFileName.toLowerCase().endsWith('.pdf');
      setIsPdf(pdfCheck);
      
      console.log('Is PDF:', pdfCheck);
      
      if (pdfCheck) {
        console.log('Rendering PDF to canvas...');
        await renderPdfToCanvas(fetchedFile, 1);
        console.log('✅ PDF rendered to canvas');
        
        try {
          const reader = new FileReader();
          reader.onload = (ev) => {
            setPdfArrayBuffer(ev.target.result);
            console.log('✅ PDF array buffer loaded');
          };
          reader.readAsArrayBuffer(fetchedFile);
        } catch (e) {
          console.warn('Could not read pdf array buffer', e);
        }
      } else {
        // For images, we need to wait for the image to load to get natural size
        const img = new Image();
        img.onload = () => {
          setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
          console.log('✅ Image loaded, size:', img.naturalWidth, 'x', img.naturalHeight);
        };
        img.onerror = (err) => {
          console.error('Failed to load image:', err);
        };
        img.src = url;
      }
      
      // Load saved fields and values from backend
      const hasFields = formData.fields && formData.fields.length > 0;
      
      if (hasFields) {
        // Form already analyzed - load fields directly and start filling
        setFields(formData.fields);
        setFieldValues(formData.fieldValues || {});
        setCurrentFormId(formData.formId);
        setLanguage(formData.language || 'en');
        
        // Mark as initial values to avoid dirty flag
        initialValuesRef.current = { 
          fieldValues: formData.fieldValues || {}, 
          simpleValues: {} 
        };
        
        const statusMsg = formData.status === 'filled' || formData.status === 'completed' 
          ? '✅ Form loaded! Continue filling or edit values.'
          : '✅ Form loaded! Ready to fill.';
        
        toast.success(statusMsg);
      } else {
        // Form not analyzed yet - need to analyze
        setCurrentFormId(formData.formId);
        setLanguage(formData.language || 'en');
        
        toast.info('⏳ Form loaded. Click "Analyze" to detect fields, or start analysis will begin automatically...');
        
        // Auto-start analysis
        setTimeout(() => {
          toast.info('⏳ Starting analysis automatically...');
          const { id } = formAnalysisService.startAnalysis(fetchedFile, formData.language || 'en');
          setCurrentAnalysisId(id);
          setLoading(true);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to load form:', error);
      toast.error('Failed to load form: ' + (error.message || 'Unknown error'));
    } finally {
      if (formData.fields && formData.fields.length > 0) {
        setLoading(false);
      }
    }
  };

  // Save current form progress and mark as done
  async function saveFormProgress() {
    if (!currentFormId) {
      toast.error('No form loaded to save');
      return;
    }
    
    try {
      await formStorageService.saveFilledValues(currentFormId, fieldValues);
      toast.success('✅ Form completed and saved!');
      setSelectedField(null); // Close the inspector
      
      // Refresh the saved forms list
      if (savedForms.length > 0) {
        await loadSavedForms();
      }
    } catch (error) {
      console.error('Failed to save progress:', error);
      toast.error('Failed to save progress');
    }
  };

  // Delete a saved form
  async function deleteSavedForm(formId) {
    if (!window.confirm('Are you sure you want to delete this form?')) return;
    
    try {
      await formStorageService.deleteForm(formId);
      setSavedForms(prev => prev.filter(f => f.formId !== formId));
      toast.success('Form deleted successfully');
      
      if (currentFormId === formId) {
        // Clear current form if it was deleted
        setCurrentFormId(null);
        setFile(null);
        setImageUrl(null);
        setFields([]);
        setFieldValues({});
      }
    } catch (error) {
      console.error('Failed to delete form:', error);
      toast.error('Failed to delete form');
    }
  };

  // sample loader removed - use backend analyze endpoint instead

  function onImageLoad(e) {
    const img = e.target;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  const scaleBbox = React.useCallback((bbox) => {
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
  }, [isPdf, naturalSize.w, naturalSize.h]);

  // Image drag handlers
  useEffect(() => {
    if (!draggingImageFieldId) return;

    const onImageMove = (ev) => {
      const drag = imageDragRef.current;
      if (!drag || !draggingImageFieldId) return;
      
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      
      // Get the field's position box to calculate relative movement
      const field = fields.find(f => f.id === draggingImageFieldId);
      if (!field) return;
      
      const pos = scaleBbox(field.bboxNorm);
      if (!pos) return;
      
      // Convert pixel movement to percentage within the field
      const deltaXPercent = (dx / pos.width) * 100;
      const deltaYPercent = (dy / pos.height) * 100;
      
      const newX = Math.max(0, Math.min(100, drag.origX + deltaXPercent));
      const newY = Math.max(0, Math.min(100, drag.origY + deltaYPercent));
      
      setFieldImagePositions(prev => ({
        ...prev,
        [draggingImageFieldId]: {
          ...prev[draggingImageFieldId],
          x: newX,
          y: newY,
          scale: prev[draggingImageFieldId]?.scale || 1
        }
      }));
    };

    const onImageUp = () => {
      setDraggingImageFieldId(null);
    };

    document.addEventListener('mousemove', onImageMove);
    document.addEventListener('mouseup', onImageUp);

    return () => {
      document.removeEventListener('mousemove', onImageMove);
      document.removeEventListener('mouseup', onImageUp);
    };
  }, [draggingImageFieldId, fields, scaleBbox]);

  // --- pdf.js based label + thumbnail resolver ---
  async function resolveAllFieldLabels(fieldsList, pdfBuffer) {
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
            const height = Math.abs(vpRect[3] - vpRect[0]);

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

  function handleOverlayClick(field) {
    // --- REFACTOR ---
    // Clicking an overlay just selects the field for value editing.
    // It no longer immediately enables the resizable selectionBox.
    setSelectedField(field);
    // (Old logic removed)
    // try {
    //   const pos = scaleBbox(field.bboxNorm);
    //   if (pos) setSelectionBox({ left: pos.left, top: pos.top, width: pos.width, height: pos.height, page: field.page || currentPage });
    // } catch (e) {
    //   // ignore
    // }
  };

  // draw single text into a canvas context within bbox
  function drawTextOnCtx(ctx, bbox, text) {
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

  // --- REFACTOR --- drawValueOnCanvas is no longer used for live preview
  // It permanently mutates the canvas, which we want to avoid.
  // The DOM overlay renders the preview instead.
  // const drawValueOnCanvas = (field, value) => { ... };

  function applyAllValuesToCanvas() {
    // apply all fieldValues onto a canvas copy for download
    if (isPdf && pdfCanvasRef.current) {
      // --- REFACTOR --- This path is no longer used for download.
      // The downloadFilled function now handles multi-page rendering.
      // We keep the logic for image-based download.
      const src = pdfCanvasRef.current;
      const copy = document.createElement('canvas');
      copy.width = src.width; copy.height = src.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(src, 0, 0);
      fields.forEach(f => {
        const val = fieldValues[f.id];
        // --- REFACTOR --- Only draw fields for the *current page*
        const fPage = f.page || 1;
        if (val && fPage === currentPage) {
            drawTextOnCtx(ctx, f.bboxNorm, val);
        }
      });
      return copy;
    }
    if (!isPdf && imgRef.current) {
      // --- REFACTOR --- This path *is* used for image download.
      // It must draw onto a *clean* image, not one that already has
      // values baked in (which imgRef.current might be if we used drawValueOnCanvas).
      // Since `onFileChange` and `restore` now set `imageUrl` to the *original*
      // file URL, `imgRef.current` should be the clean source image.
      const img = imgRef.current;
      const off = document.createElement('canvas');
      const w = naturalSize.w || img.naturalWidth || img.width;
      const h = naturalSize.h || img.naturalHeight || img.height;
      off.width = w; off.height = h;
      const ctx = off.getContext('2d');
      // Draw the original image
      ctx.drawImage(img, 0, 0, w, h);
      // Now draw *all* values on top
      fields.forEach(f => {
        const val = fieldValues[f.id];
        if (val) drawTextOnCtx(ctx, f.bboxNorm, val);
      });
      return off;
    }
    return null;
  };

  // helper removed: using jsPDF instead of pdf-lib, so no longer need dataURL->Uint8 conversion

  async function downloadFilled() {
    try {
      if (!file) {
        toast.error('No form loaded to download');
        return;
      }

      if (fields.length === 0) {
        toast.error('No fields detected. Please analyze the form first.');
        return;
      }

      toast.info('📥 Preparing download...');

      // For PDFs: render each page to an offscreen canvas, draw only that page's values,
      // then assemble into a multi-page PDF. This avoids overlays from other pages
      // appearing on the wrong page (no overlap across pages).
      if (isPdf) {
        // Use existing PDF reference or array buffer
        let pdfDoc = pdfRef.current;
        
        if (!pdfDoc && pdfArrayBuffer) {
          // Try to reload from array buffer as fallback
          try {
            const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf');
            
            // Configure worker if not already set
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
            }
            
            const loadingTask = pdfjsLib.getDocument({ 
              data: pdfArrayBuffer,
              useWorkerFetch: false,
              isEvalSupported: false
            });
            pdfDoc = await loadingTask.promise;
          } catch (error) {
            console.error('Failed to load PDF:', error);
            toast.error('Failed to load PDF for download');
            return;
          }
        }
        
        if (!pdfDoc) {
          toast.error('PDF not loaded. Please refresh and try again.');
          return;
        }

        const num = pdfDoc.numPages || totalPages || 1;
        const { jsPDF } = await import('jspdf');

        let pdfOut = null;

        for (let p = 1; p <= num; p++) {
          try {
            // --- REFACTOR --- This loop correctly renders each page *fresh* from the original PDF
            const page = await pdfDoc.getPage(p);
            const viewport = page.getViewport({ scale: 1 });
            const off = document.createElement('canvas');
            off.width = Math.round(viewport.width);
            off.height = Math.round(viewport.height);
            const ctx = off.getContext('2d');
            // 1. Render the clean PDF page
            await page.render({ canvasContext: ctx, viewport }).promise;

            // 2. Draw only values that belong to this page
            fields.forEach(f => {
              const fPage = f.page || 1;
              if (fPage !== p) return;
              const val = fieldValues[f.id];
              if (val) drawTextOnCtx(ctx, f.bboxNorm, val);
            });

            const dataUrl = off.toDataURL('image/png');

            if (!pdfOut) {
              // initialize jsPDF with first page size
              const orientation = off.width >= off.height ? 'l' : 'p';
              pdfOut = new jsPDF({ orientation, unit: 'px', format: [off.width, off.height] });
              pdfOut.addImage(dataUrl, 'PNG', 0, 0, off.width, off.height);
            } else {
              // add a new page with page-specific size
              pdfOut.addPage([off.width, off.height], off.width >= off.height ? 'l' : 'p');
              pdfOut.setPage(pdfOut.getNumberOfPages());
              pdfOut.addImage(dataUrl, 'PNG', 0, 0, off.width, off.height);
            }
          } catch (pageError) {
            console.error(`Error rendering page ${p}:`, pageError);
            toast.error(`Failed to render page ${p}`);
          }
        }

  if (!pdfOut) { toast.error('No pages rendered'); return; }
        
        const blob = pdfOut.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (file && file.name) ? `filled-${file.name.replace(/\.[^.]+$/, '')}.pdf` : 'filled-form.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        
        toast.success('✅ Download complete!');
      } else {
        // image path: previous behavior (single page)
        // --- REFACTOR --- This now relies on `applyAllValuesToCanvas`
        // which renders values onto the *original* source image.
        const canvas = applyAllValuesToCanvas();
  if (!canvas) { toast.error('Nothing to download'); return; }
        const dataUrl = canvas.toDataURL('image/png');
        const { jsPDF } = await import('jspdf');
        const orientation = canvas.width >= canvas.height ? 'l' : 'p';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] });
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
        
        toast.success('✅ Download complete!');
      }

      // mark as saved: update initial snapshot and clear dirty flag
      try {
        initialValuesRef.current = { fieldValues: { ...fieldValues }, simpleValues: { ...simpleValues } };
        setHasEdits(false);
      } catch (e) {}
      } catch (err) {
      console.error('downloadFilled failed', err);
      toast.error('Failed to create download. Check console for details.');
    }
  };

  async function suggestField(field) {
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
      toast.error('Suggestion service failed. You can also type a prompt below to ask the AI (see examples).');
    } finally {
      setSuggestLoading(false);
    }
  };

  async function autoFillAll() {
    setSuggestLoading(true);
    try {
      const payload = { context: fieldValues };
      const res = await papi.post('/api/forms/suggest-all', payload);
      const map = res.data.values || {};
      setFieldValues(prev => ({ ...prev, ...map }));
      toast.success('Auto-fill applied for returned fields. Review before exporting.');
    } catch (err) {
      console.error('Auto-fill failed', err);
      toast.error('Auto-fill failed. Ensure the suggestion service is running on the server.');
    } finally {
      setSuggestLoading(false);
    }
  };

  async function askAi(field) {
  if (!aiPrompt) { toast.error('Please enter a question or prompt for the AI.'); return; }
    setAiLoading(true);
    try {
      const payload = { prompt: aiPrompt, fieldId: field ? field.id : null, context: fieldValues };
      const res = await papi.post('/api/forms/assist', payload);
      const answer = res.data.answer || res.data.suggestion || '';
      if (field && answer) handleValueChange(field.id, answer);
      setSuggestions(answer ? [answer] : []);
    } catch (err) {
      console.error('AI assist failed', err);
      toast.error('AI assist failed. See console for details.');
    } finally {
      setAiLoading(false);
    }
  };

  // --- user-help helpers ---
  function examplesForField(field) {
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

  function guideQuestionsForField(field) {
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

  function handleValueChange(id, value) {
    setFieldValues(prev => ({ ...prev, [id]: value }));
  };

  // Handle field image upload
  async function handleFieldImageUpload(fieldId, file) {
    if (!file || !currentFormId) return;
    
    try {
      toast.info('📤 Uploading image...');
      await formStorageService.uploadFieldImage(currentFormId, fieldId, file);
      toast.success('✅ Image uploaded successfully!');
      
      // Refresh saved forms to get updated fieldImages
      await loadSavedForms();
    } catch (error) {
      console.error('Failed to upload field image:', error);
      toast.error('Failed to upload image: ' + (error.message || 'Unknown error'));
    }
  };

  // Handle field image delete
  async function handleDeleteFieldImage(fieldId) {
    if (!currentFormId) return;
    
    try {
      await formStorageService.deleteFieldImage(currentFormId, fieldId);
      toast.success('✅ Image removed successfully!');
      
      // Refresh saved forms to get updated fieldImages
      await loadSavedForms();
    } catch (error) {
      console.error('Failed to delete field image:', error);
      toast.error('Failed to remove image: ' + (error.message || 'Unknown error'));
    }
  };

  async function exportValues() {
    const payload = Object.entries(fieldValues).map(([id, value]) => ({ id, value }));
    try {
      await papi.post('/api/forms/export', { values: payload });
      toast.success('Export successful');
    } catch (err) {
      console.error('Export failed', err);
      toast.error('Export failed');
    }
  };

  // --- Voice recording helpers for form voice input ---
  // Map UI language codes (e.g. 'hi','en') to Speech API locale tags
  const mapUiLangToSpeechLang = (uiCode) => {
    const map = {
      en: 'en-IN',
      hi: 'hi-IN',
      gu: 'gu-IN',
      mr: 'mr-IN',
      ta: 'ta-IN',
      te: 'te-IN',
      bn: 'bn-IN',
      kn: 'kn-IN',
      ml: 'ml-IN',
      pa: 'pa-IN'
    };
    return map[uiCode] || uiCode || 'hi-IN';
  };

  // Keep spokenLang in sync with UI language by default
  useEffect(() => {
    try {
      setSpokenLang(mapUiLangToSpeechLang(language));
    } catch (e) {}
  }, [language]);

  async function startRecordingForField(targetFieldId, spokenLang) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('Audio recording is not supported in this browser');
      return;
    }
    if (isRecording) {
      toast.info('Already recording');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const mr = new MediaRecorder(stream, options);
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size) audioChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        try {
          await handleAudioBlob(blob, targetFieldId, spokenLang || mapUiLangToSpeechLang(language));
        } finally {
          // stop tracks
          try { mediaStreamRef.current && mediaStreamRef.current.getTracks().forEach(t => t.stop()); } catch (e) {}
          mediaStreamRef.current = null;
          recorderRef.current = null;
          setIsRecording(false);
        }
      };
      recorderRef.current = mr;
      setIsRecording(true);
      mr.start();
      toast.info('Recording... Speak now');
    } catch (err) {
      console.error('startRecording failed', err);
      toast.error('Could not start microphone. Check permissions.');
    }
  }

  function stopRecording() {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    } catch (err) {
      console.warn('stopRecording failed', err);
    }
  }

  async function handleAudioBlob(blob, targetFieldId, spokenLang) {
    setIsTranscribing(true);
    try {
      const fd = new FormData();
      // Some browsers produce webm; backend handles common audio types
      fd.append('file', blob, 'recording.webm');
      if (spokenLang) fd.append('language', spokenLang);
      const res = await api.post('/api/transcribe-hindi', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const transcript = res.data?.combinedTranscript || res.data?.transcript || (res.data?.transcripts && res.data?.transcripts[0]) || '';
      const usedLanguage = res.data?.usedLanguage || res.data?.language || null;
      const incomingLang = res.data?.incomingLang || null;
      console.log('Transcription response', { transcript, usedLanguage, incomingLang, raw: res.data });
      // show which language the server used
      if (usedLanguage && incomingLang) {
        if (usedLanguage !== incomingLang) {
          toast.info(`Server used ${usedLanguage} (requested ${incomingLang})`);
        } else {
          toast.info(`Server used ${usedLanguage}`);
        }
      }
      if (!transcript) {
        toast.error('No transcript returned');
        return;
      }
      // If targeting a simple field
      if (typeof targetFieldId === 'string' && targetFieldId.startsWith('simple:')) {
        const name = targetFieldId.replace('simple:', '');
        setSimpleValues(prev => ({ ...prev, [name]: transcript }));
        toast.success('Transcription applied to field');
        return;
      }
      // Otherwise apply to a detected field id
      if (targetFieldId) {
        handleValueChange(targetFieldId, transcript);
        toast.success('Transcription applied');
      } else {
        toast.info('Transcription: ' + transcript);
      }
    } catch (err) {
      console.error('Transcription failed', err);
      toast.error('Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="mt-10 md:mt-0 text-xl sm:text-2xl font-semibold text-gray-900">AutoFill Forms</h2>
          <p className="text-sm text-gray-600 mt-1">Upload, analyze, and fill forms automatically</p>
        </div>
        
        {/* Navigation - View All Forms */}
        {imageUrl && (
          <button
            onClick={async () => {
              // Clear current form
              setFile(null);
              setImageUrl(null);
              setFields([]);
              setSelectedField(null);
              setFieldValues({});
              setCurrentFormId(null);
              setIsPdf(false);
              setPdfArrayBuffer(null);
              if (pdfRef.current) {
                try { await pdfRef.current.destroy(); } catch (e) {}
                pdfRef.current = null;
              }
              // Show saved forms list
              await loadSavedForms();
              toast.info('Form closed. Select from saved forms below or upload a new one.');
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            View All Forms
          </button>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <button 
          onClick={() => {
            if (!checkGuestAccess('Upload Form')) return;
            setShowUploadModal(true);
          }} 
          disabled={loading}
          className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm sm:text-base shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {loading ? 'Analyzing...' : 'Upload Form'}
        </button>
        <button 
          onClick={downloadFilled} 
          disabled={!hasEdits} 
          className={`px-3 sm:px-4 py-2 rounded-lg transition-colors text-sm sm:text-base shadow-sm ${
            hasEdits ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          Download
        </button>
        <button 
          onClick={createNewBox} 
          disabled={!imageUrl && !isPdf} 
          className="px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base shadow-sm"
        >
          New Box
        </button>
      </div>

      {/* Upload Form Modal - Compact */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Upload Form</h3>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFile(null);
                  }}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Upload and select language to analyze automatically
              </p>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* File Upload - Compact */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Form Document *
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={onFileChange}
                  className="hidden"
                  id="form-file-input"
                />
                <label
                  htmlFor="form-file-input"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`flex items-center justify-center w-full px-3 py-4 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                    isDragging 
                      ? 'border-blue-500 bg-blue-100' 
                      : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }`}
                >
                  <div className="text-center pointer-events-none">
                    <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedFile ? selectedFile.name : 'Click or drag to upload'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PDF, DOCX, PNG, JPG (Max 100MB)
                    </p>
                  </div>
                </label>
              </div>

              {/* Language Selection - Compact Grid */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Language *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                      className={`px-2 py-2 rounded-lg border text-center hover:bg-blue-50 transition-colors ${
                        language === lang.code ? 'border-blue-600 bg-blue-50 border-2' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium text-xs truncate">{lang.name}</div>
                      <div className="text-[10px] text-gray-500">{lang.code.toUpperCase()}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedFile(null);
                }}
                className="px-4 py-2 rounded-lg font-medium text-sm border border-gray-300 hover:border-gray-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleUploadAndAnalyze(language)}
                disabled={!selectedFile}
                className="px-4 py-2 rounded-lg font-medium text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload & Analyze
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 md:gap-6">
        {/* Form Preview */}
        <div ref={containerRef} className="relative bg-white border border-gray-200 rounded-xl flex-1 max-w-full overflow-auto shadow-sm">
            {/* Page navigation for multipage PDFs - Responsive */}
            {isPdf && totalPages > 1 && (
              <div className="sticky top-2 left-2 z-20 inline-flex items-center gap-1 sm:gap-2 bg-white/95 backdrop-blur-sm p-1.5 sm:p-2 rounded-lg shadow-md border border-gray-200">
                <button 
                  onClick={() => renderPage(Math.max(1, currentPage - 1))} 
                  disabled={currentPage <= 1} 
                  className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Prev
                </button>
                <div className="text-xs sm:text-sm px-1 sm:px-2 font-medium">
                  {currentPage} / {totalPages}
                </div>
                <button 
                  onClick={() => renderPage(Math.min(totalPages, currentPage + 1))} 
                  disabled={currentPage >= totalPages} 
                  className="px-2 py-1 text-xs sm:text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
                <input 
                  type="number" 
                  min={1} 
                  max={totalPages} 
                  value={currentPage} 
                  onChange={(e) => {
                    const v = Math.max(1, Math.min(totalPages, Number(e.target.value) || 1));
                    renderPage(v);
                  }} 
                  className="w-12 sm:w-14 px-1 sm:px-2 py-1 border rounded text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" 
                />
              </div>
            )}
          {imageUrl ? (
            isPdf ? (
              <div className="w-full h-auto">
                {/* --- REFACTOR --- This canvas is now *only* for rendering the clean PDF page */}
                <canvas ref={pdfCanvasRef} />
                {pdfRenderError && (
                  <div className="p-3 mt-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded">{pdfRenderError}</div>
                )}
              </div>
            ) : (
              // --- REFACTOR --- This img src is the *original* image
              <img ref={imgRef} src={imageUrl} alt="form" onLoad={onImageLoad} className="w-full h-auto block" />
            )
          ) : (
            <div className="p-6">
              {/* Show saved forms in empty state */}
              {!loadingSavedForms && savedForms.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">My Saved Forms</h3>
                    <button
                      onClick={() => {
                        if (!checkGuestAccess('Upload Form')) return;
                        setShowUploadModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload New
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedForms.map((form) => (
                      <div
                        key={form.formId}
                        className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900 truncate" title={form.originalFileName}>
                              {form.originalFileName}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1">
                              {new Date(form.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            form.status === 'completed' || form.status === 'filled'
                              ? 'bg-green-100 text-green-800'
                              : form.status === 'analyzed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {form.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadSavedForm(form)}
                            className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => deleteSavedForm(form.formId)}
                            className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full py-12">
                  <div className="text-center max-w-sm">
                    <svg className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-700 mb-2">No Form Uploaded</h3>
                    <p className="text-sm text-gray-500 mb-4">Upload a form to start analyzing and filling fields automatically</p>
                    <button
                      onClick={() => {
                        if (!checkGuestAccess('Upload Form')) return;
                        setShowUploadModal(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload Form
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* overlays */}
          {fields.map(f => {
            const fPage = f.page || 1;
            // only show overlays for the current PDF page (non-PDF images show all)
            if (isPdf && fPage !== currentPage) return null;
            const bbox = f.bboxNorm;
            const pos = scaleBbox(bbox);
            if (!bbox || !pos) return null;
            const displayLabel = f.label || f.label_text || f.id;
            
            // Get the value and image for this field
            const value = fieldValues[f.id];
            const currentForm = savedForms.find(form => form.formId === currentFormId);
            const fieldImage = currentForm?.fieldImages?.[f.id];
            const fontSize = Math.max(10, Math.min(18, Math.round(pos.height * 0.7))); // Auto-scale font
            
            // Get image position (default: centered at 50%, 50%)
            const imgPos = fieldImagePositions[f.id] || { x: 50, y: 50, scale: 1 };
            
            // Use proxy URL for images to avoid CORS issues
            const imageProxyUrl = fieldImage?.gcsUrl ? 
              `/api/forms/${currentFormId}/field/${f.id}/image` : null;
            
            const startImageDrag = (e, fieldId) => {
              e.stopPropagation();
              e.preventDefault();
              setDraggingImageFieldId(fieldId);
              const currentPos = fieldImagePositions[fieldId] || { x: 50, y: 50, scale: 1 };
              imageDragRef.current = {
                startX: e.clientX,
                startY: e.clientY,
                origX: currentPos.x,
                origY: currentPos.y
              };
            };
            
            return (
              <div 
                key={f.id} 
                onClick={() => handleOverlayClick(f)} 
                style={{ 
                  left: pos.left, 
                  top: pos.top, 
                  width: pos.width, 
                  height: pos.height,
                  borderColor: (selectedField && selectedField.id === f.id) ? '#F59E0B' : '#60A5FA',
                  backgroundColor: (selectedField && selectedField.id === f.id) ? 'rgba(245, 158, 11, 0.1)' : 'rgba(96, 165, 250, 0.08)',
                  overflow: 'visible', // Always allow overflow for images
                  zIndex: imageProxyUrl ? 50 : 1 // Bring image fields to front
                }} 
                className="absolute border-2 text-xs hover:bg-blue-400/12 cursor-pointer rounded-sm" 
                title={displayLabel}
              >
                {/* Show uploaded image if exists */}
                {imageProxyUrl ? (
                  <div 
                    className="absolute"
                    onMouseDown={(e) => startImageDrag(e, f.id)}
                    style={{ 
                      cursor: draggingImageFieldId === f.id ? 'grabbing' : 'grab',
                      left: `${imgPos.x - 50}%`,
                      top: `${imgPos.y - 50}%`,
                      minWidth: '150px',
                      minHeight: '150px',
                      width: 'auto',
                      height: 'auto',
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: 'translate(-50%, -50%)',
                      background: 'white',
                      border: '3px solid #3B82F6',
                      borderRadius: '8px',
                      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '8px',
                      zIndex: 100
                    }}
                  >
                    <img 
                      src={imageProxyUrl}
                      alt={displayLabel}
                      draggable={false}
                      onError={(e) => {
                        console.error('Image load error for field:', f.id);
                        e.target.parentElement.innerHTML = `<div style="color: red; font-size: 12px; text-align: center; padding: 10px;">❌<br/>Image Load Error</div>`;
                      }}
                      onLoad={(e) => {
                        console.log('✓ Image loaded for field:', f.id);
                      }}
                      style={{ 
                        minWidth: '140px',
                        minHeight: '140px',
                        maxWidth: '400px',
                        maxHeight: '400px',
                        width: 'auto',
                        height: 'auto',
                        objectFit: 'contain',
                        pointerEvents: 'none',
                        userSelect: 'none'
                      }}
                    />
                  </div>
                ) : value ? (
                  /* Show entered text value as a DOM overlay */
                  <div 
                    className="pointer-events-none overflow-hidden text-left text-black" 
                    style={{ 
                      paddingLeft: '4px',
                      paddingRight: '4px',
                      paddingTop: '2px',
                      fontSize: fontSize, 
                      lineHeight: 1.2,
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {String(value)}
                  </div>
                ) : null}
              </div>
             
            );
          })}
          {/* editable selection box overlay (when user clicks a detected field) */}
          {selectionBox && (
            // render inside the preview container so absolute coords align with the image/pdf canvas
            <div
              style={{ left: selectionBox.left, top: selectionBox.top, width: selectionBox.width, height: selectionBox.height, zIndex: 50 }}
              className="absolute border-2 border-dashed border-yellow-500 bg-yellow-200/6 rounded"
              onMouseDown={startMove}
              onClick={(e) => e.stopPropagation()}
            >
              {/* resize handles */}
              {['nw','n','ne','e','se','s','sw','w'].map((dir) => (
                <div
                  key={dir}
                  onMouseDown={(e) => startResize(dir, e)}
                  className={`absolute bg-yellow-400 rounded-sm`}
                  style={{
                    width: 10,
                    height: 10,
                    cursor: `${dir}-resize`,
                    ...(dir === 'nw' ? { left: -5, top: -5 } : {}),
                    ...(dir === 'n' ? { left: '50%', top: -5, transform: 'translateX(-50%)' } : {}),
                    ...(dir === 'ne' ? { right: -5, top: -5 } : {}),
                    ...(dir === 'e' ? { right: -5, top: '50%', transform: 'translateY(-50%)' } : {}),
                    ...(dir === 'se' ? { right: -5, bottom: -5 } : {}),
                    ...(dir === 's' ? { left: '50%', bottom: -5, transform: 'translateX(-50%)' } : {}),
                    ...(dir === 'sw' ? { left: -5, bottom: -5 } : {}),
                    ...(dir === 'w' ? { left: -5, top: '50%', transform: 'translateY(-50%)' } : {}),
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Field Inspector - Responsive */}
        <div className="w-full lg:w-80 xl:w-96 bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
          <h3 className="font-semibold text-base sm:text-lg mb-3 text-gray-900">Field Inspector</h3>

          {/* --- REFACTOR --- Cleaned up inspector logic --- */}

          {/* Workflow 1: Simple AcroForm UI */}
          {simpleFields && simpleFields.length > 0 && (
            <div className="mb-4 p-3 border rounded bg-gray-50">
              <div className="text-sm font-medium mb-2">Detected form fields (fillable PDF)</div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {simpleFields.map(name => (
                  <div key={name} className="flex gap-2 items-center">
                    <label className="w-36 text-sm text-gray-700">{name}</label>
                      <div className="flex items-center gap-2 flex-1">
                        <input value={simpleValues[name] || ''} onChange={(e) => handleSimpleValueChange(name, e.target.value)} className="flex-1 border rounded px-2 py-1" />
                        <select
                          value={spokenLang}
                          onChange={(e) => setSpokenLang(e.target.value)}
                          className="ml-2 px-2 py-1 border rounded text-xs"
                          title="Spoken language for recording"
                        >
                          {languages.map(l => (
                            <option key={l.code} value={mapUiLangToSpeechLang(l.code)}>{l.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => isRecording ? stopRecording() : startRecordingForField(`simple:${name}`, spokenLang)}
                          title="Record voice for this field"
                          className={`ml-1 inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isRecording ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                            <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
                            <path d="M12 17v4" />
                            <path d="M8 21h8" />
                          </svg>
                        </button>
                      </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={fillAndDownload} disabled={loadingFillSimple} className="px-3 py-2 bg-green-600 text-white rounded">{loadingFillSimple ? 'Filling...' : 'Fill & Download'}</button>
                <button onClick={() => { setSimpleFields([]); setSimpleValues({}); }} className="px-3 py-2 bg-gray-100 rounded">Clear</button>
              </div>
            </div>
          )}
          
          {/* Workflow 2: Complex Analysis UI (only if simple fields aren't active) */}
          {(!simpleFields || simpleFields.length === 0) && (
            <>
              {/* Panel 2a: Manual Box Selection (if active) */}
              {selectionBox && (
                <div className="mb-4 p-3 border rounded bg-yellow-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium">
                      {selectedField ? 'Editing field box' : 'Creating new box'}
                    </div>
                    {selectedField && (
                      <SpeakerButton text={selectedField.label_text || selectedField.id} language={language} />
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mb-2">Left: {selectionBox.left}px, Top: {selectionBox.top}px, W: {selectionBox.width}px, H: {selectionBox.height}px</div>
                  <div className="flex gap-2">
                    <button onClick={saveSelectionAsField} className="px-3 py-2 bg-yellow-600 text-white rounded">Save Box</button>
                    <button onClick={() => setSelectionBox(null)} className="px-3 py-2 bg-gray-100 rounded">Cancel</button>
                  </div>
                </div>
              )}

              {/* Panel 2b: Selected Field Inspector (if no box is being edited) */}
              {!selectionBox && selectedField && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <div className="text-sm text-gray-700 font-medium">{selectedField.label_text || selectedField.id}</div>
                    {/* --- REFACTOR --- Add "Edit Box" button */}
                    <button 
                      onClick={() => {
                        const pos = scaleBbox(selectedField.bboxNorm);
                        if (pos) setSelectionBox({ left: pos.left, top: pos.top, width: pos.width, height: pos.height, page: selectedField.page || currentPage });
                      }} 
                      className="px-3 py-1 bg-gray-200 text-sm rounded hover:bg-gray-300"
                    >
                      Edit Box
                    </button>
                  </div>
                  {/* <div className="text-xs text-gray-500 mb-3">Field ID: {selectedField.id}</div> */}
                  {selectedField.description && (
                    <div>
                      {/* <div className="text-xs text-gray-500 mb-1">Field Description</div> */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="text-s text-blue-700 font-bold whitespace-pre-wrap flex-1">{selectedField.description}</div>
                        <SpeakerButton text={selectedField.description} language={language} />
                      </div>
                    </div>
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
                    <div className="flex items-center gap-2">
                      <input value={fieldValues[selectedField.id] || ''} onChange={(e) => handleValueChange(selectedField.id, e.target.value)} className="flex-1 mt-1 border rounded px-3 py-2" />
                      <div className="flex items-center gap-2 mt-1">
                        <select
                          value={spokenLang}
                          onChange={(e) => setSpokenLang(e.target.value)}
                          className="px-2 py-1 border rounded text-xs"
                          title="Spoken language for recording"
                        >
                          {languages.map(l => (
                            <option key={l.code} value={mapUiLangToSpeechLang(l.code)}>{l.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => isRecording ? stopRecording() : startRecordingForField(selectedField.id, spokenLang)}
                          title="Record voice for this field"
                          className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors ${isRecording ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
                            <path d="M19 11v1a7 7 0 0 1-14 0v-1" />
                            <path d="M12 17v4" />
                            <path d="M8 21h8" />
                          </svg>
                        </button>
                        
                      </div>
                    </div>
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
                    {/* Done button saves progress and marks form as completed */}
                    <button 
                      onClick={() => saveFormProgress()} 
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      ✓ Done
                    </button>
                    <div className="flex items-center gap-2">
                      {/* <button onClick={() => exportValues()} className="px-3 py-2 bg-blue-600 text-white rounded">Export All</button> */}
                      <button 
                        onClick={() => downloadFilled()} 
                        className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors"
                      >
                        Download Filled
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Panel 2c: Placeholder (no selection) */}
              {!selectionBox && !selectedField && (
                <div className="text-sm text-gray-500">
                  {isPdf ? (
                    `PDF preview shown. Showing page ${currentPage} of ${totalPages}. Click a highlighted box to inspect and fill a field.`
                  ) : (
                    "Click a highlighted box on the left to inspect and fill a field."
                  )}
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Saved Forms Modal */}
      {showSavedForms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">My Saved Forms</h3>
                <button
                  onClick={() => setShowSavedForms(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                All your forms are securely stored in the cloud
              </p>
            </div>

            {/* Content */}
            <div className="p-4">
              {loadingSavedForms ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : savedForms.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">No Forms Yet</h4>
                  <p className="text-sm text-gray-500">Upload a form to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedForms.map((form) => (
                    <div key={form.formId} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{form.originalFileName}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Uploaded {new Date(form.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          form.status === 'completed' ? 'bg-green-100 text-green-700' :
                          form.status === 'filled' ? 'bg-blue-100 text-blue-700' :
                          form.status === 'analyzed' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {form.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>{form.fields?.length || 0} fields</span>
                        <span>•</span>
                        <span>{(form.fileSize / 1024).toFixed(1)} KB</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadSavedForm(form)}
                          className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                        >
                          Load
                        </button>
                        {form.status === 'completed' && (
                          <button
                            onClick={async () => {
                              try {
                                const url = await formStorageService.getFilledDownloadLink(form.formId);
                                await formStorageService.downloadFile(url, `filled_${form.originalFileName}`);
                                toast.success('Download started');
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Download failed');
                              }
                            }}
                            className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => deleteSavedForm(form.formId)}
                          className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <GuestAccessModal
        isOpen={showGuestModal}
        onClose={closeGuestModal}
        featureName={blockedFeature}
      />
    </div>
  );
};

export default FormAutoFill;