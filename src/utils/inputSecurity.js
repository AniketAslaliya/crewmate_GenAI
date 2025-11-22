// Input Security Validation Utilities

/**
 * Sanitize text input to prevent XSS attacks
 * @param {string} input - Raw input string
 * @returns {string} - Sanitized string
 */
export const sanitizeTextInput = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove script tags and their content
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  
  // Remove object and embed tags
  sanitized = sanitized.replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
  
  // Don't trim - preserve spaces for natural text input
  return sanitized;
};

/**
 * Validate and sanitize file name
 * @param {string} fileName - Original file name
 * @returns {object} - { isValid: boolean, sanitized: string, error: string }
 */
export const validateFileName = (fileName) => {
  if (!fileName || typeof fileName !== 'string') {
    return { isValid: false, sanitized: '', error: 'Invalid file name' };
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { isValid: false, sanitized: '', error: 'File name contains invalid path characters' };
  }

  // Remove potentially dangerous characters
  const sanitized = fileName.replace(/[<>:"|?*\x00-\x1f]/g, '');

  // Check for dangerous or repeated extensions (security risk)
  const dangerousExtensions = [
    'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
    'msi', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1', 'psm1'
  ];
  const allowedExtensions = [
    'pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp'
  ];
  const lowerFileName = fileName.toLowerCase();
  const extParts = lowerFileName.split('.').slice(1); // skip base name
  if (extParts.length === 0) {
    return { isValid: false, sanitized: '', error: 'File must have an extension' };
  }
  // Block if any extension is dangerous or not allowed
  for (const ext of extParts) {
    if (dangerousExtensions.includes(ext)) {
      return { isValid: false, sanitized: '', error: 'Executable files are not allowed' };
    }
    if (!allowedExtensions.includes(ext)) {
      return { isValid: false, sanitized: '', error: `File extension .${ext} is not allowed` };
    }
  }

  // Check for null bytes
  if (fileName.includes('\0')) {
    return { isValid: false, sanitized: '', error: 'File name contains null bytes' };
  }

  // Check length (prevent extremely long names)
  if (fileName.length > 255) {
    return { isValid: false, sanitized: sanitized.substring(0, 255), error: 'File name too long (max 255 characters)' };
  }

  return { isValid: true, sanitized, error: '' };
};

/**
 * Validate file size
 * @param {number} sizeInBytes - File size in bytes
 * @param {number} maxSizeMB - Maximum allowed size in MB (default 100MB)
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateFileSize = (sizeInBytes, maxSizeMB = 100) => {
  const maxBytes = maxSizeMB * 1024 * 1024;
  
  if (sizeInBytes > maxBytes) {
    return { 
      isValid: false, 
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB` 
    };
  }
  
  if (sizeInBytes === 0) {
    return { 
      isValid: false, 
      error: 'File is empty or corrupted' 
    };
  }
  
  return { isValid: true, error: '' };
};

/**
 * Validate file type by MIME type and extension
 * @param {File} file - File object
 * @param {Array<string>} allowedExtensions - Array of allowed extensions
 * @param {Array<string>} allowedMimeTypes - Array of allowed MIME types
 * @returns {object} - { isValid: boolean, error: string }
 */
export const validateFileType = (file, allowedExtensions = [], allowedMimeTypes = []) => {
  if (!file || !file.name) {
    return { isValid: false, error: 'Invalid file object' };
  }

  const fileName = file.name.toLowerCase();
  const fileExtension = fileName.split('.').pop();
  const mimeType = file.type.toLowerCase();

  // Check extension
  if (allowedExtensions.length > 0) {
    const hasValidExtension = allowedExtensions.some(ext => 
      fileName.endsWith(ext.toLowerCase())
    );
    
    if (!hasValidExtension) {
      return { 
        isValid: false, 
        error: `File type not allowed. Allowed types: ${allowedExtensions.join(', ')}` 
      };
    }
  }

  // Check MIME type
  if (allowedMimeTypes.length > 0 && mimeType) {
    const hasValidMimeType = allowedMimeTypes.some(mime => 
      mimeType.includes(mime.toLowerCase())
    );
    
    if (!hasValidMimeType) {
      return { 
        isValid: false, 
        error: 'File MIME type not allowed' 
      };
    }
  }

  return { isValid: true, error: '' };
};

/**
 * Comprehensive file validation
 * @param {File} file - File object to validate
 * @param {object} options - Validation options
 * @returns {object} - { isValid: boolean, errors: Array<string> }
 */
export const validateFile = (file, options = {}) => {
  const {
    maxSizeMB = 100,
    allowedExtensions = ['pdf', 'docx', 'doc', 'txt', 'jpg', 'jpeg', 'png', 'gif', 'bmp'],
    allowedMimeTypes = [
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
  } = options;

  const errors = [];

  // Validate file name
  const fileNameValidation = validateFileName(file.name);
  if (!fileNameValidation.isValid) {
    errors.push(fileNameValidation.error);
  }

  // Validate file size
  const sizeValidation = validateFileSize(file.size, maxSizeMB);
  if (!sizeValidation.isValid) {
    errors.push(sizeValidation.error);
  }

  // Validate file type
  const typeValidation = validateFileType(file, allowedExtensions, allowedMimeTypes);
  if (!typeValidation.isValid) {
    errors.push(typeValidation.error);
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedFileName: fileNameValidation.sanitized
  };
};

/**
 * Sanitize email input
 * @param {string} email - Email address
 * @returns {object} - { isValid: boolean, sanitized: string, error: string }
 */
export const sanitizeEmail = (email) => {
  if (typeof email !== 'string') {
    return { isValid: false, sanitized: '', error: 'Invalid email format' };
  }

  const sanitized = email.trim().toLowerCase();
  
  // Basic email regex validation
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (!emailRegex.test(sanitized)) {
    return { isValid: false, sanitized: '', error: 'Invalid email format' };
  }

  // Check for script injection attempts
  if (/<script|javascript:|onerror=/i.test(email)) {
    return { isValid: false, sanitized: '', error: 'Email contains invalid characters' };
  }

  return { isValid: true, sanitized, error: '' };
};

/**
 * Sanitize URL input
 * @param {string} url - URL string
 * @returns {object} - { isValid: boolean, sanitized: string, error: string }
 */
export const sanitizeURL = (url) => {
  if (typeof url !== 'string') {
    return { isValid: false, sanitized: '', error: 'Invalid URL format' };
  }

  const sanitized = url.trim();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
  const lowerUrl = sanitized.toLowerCase();
  
  if (dangerousProtocols.some(protocol => lowerUrl.startsWith(protocol))) {
    return { isValid: false, sanitized: '', error: 'URL protocol not allowed' };
  }

  // Ensure URL starts with http:// or https://
  if (!lowerUrl.startsWith('http://') && !lowerUrl.startsWith('https://')) {
    return { isValid: false, sanitized: '', error: 'URL must start with http:// or https://' };
  }

  try {
    new URL(sanitized);
    return { isValid: true, sanitized, error: '' };
  } catch (e) {
    return { isValid: false, sanitized: '', error: 'Invalid URL format' };
  }
};

/**
 * Validate and sanitize phone number
 * @param {string} phone - Phone number
 * @returns {object} - { isValid: boolean, sanitized: string, error: string }
 */
export const sanitizePhoneNumber = (phone) => {
  if (typeof phone !== 'string') {
    return { isValid: false, sanitized: '', error: 'Invalid phone number' };
  }

  // Remove all non-numeric characters except + and spaces
  const sanitized = phone.replace(/[^\d+\s()-]/g, '');

  // Check for script injection
  if (/<script|javascript:/i.test(phone)) {
    return { isValid: false, sanitized: '', error: 'Phone number contains invalid characters' };
  }

  // Basic validation: should have at least 10 digits
  const digitCount = sanitized.replace(/\D/g, '').length;
  if (digitCount < 10 || digitCount > 15) {
    return { isValid: false, sanitized, error: 'Phone number must have 10-15 digits' };
  }

  return { isValid: true, sanitized, error: '' };
};

/**
 * Validate numeric input
 * @param {any} value - Value to validate
 * @param {object} options - Validation options { min, max, allowFloat }
 * @returns {object} - { isValid: boolean, sanitized: number, error: string }
 */
export const validateNumericInput = (value, options = {}) => {
  const { min = -Infinity, max = Infinity, allowFloat = true } = options;

  const num = allowFloat ? parseFloat(value) : parseInt(value, 10);

  if (isNaN(num)) {
    return { isValid: false, sanitized: 0, error: 'Invalid numeric value' };
  }

  if (num < min) {
    return { isValid: false, sanitized: min, error: `Value must be at least ${min}` };
  }

  if (num > max) {
    return { isValid: false, sanitized: max, error: `Value must be at most ${max}` };
  }

  return { isValid: true, sanitized: num, error: '' };
};

/**
 * Rate limiting check (client-side)
 * @param {string} actionKey - Unique key for the action
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {object} - { allowed: boolean, remainingAttempts: number }
 */
export const checkRateLimit = (actionKey, maxAttempts = 5, windowMs = 60000) => {
  const storageKey = `ratelimit_${actionKey}`;
  const now = Date.now();

  try {
    const stored = localStorage.getItem(storageKey);
    const data = stored ? JSON.parse(stored) : { attempts: [], firstAttempt: now };

    // Remove attempts outside the time window
    data.attempts = data.attempts.filter(timestamp => now - timestamp < windowMs);

    if (data.attempts.length >= maxAttempts) {
      return { 
        allowed: false, 
        remainingAttempts: 0,
        resetTime: data.attempts[0] + windowMs
      };
    }

    // Add current attempt
    data.attempts.push(now);
    localStorage.setItem(storageKey, JSON.stringify(data));

    return { 
      allowed: true, 
      remainingAttempts: maxAttempts - data.attempts.length,
      resetTime: null
    };
  } catch (e) {
    // If localStorage fails, allow the action
    return { allowed: true, remainingAttempts: maxAttempts };
  }
};

export default {
  sanitizeTextInput,
  validateFileName,
  validateFileSize,
  validateFileType,
  validateFile,
  sanitizeEmail,
  sanitizeURL,
  sanitizePhoneNumber,
  validateNumericInput,
  checkRateLimit
};
