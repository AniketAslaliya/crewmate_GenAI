import api from '../Axios/axios';

class ProfileService {
  /**
   * Upload profile image
   * @param {File} imageFile - Image file
   * @returns {Promise<Object>}
   */
  async uploadProfileImage(imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post('/auth/profile/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    return response.data;
  }

  /**
   * Delete profile image
   * @returns {Promise<Object>}
   */
  async deleteProfileImage() {
    const response = await api.delete('/auth/profile/delete-image');
    return response.data;
  }
}

const profileService = new ProfileService();

// Named exports for convenience
export const uploadProfileImage = (imageFile) => profileService.uploadProfileImage(imageFile);
export const deleteProfileImage = () => profileService.deleteProfileImage();

export default profileService;
