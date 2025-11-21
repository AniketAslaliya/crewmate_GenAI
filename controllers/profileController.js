import { uploadToGCS, deleteFromGCS } from '../utils/gcs.js';
import { User } from '../models/User.js';

/**
 * Upload/Update profile image
 * POST /auth/profile/upload-image
 */
export const uploadProfileImage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!userId || userId === 'guest') {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete old profile image if exists
    if (user.profileImage?.gcsPath) {
      try {
        await deleteFromGCS(user.profileImage.gcsPath);
      } catch (error) {
        console.warn('Failed to delete old profile image:', error);
      }
    }

    // Upload new profile image to GCS
    const gcsResult = await uploadToGCS(
      req.file.buffer,
      `profile_${Date.now()}_${req.file.originalname}`,
      'profile-images',
      userId.toString()
    );

    // Update user profile
    user.profileImage = {
      gcsPath: gcsResult.path,
      gcsUrl: gcsResult.url,
      uploadedAt: new Date()
    };
    user.picture = gcsResult.url; // Also update the picture field for backward compatibility
    await user.save();

    res.json({
      success: true,
      profileImage: user.profileImage,
      message: 'Profile image uploaded successfully'
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({ 
      message: 'Failed to upload profile image',
      error: error.message 
    });
  }
};

/**
 * Delete profile image
 * DELETE /auth/profile/delete-image
 */
export const deleteProfileImage = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id || req.user;

    if (!userId || userId === 'guest') {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete from GCS
    if (user.profileImage?.gcsPath) {
      try {
        await deleteFromGCS(user.profileImage.gcsPath);
      } catch (error) {
        console.warn('Failed to delete from GCS:', error);
      }
    }

    // Clear profile image
    user.profileImage = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    console.error('Delete profile image error:', error);
    res.status(500).json({ 
      message: 'Failed to delete profile image',
      error: error.message 
    });
  }
};
