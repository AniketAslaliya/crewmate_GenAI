import { uploadToGCS, deleteFromGCS, getSignedUrl } from '../utils/gcs.js';
import { User } from '../models/User.js';

/**
 * Upload original form to Dropbox and save metadata
 * POST /api/forms/upload
 * Body: FormData with file, language, userId
 */
export const uploadForm = async (req, res) => {
  try {
    const { language } = req.body;
    const userId = req.user?._id || req.user?.id || req.user; // from auth middleware
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!userId) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Upload to Google Cloud Storage
    const gcsResult = await uploadToGCS(
      req.file.buffer,
      req.file.originalname,
      'forms',
      userId.toString()
    );

    // Save form metadata to user document
    const user = await User.findById(userId);
    if (!user.formStorage) {
      user.formStorage = [];
    }

    const formData = {
      formId: `form_${Date.now()}`,
      originalFileName: req.file.originalname,
      gcsPath: gcsResult.path,
      gcsUrl: gcsResult.url,
      language: language || 'en',
      uploadedAt: new Date(),
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      fields: [], // Will be populated after analysis
      status: 'uploaded'
    };

    user.formStorage.push(formData);
    await user.save();

    res.json({
      success: true,
      form: formData,
      message: 'Form uploaded successfully'
    });
  } catch (error) {
    console.error('Upload form error:', error);
    res.status(500).json({ 
      message: 'Failed to upload form',
      error: error.message 
    });
  }
};

/**
 * Save analyzed fields to form
 * PUT /api/forms/:formId/fields
 * Body: { fields: [...] }
 */
export const saveAnalyzedFields = async (req, res) => {
  try {
    const { formId } = req.params;
    const { fields } = req.body;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    form.fields = fields;
    form.status = 'analyzed';
    form.analyzedAt = new Date();

    await user.save();

    res.json({
      success: true,
      form,
      message: 'Fields saved successfully'
    });
  } catch (error) {
    console.error('Save fields error:', error);
    res.status(500).json({ 
      message: 'Failed to save fields',
      error: error.message 
    });
  }
};

/**
 * Save filled form values
 * PUT /api/forms/:formId/values
 * Body: { fieldValues: {...} }
 */
export const saveFilledValues = async (req, res) => {
  try {
    const { formId } = req.params;
    const { fieldValues } = req.body;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    form.fieldValues = fieldValues;
    form.status = 'filled';
    form.lastModified = new Date();

    await user.save();

    res.json({
      success: true,
      form,
      message: 'Values saved successfully'
    });
  } catch (error) {
    console.error('Save values error:', error);
    res.status(500).json({ 
      message: 'Failed to save values',
      error: error.message 
    });
  }
};

/**
 * Upload completed/filled form to Dropbox
 * POST /api/forms/:formId/upload-filled
 * Body: FormData with filled form file
 */
export const uploadFilledForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Upload filled form to Google Cloud Storage
    const gcsResult = await uploadToGCS(
      req.file.buffer,
      `filled_${form.originalFileName}`,
      'forms/completed',
      userId.toString()
    );

    form.filledFormPath = gcsResult.path;
    form.filledFormUrl = gcsResult.url;
    form.status = 'completed';
    form.completedAt = new Date();

    await user.save();

    res.json({
      success: true,
      form,
      downloadUrl: gcsResult.url,
      message: 'Filled form uploaded successfully'
    });
  } catch (error) {
    console.error('Upload filled form error:', error);
    res.status(500).json({ 
      message: 'Failed to upload filled form',
      error: error.message 
    });
  }
};

/**
 * Get all forms for user
 * GET /api/forms/list
 */
export const listForms = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user;
    const { status, limit = 50, offset = 0 } = req.query;

    const user = await User.findById(userId);
    let forms = user.formStorage || [];

    // Filter by status if provided
    if (status) {
      forms = forms.filter(f => f.status === status);
    }

    // Sort by most recent first
    forms.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    // Pagination
    const total = forms.length;
    const paginatedForms = forms.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      forms: paginatedForms,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('List forms error:', error);
    res.status(500).json({ 
      message: 'Failed to list forms',
      error: error.message 
    });
  }
};

/**
 * Get single form details
 * GET /api/forms/:formId
 */
export const getForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Get signed URL for original form
    if (form.gcsPath) {
      try {
        form.tempDownloadUrl = await getSignedUrl(form.gcsPath, 24);
      } catch (error) {
        console.warn('Failed to get signed URL:', error);
      }
    }

    // Get signed URL for filled form
    if (form.filledFormPath) {
      try {
        form.tempFilledDownloadUrl = await getSignedUrl(form.filledFormPath, 24);
      } catch (error) {
        console.warn('Failed to get filled signed URL:', error);
      }
    }

    res.json({
      success: true,
      form
    });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ 
      message: 'Failed to get form',
      error: error.message 
    });
  }
};

/**
 * Delete form and its GCS files
 * DELETE /api/forms/:formId
 */
