import { PDFDocument } from 'pdf-lib';

// Extract named AcroForm fields from an uploaded PDF
export const extractFields = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'no file uploaded' });
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    const form = pdfDoc.getForm();
    const fields = form.getFields().map(f => f.getName());
    return res.json({ fields });
  } catch (err) {
    console.error('extractFields error', err);
    return res.status(500).json({ error: 'extract_failed', details: String(err) });
  }
};

// Fill an uploaded PDF with provided values and return the filled PDF
export const fillForm = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'no file uploaded' });
    const values = req.body.values ? JSON.parse(req.body.values) : {};
    const pdfDoc = await PDFDocument.load(req.file.buffer);
    const form = pdfDoc.getForm();

    for (const [name, val] of Object.entries(values || {})) {
      try {
        // try to get field by name; pdf-lib has typed getters but getField is generic
        const field = form.getFieldMaybe ? form.getFieldMaybe(name) : (form.getTextField && form.getTextField(name)) || form.getField(name);
        if (!field) continue;
        if (typeof field.setText === 'function') {
          field.setText(String(val || ''));
        } else if (typeof field.set === 'function') {
          field.set(String(val || ''));
        }
      } catch (e) {
        // ignore unsupported field types
        console.warn('Could not set value for', name, e && e.message ? e.message : e);
      }
    }

    try { form.flatten(); } catch (e) { /* optional */ }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="filled.pdf"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('fillForm error', err);
    return res.status(500).json({ error: 'fill_failed', details: String(err) });
  }
};
