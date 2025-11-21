import api from '../Axios/axios';

class FormStorageService {
  /**
   * Upload form to Dropbox and save metadata
   * @param {File} file - Form file
   * @param {string} language - Language code
   * @returns {Promise<Object>} - Form metadata
   */
  async uploadForm(file, language) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);

    const response = await api.post('/api/forms/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data.form;
  }

  /**
   * Save analyzed fields to form
   * @param {string} formId - Form ID
   * @param {Array} fields - Analyzed fields
   * @returns {Promise<Object>}
   */
  async saveAnalyzedFields(formId, fields) {
    const response = await api.put(`/api/forms/${formId}/fields`, { fields });
    return response.data.form;
  }

  /**
   * Save filled values to form
   * @param {string} formId - Form ID
   * @param {Object} fieldValues - Field values
   * @returns {Promise<Object>}
   */
  async saveFilledValues(formId, fieldValues) {
    const response = await api.put(`/api/forms/${formId}/values`, { fieldValues });
    return response.data.form;
  }

  /**
   * Upload completed filled form to Dropbox
   * @param {string} formId - Form ID
   * @param {Blob} filledFormBlob - Filled form as blob
   * @param {string} fileName - File name
   * @returns {Promise<Object>}
   */
  async uploadFilledForm(formId, filledFormBlob, fileName) {
    const formData = new FormData();
    formData.append('file', filledFormBlob, fileName);

    const response = await api.post(`/api/forms/${formId}/upload-filled`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  }

  /**
   * Get list of all forms
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async listForms(options = {}) {
    const { status, limit = 50, offset = 0 } = options;
    const params = new URLSearchParams();
    
    if (status) params.append('status', status);
    params.append('limit', limit);
    params.append('offset', offset);

    const response = await api.get(`/api/forms/list?${params.toString()}`);
    return response.data;
  }

  /**
   * Get single form details
   * @param {string} formId - Form ID
   * @returns {Promise<Object>}
   */
  async getForm(formId) {
    const response = await api.get(`/api/forms/${formId}`);
    return response.data.form;
  }

  /**
   * Delete form and its files
   * @param {string} formId - Form ID
   * @returns {Promise<Object>}
   */
  async deleteForm(formId) {
    const response = await api.delete(`/api/forms/${formId}`);
    return response.data;
  }

  /**
   * Get download link for original form (uses backend proxy to avoid CORS)
   * @param {string} formId - Form ID
   * @returns {Promise<string>}
   */
  async getDownloadLink(formId) {
    // Use proxy endpoint to avoid CORS issues with GCS
    const baseUrl = api.defaults.baseURL || '';
    return `${baseUrl}/api/forms/${formId}/download?proxy=true`;
  }

  /**
   * Get download link for filled form
   * @param {string} formId - Form ID
   * @returns {Promise<string>}
   */
  async getFilledDownloadLink(formId) {
    const response = await api.get(`/api/forms/${formId}/download-filled`);
    return response.data.downloadUrl;
  }

  /**
   * Download form file
   * @param {string} downloadUrl - Temporary download URL
   * @param {string} fileName - File name
   */
  async downloadFile(downloadUrl, fileName) {
    const response = await fetch(downloadUrl);
    const blob = await response.blob();
    
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Upload image for a specific field
   * @param {string} formId - Form ID
   * @param {string} fieldId - Field ID
   * @param {File} imageFile - Image file
   * @returns {Promise<Object>}
   */
  async uploadFieldImage(formId, fieldId, imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post(`/api/forms/${formId}/field/${fieldId}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  }

  /**
   * Delete field image
   * @param {string} formId - Form ID
   * @param {string} fieldId - Field ID
   * @returns {Promise<Object>}
   */
  async deleteFieldImage(formId, fieldId) {
    const response = await api.delete(`/api/forms/${formId}/field/${fieldId}/image`);
    return response.data;
  }
}

const formStorageService = new FormStorageService();
export default formStorageService;
