import React from 'react';
import renderBold from '../utils/renderBold';

const CaseLawCard = ({ c }) => {
  const title = c.case_name || c.title || c.name || c.head || 'Untitled Case';
  const citation = c.citation || c.cite || c.citation_string || c.ref || '';
  const summary = c.summary || c.snippet || c.excerpt || c.content || c.description || '';
  // relevance may be a numeric score or a descriptive string
  const score = (typeof c.relevance === 'number' ? c.relevance : (c.score || c.rank || null));
  const court = c.court || c.jurisdiction || c.court_name || '';
  const date = c.date || c.decision_date || '';
  const link = c.link || c.url || c.href || c.reference || null;

  return (
    <article className="p-4 rounded-lg border bg-white shadow-sm">
      {/* Title at top */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-700">{title}</h3>
          {citation && <div className="text-xs text-gray-500 mt-1">{citation}</div>}
        </div>
      </div>

      {/* Summary / snippet */}
      {summary && (
        <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap" style={{ lineHeight: 1.55 }}>{renderBold(summary)}</p>
      )}

      {/* Additional details: court, date, relevance and link */}
      <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-xs text-gray-500">
          {court && <span>{court}</span>}
          {court && date && <span className="mx-2">•</span>}
          {date && <span>{isNaN(new Date(date).getTime()) ? date : new Date(date).toLocaleDateString()}</span>}
        </div>

        <div className="flex items-center gap-3">
          {c.relevance && typeof c.relevance === 'string' && (
            <div className="text-sm text-gray-600"><strong>Why relevant:</strong> {renderBold(c.relevance)}</div>
          )}

          {score != null && (
            <div className="text-sm font-bold text-gray-700">{typeof score === 'number' ? `${(score * 100).toFixed(0)}%` : score}</div>
          )}

          {link ? (
            <a href={link} target="_blank" rel="noreferrer" className="text-sm text-indigo-600 underline">View source</a>
          ) : null}
        </div>
      </div>
    </article>
  );
};

const CaseLawDisplay = ({ cases }) => {
  if (!cases || !Array.isArray(cases) || cases.length === 0) return <div className="text-sm text-gray-400">No relevant cases found.</div>;

  return (
    <div className="space-y-4">
      {cases.map((c, idx) => (
        <CaseLawCard key={idx} c={c} />
      ))}
    </div>
  );
};

export default CaseLawDisplay;
