import SupportMessage from '../models/SupportMessage.js';
import { User } from '../models/User.js';

// Create a new support message
export const createSupportMessage = async (req, res) => {
  try {
    const { subject, message } = req.body;
    const userId = req.user.id;

    if (!subject || !message) {
      return res.status(400).json({ error: 'Subject and message are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const supportMessage = await SupportMessage.create({
      user: userId,
      name: user.name,
      email: user.email,
      subject,
      message,
      status: 'pending',
      priority: 'medium'
    });

    return res.status(201).json({
      success: true,
      message: 'Support message sent successfully. Our team will get back to you soon.',
      supportMessage
    });
  } catch (error) {
    console.error('Error creating support message:', error);
    return res.status(500).json({ error: 'Failed to send support message' });
  }
};

// Get user's own support messages
export const getUserSupportMessages = async (req, res) => {
  try {
    const userId = req.user.id;

    const messages = await SupportMessage.find({ user: userId })
      .sort({ createdAt: -1 })
      .select('-adminNotes');

    return res.json({ messages });
  } catch (error) {
    console.error('Error fetching user support messages:', error);
    return res.status(500).json({ error: 'Failed to fetch support messages' });
  }
};

// Admin: Get all support messages
export const getAllSupportMessages = async (req, res) => {
  try {
    const { status, priority } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const messages = await SupportMessage.find(filter)
      .populate('user', 'name email picture profileImage role phone')
      .populate('resolvedBy', 'name email')
      .sort({ createdAt: -1 });

    return res.json({ messages });
  } catch (error) {
    console.error('Error fetching all support messages:', error);
    return res.status(500).json({ error: 'Failed to fetch support messages' });
  }
};

// Admin: Get single support message with user details
export const getSupportMessageById = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await SupportMessage.findById(id)
      .populate('user', 'name email picture profileImage role phone bio location specialties')
      .populate('resolvedBy', 'name email');

    if (!message) {
      return res.status(404).json({ error: 'Support message not found' });
    }

    return res.json({ message });
  } catch (error) {
    console.error('Error fetching support message:', error);
    return res.status(500).json({ error: 'Failed to fetch support message' });
  }
};

// Admin: Update support message status
export const updateSupportMessageStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes } = req.body;
    const adminId = req.user.id;

    const updateData = {};
    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = adminId;
    }

    const message = await SupportMessage.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('user', 'name email picture profileImage');

    if (!message) {
      return res.status(404).json({ error: 'Support message not found' });
    }

    return res.json({ 
      success: true,
      message: 'Support message updated successfully',
      supportMessage: message
    });
  } catch (error) {
    console.error('Error updating support message:', error);
    return res.status(500).json({ error: 'Failed to update support message' });
  }
};

// Admin: Delete support message
export const deleteSupportMessage = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await SupportMessage.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({ error: 'Support message not found' });
    }

    return res.json({ 
      success: true,
      message: 'Support message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting support message:', error);
    return res.status(500).json({ error: 'Failed to delete support message' });
  }
};
