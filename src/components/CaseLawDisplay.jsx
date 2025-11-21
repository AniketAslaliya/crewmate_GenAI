import React, { useState } from 'react';
import { motion } from 'framer-motion';
import renderBold from '../utils/renderBold';

const CaseLawCard = ({ c, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const title = c.case_name || c.title || c.name || c.head || 'Untitled Case';
  const citation = c.citation || c.cite || c.citation_string || c.ref || '';
  const summary = c.summary || c.snippet || c.excerpt || c.content || c.description || '';
  const score = (typeof c.relevance === 'number' ? c.relevance : (c.score || c.rank || null));
  const court = c.court || c.jurisdiction || c.court_name || '';
  const date = c.date || c.decision_date || '';
  const link = c.link || c.url || c.href || c.reference || null;

  // Determine relevance badge color
  const getRelevanceBadge = () => {
    if (score == null) return null;
    const numericScore = typeof score === 'number' ? score : parseFloat(score);
    
    if (!isNaN(numericScore)) {
      const percentage = (numericScore * 100).toFixed(0);
      let colorClass = 'bg-gray-100 text-gray-700';
      
      if (numericScore >= 0.8) {
        colorClass = 'bg-green-100 text-green-700 border-green-200';
      } else if (numericScore >= 0.6) {
        colorClass = 'bg-blue-100 text-blue-700 border-blue-200';
      } else if (numericScore >= 0.4) {
        colorClass = 'bg-yellow-100 text-yellow-700 border-yellow-200';
      } else {
        colorClass = 'bg-orange-100 text-orange-700 border-orange-200';
      }
      
      return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClass}`}>
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {percentage}% Match
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
        {score}
      </span>
    );
  };

  // Truncate summary for preview
  const truncatedSummary = summary.length > 200 ? summary.substring(0, 200) + '...' : summary;
  const shouldShowExpand = summary.length > 200;

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="group relative bg-gradient-to-br from-white to-blue-50/30 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden"
    >
      {/* Accent border on left */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-600" />
      
      <div className="p-5 md:p-6 pl-7">
        {/* Header Section */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            {/* Case Number Badge */}
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white text-sm font-bold shadow-sm">
                {index + 1}
              </span>
              {getRelevanceBadge()}
            </div>
            
            {/* Title */}
            <h3 className="text-lg md:text-xl font-bold text-gray-900 leading-tight mb-2 group-hover:text-blue-700 transition-colors">
              {title}
            </h3>
            
            {/* Citation */}
            {citation && (
              <div className="inline-flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium">{citation}</span>
              </div>
            )}
          </div>
        </div>

        {/* Summary Section */}
        {summary && (
          <div className="mb-4">
            <div className="bg-white rounded-lg p-4 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Summary</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {renderBold(isExpanded ? summary : truncatedSummary)}
              </p>
              {shouldShowExpand && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <span>Show less</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </>
                  ) : (
                    <>
                      <span>Read more</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Section - Metadata & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-gray-100">
          {/* Left side - Court & Date */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
            {court && (
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="font-medium">{court}</span>
              </div>
            )}
            {date && (
              <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-200">
                <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">
                  {isNaN(new Date(date).getTime()) ? date : new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
          </div>

          {/* Right side - Relevance Text & Link */}
          <div className="flex items-center gap-3">
            {c.relevance && typeof c.relevance === 'string' && (
              <div className="text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md border border-blue-100">
                <span className="font-semibold">Relevance:</span> {renderBold(c.relevance)}
              </div>
            )}
            
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>View Case</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.article>
  );
};

const CaseLawDisplay = ({ cases }) => {
  if (!cases || !Array.isArray(cases) || cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-base font-medium text-gray-600">No Relevant Cases Found</p>
        <p className="text-sm text-gray-500 mt-1">Try adjusting your search criteria or document content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-2 md:p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            Suggested Case Law
          </h2>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
            {cases.length} {cases.length === 1 ? 'Case' : 'Cases'}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          AI-powered case law suggestions based on your document analysis
        </p>
      </div>

      {/* Cases List */}
      <div className="space-y-5">
        {cases.map((c, idx) => (
          <CaseLawCard key={idx} c={c} index={idx} />
        ))}
      </div>
    </div>
  );
};

export default CaseLawDisplay;
