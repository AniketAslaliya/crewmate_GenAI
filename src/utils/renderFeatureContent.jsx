import Timeline from "../components/Timeline";
import MermaidMindMap from "../components/MermaidMindMap";
import PredictiveDisplay from '../components/PredictiveDisplay';
import FAQDisplay from '../components/FAQDisplay';
import CaseLawDisplay from '../components/CaseLawDisplay';

/**
 * Renders feature content from cached raw data
 * This function converts serializable data back into React components
 */
export const renderFeatureContent = (featureKey, rawData, notebook) => {
  if (!rawData) return null;

  // If rawData has a special error/empty marker
  if (rawData._isEmpty) {
    return <div className="text-sm text-gray-400">{rawData.message || 'No data available.'}</div>;
  }
  if (rawData._isError) {
    return <div className="text-sm text-red-400">{rawData.message || 'Error loading data.'}</div>;
  }

  try {
    switch (featureKey) {
      case 'summary':
        return renderSummary(rawData, notebook);
      case 'questions':
        return <FAQDisplay faq={rawData.faqMarkdown} />;
      case 'timeline':
        return renderTimeline(rawData);
      case 'predictive':
        return <PredictiveDisplay data={rawData.predictiveData} language={rawData.language} />;
      case 'case-law':
        return <CaseLawDisplay casesData={rawData.casesData} />;
      default:
        return <div className="text-sm text-gray-400">Unknown feature type.</div>;
    }
  } catch (error) {
    console.error('Error rendering feature content:', error);
    return <div className="text-sm text-red-400">Error rendering content.</div>;
  }
};

const renderSummary = (studyGuide, notebook) => {
  if (!studyGuide || typeof studyGuide !== 'object') {
    return <div className="text-sm text-gray-400">No study guide available.</div>;
  }

  return (
    <div className="study-guide space-y-6 p-4">
      {studyGuide.document_type && (
        <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
          {studyGuide.document_type}
        </span>
      )}
      
      <h1 className="text-2xl md:text-3xl font-bold text-[var(--palette-2)]">
        {studyGuide.title || notebook?.title || 'Study Guide'}
      </h1>
      
      {studyGuide.overview && (
        <p className="text-base text-gray-700 leading-relaxed">
          {studyGuide.overview}
        </p>
      )}

      {Array.isArray(studyGuide.structured_data) && studyGuide.structured_data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {studyGuide.structured_data.map((item, idx) => (
            <div key={idx} className="card bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 hover:shadow-md transition-shadow">
              <strong className="text-sm font-semibold text-[var(--palette-2)] block mb-2">
                {item.label}
              </strong>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {Array.isArray(studyGuide.critical_points) && studyGuide.critical_points.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--palette-2)] mb-3">
            Key Highlights
          </h3>
          <ul className="space-y-2 ml-4 list-disc">
            {studyGuide.critical_points.map((point, idx) => (
              <li key={idx} className="text-sm text-gray-700 leading-relaxed">
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legal Clauses Section */}
      {Array.isArray(studyGuide.explanations) && studyGuide.explanations.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[var(--border)]">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-bold text-[var(--palette-2)] mb-2">Legal Clauses Explained</h2>
            <p className="text-sm text-gray-600">Understanding key legal concepts and their implications</p>
          </div>
          <div className="space-y-4">
            {studyGuide.explanations.map((item, idx) => (
              <div key={idx} className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-4 md:p-5 hover:shadow-lg transition-all duration-200">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--palette-1)] text-white flex items-center justify-center font-semibold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-[var(--palette-2)] mb-2">
                      {item.clause_number ? `Clause ${item.clause_number}` : `Section ${idx + 1}`}
                      {item.title && <span className="ml-2 font-normal text-gray-600">— {item.title}</span>}
                    </h3>
                    {item.text && (
                      <div className="mb-3 p-3 bg-gray-50 rounded border-l-4 border-[var(--palette-1)]">
                        <p className="text-xs md:text-sm text-gray-700 italic leading-relaxed">{item.text}</p>
                      </div>
                    )}
                    {item.explanation && (
                      <p className="text-sm md:text-base text-gray-700 mb-3 leading-relaxed">{item.explanation}</p>
                    )}
                    {item.implication && (
                      <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
                        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide mb-1">Implication</p>
                        <p className="text-xs md:text-sm text-amber-900">{item.implication}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const renderTimeline = (rawData) => {
  const { view, mindmapCode, timelineMarkdown, message } = rawData;

  if (view === 'mindmap') {
    if (mindmapCode && typeof mindmapCode === 'string') {
      return (
        <div className="space-y-4 p-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--palette-2)] mb-2">Mind Map View</h3>
            <p className="text-sm text-gray-600">Visual representation of document structure and key concepts</p>
          </div>
          <MermaidMindMap chartCode={mindmapCode} />
        </div>
      );
    } else {
      return <div className="text-sm text-gray-400 italic">No mindmap data available.</div>;
    }
  } else {
    if (message) {
      return <div className="text-sm text-gray-400 italic">{message}</div>;
    } else if (timelineMarkdown && timelineMarkdown.trim()) {
      return <Timeline timelineMarkdown={timelineMarkdown} />;
    } else {
      return <div className="text-sm text-gray-400 italic">No timeline events found.</div>;
    }
  }
};
