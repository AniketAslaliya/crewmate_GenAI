import React from 'react';

// Accepts either a markdown string in the format used by the backend (### Q: ...\n\nA: ...)
// or an array of { question, answer } objects.
const parseFaqMarkdown = (md) => {
  // Parse pairs like:
  // ### Q: question text
  //
  // A: answer text
  if (!md || typeof md !== 'string') return [];
  const pairs = [];
  // Use a regex to capture Q/A blocks even if split by blank lines
  const re = /### Q:\s*([\s\S]*?)\s*\n\s*\n\s*A:\s*([\s\S]*?)(?=\n### Q:|$)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const question = (m[1] || '').trim();
    const answer = (m[2] || '').trim();
    if (question) pairs.push({ question, answer });
  }
  return pairs;
};

const FAQDisplay = ({ faq }) => {
  // faq can be string markdown or array
  let items = [];
  if (Array.isArray(faq)) items = faq;
  else if (typeof faq === 'string') items = parseFaqMarkdown(faq);
  else if (faq && faq.faq_markdown) items = parseFaqMarkdown(faq.faq_markdown);

  if (!items.length) return <div className="text-sm text-gray-500">No FAQ available.</div>;

  const escapeHtml = (unsafe) => {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const formatAnswerHtml = (text) => {
    if (!text && text !== 0) return '';
    let out = escapeHtml(text);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\n/g, '<br/>');
    return out;
  };

  return (
    <div className="space-y-4">
      {items.map((it, idx) => (
        <div key={idx} className="p-4 bg-white border border-gray-100 rounded-md shadow-sm">
          <div className="text-sm font-semibold text-gray-800">Q: {it.question}</div>
          <div className="mt-2 text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatAnswerHtml(it.answer) }} />
        </div>
      ))}
    </div>
  );
};

export default FAQDisplay;
