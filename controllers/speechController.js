// Speech features removed. Export a stub to keep old imports safe but inactive.
export const transcribeHindi = async (req, res) => {
  return res.status(404).json({ error: 'Speech transcription is disabled on this server' });
};
