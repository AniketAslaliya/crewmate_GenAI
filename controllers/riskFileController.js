import { Chat } from "../models/Chat.js";

// Forward uploaded file to external risk service, save and return response
export const uploadRiskDoc = async (req, res) => {
  try {
    // multer puts file in req.file
    const file = req.file;
    const { user_id, thread_id, output_language } = req.body;

    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    if (!thread_id) return res.status(400).json({ error: 'thread_id is required' });

    // Build FormData and forward to external risk analysis service
    // Use global FormData / Blob available in Node 18+
    const form = new FormData();
    // Create a Blob from buffer
    const blob = new Blob([file.buffer], { type: file.mimetype });
    form.append('file', blob, file.originalname);
    form.append('user_id', user_id || '');
    form.append('thread_id', thread_id);
    form.append('output_language', output_language || 'en');

    // External service URL - using the provided example
    const externalUrl = process.env.RISK_SERVICE_URL || 'https://jeet2207-rag-final.hf.space/api/upload-risk-doc';

    const response = await fetch(externalUrl, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({ error: 'Risk service error', details: text });
    }

    const json = await response.json();

    // Save risk analysis result into Chat.riskAnalyses
    try {
      const chat = await Chat.findOne({ _id: thread_id, user: user_id });
      if (chat) {
        chat.riskAnalyses = chat.riskAnalyses || [];
        chat.riskAnalyses.push({ createdAt: new Date(), result: json });
        await chat.save();
      }
    } catch (e) {
      // Log but continue returning the JSON
      console.error('Failed to save risk analysis to chat:', e);
    }

    return res.json(json);
  } catch (err) {
    console.error('uploadRiskDoc error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
