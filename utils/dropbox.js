import { Dropbox } from 'dropbox';

// Initialize Dropbox client
const dbx = new Dropbox({
  accessToken: process.env.DROPBOX_ACCESS_TOKEN
});

/**
 * Upload file to Dropbox
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} filename - Original filename
 * @param {string} folder - Folder path (e.g., '/lawyer-docs')
 * @returns {Promise<{url: string, path: string}>}
 */
export const uploadToDropbox = async (fileBuffer, filename, folder = '/lawyer-docs') => {
  try {
    const dbx = await getDropboxClient();
    const path = `${folder}/${Date.now()}_${filename}`;
    
    // Upload file
    const response = await dbx.filesUpload({
      path: path,
      contents: fileBuffer,
      mode: 'add',
      autorename: true,
      mute: false
    });

    // Create shared link for the file
    let sharedLink;
    try {
      const linkResponse = await dbx.sharingCreateSharedLinkWithSettings({
        path: response.result.path_display,
        settings: {
          requested_visibility: 'public'
        }
      });
      sharedLink = linkResponse.result.url.replace('?dl=0', '?raw=1'); // Direct link
    } catch (linkError) {
      // If shared link already exists, get it
      if (linkError.error?.error?.['.tag'] === 'shared_link_already_exists') {
        const existingLinks = await dbx.sharingListSharedLinks({
          path: response.result.path_display
        });
        if (existingLinks.result.links.length > 0) {
          sharedLink = existingLinks.result.links[0].url.replace('?dl=0', '?raw=1');
        }
      } else {
        throw linkError;
      }
    }

    return {
      url: sharedLink,
      path: response.result.path_display,
      filename: response.result.name
    };
  } catch (error) {
    console.error('Dropbox upload error:', error);
    throw new Error('Failed to upload file to Dropbox');
  }
};

/**
 * Delete file from Dropbox
 * @param {string} path - File path in Dropbox
 * @returns {Promise<void>}
 */
export const deleteFromDropbox = async (path) => {
  try {
    const dbx = await getDropboxClient();
    await dbx.filesDeleteV2({ path });
  } catch (error) {
    console.error('Dropbox delete error:', error);
    // Don't throw error if file doesn't exist
    if (error.error?.error?.['.tag'] !== 'path_lookup') {
      throw new Error('Failed to delete file from Dropbox');
    }
  }
};

/**
 * Get temporary download link for a file
 * @param {string} path - File path in Dropbox
 * @returns {Promise<string>}
 */
export const getTemporaryLink = async (path) => {
  try {
    const dbx = await getDropboxClient();
    const response = await dbx.filesGetTemporaryLink({ path });
    return response.result.link;
  } catch (error) {
    console.error('Dropbox get link error:', error);
    throw new Error('Failed to get download link');
  }
};
