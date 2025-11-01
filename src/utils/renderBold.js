import React from 'react';

// Render text and convert **bold** markers into <strong> elements.
// Returns React nodes (string or array of nodes). Preserves input when not string.
const renderBold = (content) => {
  if (content === null || content === undefined) return null;
  if (typeof content !== 'string') return content;

  const parts = content.split(/(\*\*(?:[\s\S]*?)\*\*)/g);
  return parts.map((part, idx) => {
    const m = part.match(/^\*\*(?:\s*)([\s\S]*?)(?:\s*)\*\*$/);
    if (m) return <strong key={idx} className="font-semibold">{m[1]}</strong>;
    return <span key={idx}>{part}</span>;
  });
};

export default renderBold;
