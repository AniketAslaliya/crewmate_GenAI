import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'node:crypto';

// Parse credentials from env (safe) and normalize private_key newlines
let credentialsObject;
let credentialFingerprint = null;
try {
  if (process.env.GCP_CREDENTIALS) {
    credentialsObject = JSON.parse(process.env.GCP_CREDENTIALS);

    // If private_key contains escaped newlines (literal "\\n"), convert them to real newlines
    if (typeof credentialsObject.private_key === 'string') {
      const raw = credentialsObject.private_key;
      const containsEscaped = raw.includes('\\n');
      const normalized = containsEscaped ? raw.replace(/\\n/g, '\n') : raw;
      credentialsObject.private_key = normalized.trim();

      // Compute short SHA-256 fingerprint of the private_key (safe — doesn't reveal key)
      credentialFingerprint = crypto.createHash('sha256')
        .update(credentialsObject.private_key)
        .digest('hex')
        .slice(0, 16);
    }
  }
} catch (err) {
  console.warn('Could not parse GCP_CREDENTIALS from env. Falling back to ADC if available.', err?.message || err);
}

// Initialize Google Cloud Storage
const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID || (credentialsObject && credentialsObject.project_id),
  credentials: credentialsObject
});

const bucketName = process.env.GCS_BUCKET_NAME || 'legal-ai-forms';
const bucket = storage.bucket(bucketName);

/**
 * Upload file to Google Cloud Storage
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path (e.g., 'forms', 'lawyer-docs')
 * @param {string} userId - User ID for organizing files
 * @returns {Promise<{url: string, path: string, filename: string}>}
 */
export const uploadToGCS = async (fileBuffer, filename, folder = 'forms', userId = '') => {
  try {
    const uniqueId = uuidv4();
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = userId 
      ? `${folder}/${userId}/${timestamp}_${uniqueId}_${sanitizedFilename}`
      : `${folder}/${timestamp}_${uniqueId}_${sanitizedFilename}`;
    
    const file = bucket.file(path);
    
    // Upload file
    await file.save(fileBuffer, {
      metadata: {
        contentType: getMimeType(filename),
        metadata: {
          originalName: filename,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId
        }
      },
      public: false, // Private by default
      resumable: false
    });

    // Generate signed URL (valid for 7 days)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return {
      url: url,
      path: path,
      filename: sanitizedFilename,
      publicUrl: `https://storage.googleapis.com/${bucketName}/${path}`
    };
  } catch (error) {
    // Log safe diagnostic info
    console.error('❌ GCS upload error:', {
      message: error.message,
      status: error.status || error.code,
      responseData: error?.response?.data ? error.response.data : undefined,
      credential_fingerprint: credentialFingerprint
    });

    // If Google returned structured error info, include it
    if (error?.response?.data && error.response.data.error_description) {
      throw new Error(`Failed to upload file to Google Cloud Storage: ${error.response.data.error}: ${error.response.data.error_description}`);
    }

    throw new Error(`Failed to upload file to Google Cloud Storage: ${error.message}`);
  }
};

/**
 * Delete file from Google Cloud Storage
 * @param {string} path - File path in GCS
 * @returns {Promise<void>}
 */
export const deleteFromGCS = async (path) => {
  try {
    const file = bucket.file(path);
    await file.delete();
  } catch (error) {
    console.error('❌ GCS delete error:', error);
    // Don't throw error if file doesn't exist
    if (error.code !== 404) {
      throw new Error('Failed to delete file from Google Cloud Storage');
    }
  }
};

/**
 * Get signed URL for temporary download
 * @param {string} path - File path in GCS
 * @param {number} expiresInHours - Expiration time in hours (default 1 hour)
 * @returns {Promise<string>}
 */
export const getSignedUrl = async (path, expiresInHours = 1) => {
  try {
    const file = bucket.file(path);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresInHours * 60 * 60 * 1000
    });
    return url;
  } catch (error) {
    console.error('❌ GCS get signed URL error:', error);
    throw new Error('Failed to get download link');
  }
};

/**
 * Share file between users (lawyer and client)
 * @param {string} path - File path in GCS
 * @param {string[]} userIds - Array of user IDs to share with
 * @returns {Promise<string>} Shared URL
 */
export const shareFile = async (path, userIds = []) => {
  try {
    const file = bucket.file(path);
    
    // Update file metadata with shared users
    await file.setMetadata({
      metadata: {
        sharedWith: userIds.join(','),
        sharedAt: new Date().toISOString()
      }
    });

    // Generate long-lived signed URL for shared access (30 days)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days
  });

    return url;
  } catch (error) {
    console.error('❌ GCS share error:', error);
    throw new Error('Failed to share file');
  }
};

/**
 * List files in a folder
 * @param {string} prefix - Folder prefix (e.g., 'forms/userId')
 * @returns {Promise<Array>}
 */
export const listFiles = async (prefix) => {
  try {
    const [files] = await bucket.getFiles({ prefix });
    return files.map(file => ({
      name: file.name,
      path: file.name,
      size: file.metadata.size,
      updated: file.metadata.updated,
      contentType: file.metadata.contentType
    }));
  } catch (error) {
    console.error('❌ GCS list error:', error);
    throw new Error('Failed to list files');
  }
};

/**
 * Get file metadata
 * @param {string} path - File path in GCS
 * @returns {Promise<Object>}
 */
export const getFileMetadata = async (path) => {
  try {
    const file = bucket.file(path);
    const [metadata] = await file.getMetadata();
    return metadata;
  } catch (error) {
    console.error('❌ GCS metadata error:', error);
    throw new Error('Failed to get file metadata');
  }
};

/**
 * Check if file exists
 * @param {string} path - File path in GCS
 * @returns {Promise<boolean>}
 */
export const fileExists = async (path) => {
  try {
    const file = bucket.file(path);
    const [exists] = await file.exists();
    return exists;
  } catch (error) {
    console.error('❌ GCS exists check error:', error);
    return false;
  }
};

/**
 * Copy file to another location
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 * @returns {Promise<void>}
 */
export const copyFile = async (sourcePath, destPath) => {
  try {
    const sourceFile = bucket.file(sourcePath);
    const destFile = bucket.file(destPath);
    await sourceFile.copy(destFile);
  } catch (error) {
    console.error('❌ GCS copy error:', error);
    throw new Error('Failed to copy file');
  }
};

/**
 * Get a readable stream for a file in GCS
 * @param {string} path - File path in GCS
 * @returns {ReadableStream}
 */
export const getReadStream = (path) => {
  try {
    const file = bucket.file(path);
    return file.createReadStream();
  } catch (error) {
    console.error('❌ GCS createReadStream error:', error);
    throw new Error('Failed to create read stream from GCS');
  }
};

/**
 * Get MIME type from filename
 * @param {string} filename
 * @returns {string}
 */
const getMimeType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

export default {
  uploadToGCS,
  deleteFromGCS,
  getSignedUrl,
  getReadStream,
  shareFile,
  listFiles,
  getFileMetadata,
  fileExists,
  copyFile
};