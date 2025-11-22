import { SpeechClient } from '@google-cloud/speech';
import fs from 'fs';
import path from 'path';

// Prefer an existing `gcloud-sa.json` in repo root if present (user requested using that file).
// If not present, fall back to env var JSON or individual GCP_SA_* vars.
const ensureCredentialsFromEnv = () => {
  try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return process.env.GOOGLE_APPLICATION_CREDENTIALS;

    // If a plain file `gcloud-sa.json` exists in the backend root, use it directly.
    const defaultSaPath = path.resolve(process.cwd(), 'gcloud-sa.json');
    if (fs.existsSync(defaultSaPath)) {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = defaultSaPath;
      console.log('Using existing service account file:', defaultSaPath);
      return defaultSaPath;
    }

    const candidates = [
      'GCP_CREDENTIALS_JSON',
      'GCP_CREDENTIALS',
      'GCP_CREDENTIALS_STRING',
      'GCP_CREDENTIALS_BASE64',
      'GOOGLE_SERVICE_ACCOUNT_JSON',
      'GOOGLE_SERVICE_ACCOUNT'
    ];

    let raw = null;
    let usedVar = null;
    for (const name of candidates) {
      if (process.env[name]) {
        raw = process.env[name];
        usedVar = name;
        break;
      }
    }
    if (!raw) return null;

    let jsonStr = raw;
    // If looks like base64, decode it
    const maybeBase64 = (s) => /^[A-Za-z0-9+/=\n\r]+$/.test(s.trim()) && !s.trim().startsWith('{');
    if (maybeBase64(jsonStr)) {
      try {
        jsonStr = Buffer.from(jsonStr, 'base64').toString('utf8');
      } catch (e) {
        // not valid base64, fall through
      }
    }

    // If value is already an object in env (unlikely), stringify
    if (typeof jsonStr !== 'string') jsonStr = JSON.stringify(jsonStr);

    if (!jsonStr.trim().startsWith('{')) {
      // Not valid JSON
      console.warn('GCP credentials found in env var', usedVar, 'but content is not JSON');
      return null;
    }

    const outPath = path.resolve(process.cwd(), 'gcloud-sa-fromenv.json');
    fs.writeFileSync(outPath, jsonStr, { encoding: 'utf8', mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = outPath;
    console.log('Using GCP credentials from env var:', usedVar);
    return outPath;
  } catch (err) {
    console.warn('Failed to write GCP credentials from env:', err?.message || err);
    return null;
  }
};

// Also support building service account JSON from individual env vars prefixed with GCP_SA_
const buildCredentialsFromIndividualVars = () => {
  const keys = [
    'type','project_id','private_key_id','private_key','client_email','client_id','auth_uri','token_uri','auth_provider_x509_cert_url','client_x509_cert_url','universe_domain'
  ];

  // Map env var names: GCP_SA_TYPE, GCP_SA_PROJECT_ID, etc.
  const envPrefix = 'GCP_SA_';
  const obj = {};
  let foundAny = false;
  for (const k of keys) {
    const envName = envPrefix + k.toUpperCase();
    if (process.env[envName]) {
      foundAny = true;
      obj[k] = process.env[envName];
    }
  }

  if (!foundAny) return null;

  // Ensure private_key newlines are preserved (if provided as escaped \n sequences)
  if (obj.private_key && obj.private_key.indexOf('\\n') !== -1) {
    obj.private_key = obj.private_key.replace(/\\n/g, '\n');
  }

  try {
    const outPath = path.resolve(process.cwd(), 'gcloud-sa-fromenv.json');
    fs.writeFileSync(outPath, JSON.stringify(obj), { encoding: 'utf8', mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = outPath;
    console.log('Built GCP credentials JSON from individual GCP_SA_* env vars');
    return outPath;
  } catch (err) {
    console.warn('Failed to write built GCP credentials to file:', err?.message || err);
    return null;
  }
};

// Try direct/json env var first, then individual GCP_SA_* vars
if (!ensureCredentialsFromEnv()) {
  buildCredentialsFromIndividualVars();
}

// Initialize client — relies on GOOGLE_APPLICATION_CREDENTIALS or default ADC
const client = new SpeechClient();

/**
 * Transcribe uploaded audio (Hindi - hi-IN)
 * Expects multipart/form-data with field `file` containing audio (wav/mp3/m4a)
 */
export const transcribeHindi = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'No audio file uploaded (field name: file)' });
    }

    // Log incoming language and mimetype for debugging language selection issues
    const incomingLang = (req.body && (req.body.language || req.body.lang)) || null;
    console.log('transcribeHindi called. incoming language:', incomingLang, 'mimetype:', req.file.mimetype);

    const audioBytes = req.file.buffer.toString('base64');

    const audio = {
      content: audioBytes,
    };

    // Leave encoding/sampleRate unspecified so the Speech API can accept
    // WEBM/OPUS recordings produced by browsers (auto-detect headers).
    // Allow frontend to provide the spoken language (e.g. 'hi-IN' or 'en-US')
    const spokenLang = (req.body && (req.body.language || req.body.lang)) || 'hi-IN';
    const config = {
      encoding: 'ENCODING_UNSPECIFIED',
      // sampleRateHertz intentionally omitted to avoid mismatches with browser-produced files
      languageCode: spokenLang,
      enableAutomaticPunctuation: true,
      // Use enhanced model for better accuracy when available
      useEnhanced: true,
      model: 'latest_short'
    };

    const request = {
      audio,
      config,
    };

    // Use recognize (synchronous). For very long audio consider longRunningRecognize.
    // Some languages do not support enhanced/latest_short model; try once and
    // fall back to the default model if we receive that error.
    let response;
    try {
      const arr = await client.recognize(request);
      response = arr[0];
    } catch (err2) {
      // If the enhanced model isn't supported for the language, retry with default model
      const details = (err2 && err2.details) || '';
      if (err2 && err2.code === 3 && /not supported for language/i.test(String(details))) {
        console.warn('Enhanced model not supported for language, retrying with default model for', spokenLang);
        const fallbackConfig = { ...config, useEnhanced: false, model: 'default' };
        const fallbackRequest = { audio, config: fallbackConfig };
        const arr2 = await client.recognize(fallbackRequest);
        response = arr2[0];
      } else {
        throw err2;
      }
    }
    const results = response.results || [];

    const transcripts = results.map((r) => ({
      transcript: r.alternatives && r.alternatives[0] ? r.alternatives[0].transcript : '',
      confidence: r.alternatives && r.alternatives[0] ? r.alternatives[0].confidence : null,
    }));

    // Join transcripts for a single string
    const combined = transcripts.map(t => t.transcript).join(' ').trim();

    return res.json({ transcripts, transcript: combined, usedLanguage: spokenLang, incomingLang });
  } catch (err) {
    console.error('Google STT error:', err);
    return res.status(500).json({ error: 'Transcription failed', details: err.message || err });
  }
};
