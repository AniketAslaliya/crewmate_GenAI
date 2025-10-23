import { User } from "../models/User.js";
import { ConnectionRequest } from "../models/ConnectionRequest.js";
import { Chat } from "../models/Chat.js";

// List accepted incoming connections for a lawyer (return requests with status accepted and populate from)
export const listAcceptedForLawyer = async (req, res) => {
  try {
    const lawyerId = req.user.id;
    // populate the 'from' user and the associated chat (if any) so the frontend can distinguish private chats vs dossiers
    const requests = await ConnectionRequest.find({ to: lawyerId, status: 'accepted' })
      .populate('from', 'name email picture')
      .populate({ path: 'chat', select: 'title channel' });
    res.json({ connections: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

// List accepted outgoing connections for a helpseeker (return requests they've sent that are accepted)
export const listAcceptedForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await ConnectionRequest.find({ from: userId, status: 'accepted' })
      .populate('to', 'name email picture')
      .populate({ path: 'chat', select: 'title channel' });
    res.json({ connections: requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

export const listLawyers = async (req, res) => {
  try {
    // Only return lawyers who completed onboarding
    const lawyers = await User.find({ role: "lawyer", isOnboarded: true }).select("name picture bio specialties location city yearsExperience fee modes languages courts verified rating freeFirst firmType education successRate responseTimeHours organization");
    res.json({ lawyers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const onboardLawyer = async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      bio,
      phone,
      specialties,
      location,
      city,
      yearsExperience,
      fee,
      modes,
      languages,
      courts,
      verified,
      rating,
      freeFirst,
      firmType,
      education,
      successRate,
      responseTimeHours,
      organization,
    } = req.body;

    const update = {
      role: "lawyer",
      bio,
      phone,
      specialties,
      location,
      city,
      yearsExperience,
      fee,
      modes,
      languages,
      courts,
      verified,
      rating,
      freeFirst,
      firmType,
      education,
      successRate,
      responseTimeHours,
      organization,
      isOnboarded: true,
    };

    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const createConnectionRequest = async (req, res) => {
  try {
    const from = req.user.id; // helpseeker
    const { to, message } = req.body; // to = lawyer id
    // Prevent duplicate outstanding requests (requested or accepted) from same user to same lawyer
    const existing = await ConnectionRequest.findOne({ from, to, status: { $in: ['requested','accepted'] } });
    if (existing) return res.status(400).json({ error: 'You already have an active request to this lawyer' });
    const reqDoc = await ConnectionRequest.create({ from, to, message });
    res.json({ request: reqDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const listRequestsForUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const requests = await ConnectionRequest.find({ from: userId }).populate('to', 'name email picture');
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};

export const listRequestsForLawyer = async (req, res) => {
  try {
    const lawyerId = req.user.id;
    const requests = await ConnectionRequest.find({ to: lawyerId, status: "requested" }).populate("from", "name email picture");
    res.json({ requests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { id } = req.params; // request id
    const requestDoc = await ConnectionRequest.findById(id);
    if (!requestDoc) return res.status(404).json({ error: "not found" });

    // authorization: only the intended lawyer can accept
    if (requestDoc.to.toString() !== req.user.id) {
      return res.status(403).json({ error: 'forbidden' });
    }

    // create chat between users
  const chat = await Chat.create({ user: requestDoc.from, title: `Chat: ${requestDoc.from} <> ${requestDoc.to}`, channel: 'private' });
    requestDoc.status = "accepted";
    requestDoc.chat = chat._id;
    await requestDoc.save();

    res.json({ request: requestDoc, chat });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server" });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const requestDoc = await ConnectionRequest.findById(id);
    if (!requestDoc) return res.status(404).json({ error: 'not found' });
    if (requestDoc.to.toString() !== req.user.id) return res.status(403).json({ error: 'forbidden' });
    requestDoc.status = 'rejected';
    await requestDoc.save();
    res.json({ request: requestDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server' });
  }
};