export const deleteForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const formIndex = user.formStorage.findIndex(f => f.formId === formId);

    if (formIndex === -1) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const form = user.formStorage[formIndex];

    // Delete from Dropbox
    if (form.gcsPath) {
      try {
        await deleteFromGCS(form.gcsPath);
      } catch (error) {
        console.warn('Failed to delete original from GCS:', error);
      }
    }

    if (form.filledFormPath) {
      try {
        await deleteFromGCS(form.filledFormPath);
      } catch (error) {
        console.warn('Failed to delete filled from GCS:', error);
      }
    }

    // Remove from user document
    user.formStorage.splice(formIndex, 1);
    await user.save();

    res.json({
      success: true,
      message: 'Form deleted successfully'
    });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ 
      message: 'Failed to delete form',
      error: error.message 
    });
  }
};

/**
 * Get download link for original form (proxy through backend to avoid CORS)
 * GET /api/forms/:formId/download
 */
export const downloadOriginalForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;
    const { proxy } = req.query; // Check if client wants proxy

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form || !form.gcsPath) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // If proxy=true, stream the file directly through backend (avoids CORS)
    if (proxy === 'true') {
      const { Storage } = await import('@google-cloud/storage');
      const storage = new Storage({
        projectId: process.env.GCP_PROJECT_ID,
        credentials: JSON.parse(process.env.GCP_CREDENTIALS)
      });
      const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      const file = bucket.file(form.gcsPath);

      // Set CORS and response headers
      res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:3000');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Content-Type', form.mimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${form.originalFileName}"`);
      res.setHeader('Cache-Control', 'no-cache');

      // Stream the file
      file.createReadStream()
        .on('error', (err) => {
          console.error('Stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to stream file' });
          }
        })
        .pipe(res);
    } else {
      // Return signed URL (may have CORS issues)
      const downloadUrl = await getSignedUrl(form.gcsPath, 1);
      res.json({
        success: true,
        downloadUrl,
        fileName: form.originalFileName
      });
    }
  } catch (error) {
    console.error('Download form error:', error);
    res.status(500).json({ 
      message: 'Failed to get download link',
      error: error.message 
    });
  }
};

/**
 * Upload image for a specific field
 * POST /api/forms/:formId/field/:fieldId/image
 */
export const uploadFieldImage = async (req, res) => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Upload image to GCS
    const gcsResult = await uploadToGCS(
      req.file.buffer,
      `field_${fieldId}_${Date.now()}_${req.file.originalname}`,
      `forms/${userId}/field-images`,
      userId.toString()
    );

    // Initialize fieldImages if not exists
    if (!form.fieldImages) {
      form.fieldImages = {};
    }

    // Delete old image if exists
    if (form.fieldImages[fieldId]?.gcsPath) {
      try {
        await deleteFromGCS(form.fieldImages[fieldId].gcsPath);
      } catch (error) {
        console.warn('Failed to delete old field image:', error);
      }
    }

    // Store image reference
    form.fieldImages[fieldId] = {
      gcsPath: gcsResult.path,
      gcsUrl: gcsResult.url,
      uploadedAt: new Date()
    };

    await user.save();

    res.json({
      success: true,
      fieldImage: form.fieldImages[fieldId],
      message: 'Field image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload field image error:', error);
    res.status(500).json({ 
      message: 'Failed to upload field image',
      error: error.message 
    });
  }
};

/**
 * Delete field image
 * DELETE /api/forms/:formId/field/:fieldId/image
 */
export const deleteFieldImage = async (req, res) => {
  try {
    const { formId, fieldId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    // Delete from GCS
    if (form.fieldImages?.[fieldId]?.gcsPath) {
      try {
        await deleteFromGCS(form.fieldImages[fieldId].gcsPath);
      } catch (error) {
        console.warn('Failed to delete from GCS:', error);
      }
    }

    // Remove from fieldImages
    if (form.fieldImages) {
      delete form.fieldImages[fieldId];
    }

    await user.save();

    res.json({
      success: true,
      message: 'Field image deleted successfully'
    });
  } catch (error) {
    console.error('Delete field image error:', error);
    res.status(500).json({ 
      message: 'Failed to delete field image',
      error: error.message 
    });
  }
};

/**
 * Get download link for filled form
 * GET /api/forms/:formId/download-filled
 */
export const downloadFilledForm = async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user?._id || req.user?.id || req.user;

    const user = await User.findById(userId);
    const form = user.formStorage.find(f => f.formId === formId);

    if (!form || !form.filledFormPath) {
      return res.status(404).json({ message: 'Filled form not found' });
    }

    const downloadUrl = await getSignedUrl(form.filledFormPath, 1);

    res.json({
      success: true,
      downloadUrl,
      fileName: `filled_${form.originalFileName}`
    });
  } catch (error) {
    console.error('Download filled form error:', error);
    res.status(500).json({ 
      message: 'Failed to get download link',
      error: error.message 
    });
  }
};
