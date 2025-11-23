import React from 'react';
import renderBold from '../utils/renderBold';
import StrategyCards from './StrategyCards';

const PredictiveDisplay = ({ prediction }) => {
  if (!prediction) return null;

  // Some responses nest the useful data under `prediction.prediction`.
  const data = prediction.prediction || prediction;

  const strategies = data.strategies || [];
  const consequences = data.consequences_of_ignoring || data.consequences || [];
  const scenarios = (data.scenarios || []).filter(Boolean);
  const disclaimer = data.disclaimer || data.fine_print || prediction.disclaimer || '';
  const docType = prediction.document_type || data.document_type || '';
  const success = prediction.success !== undefined ? prediction.success : data.success;

  const severityColor = (outcome = '') => {
    if (/severe|high|critical/i.test(outcome)) return 'border-red-300 bg-red-50 text-red-800';
    if (/forced remediation|reputational|medium/i.test(outcome)) return 'border-yellow-300 bg-yellow-50 text-yellow-800';
    return 'border-indigo-200 bg-indigo-50 text-indigo-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      {/* <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Prediction{docType ? ` — ${docType}` : ''}</h2>
          {success !== undefined && (
            <div className={`mt-1 text-sm ${success ? 'text-green-700' : 'text-red-700'}`}>{success ? 'Success' : 'No'}</div>
          )}
        </div>
        {disclaimer && <div className="text-xs text-gray-400 italic">{disclaimer}</div>}
      </div> */}

      {/* Consequences */}
      {consequences && consequences.length > 0 && (
        <section>
          <div className="text-xl font-bold text-gray-800 mb-3">Consequences of Ignoring</div>
          <div className="grid gap-3">
            {consequences.map((c, idx) => (
              <div key={idx} className="flex items-start gap-4 rounded-md border p-3 bg-white shadow-sm">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center font-bold">{idx + 1}</div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{c.title}</div>
                  <div className="mt-1 text-sm text-gray-700">{c.description}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Strategies */}
      {strategies && strategies.length > 0 && (
        <section>
          <div className="text-xl  font-bold text-gray-800 mb-3">Recommended Strategies</div>
          <StrategyCards strategies={strategies} />
        </section>
      )}

      {/* Legacy scenarios fallback */}
      {scenarios && scenarios.length > 0 && (
        <section>
          <div className="text-sm font-semibold text-gray-600 mb-3">Scenarios</div>
          <div className="space-y-4">
            {scenarios.map((s, i) => (
              <article key={i} className={`relative flex flex-col md:flex-row items-stretch p-4 rounded-lg border ${severityColor(s.outcome)} shadow-sm bg-white`}>
                <div className="md:flex-shrink-0 md:w-48 flex items-start md:items-center mb-3 md:mb-0">
                  <div className="w-full">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Scenario {i + 1}</div>
                    <h3 className="mt-2 text-lg font-extrabold leading-tight text-blue-700">{s.outcome || `Scenario ${i + 1}`}</h3>
                  </div>
                </div>
                <div className="flex-1 md:pl-6 text-gray-700">
                  <p className="text-sm leading-relaxed text-gray-700" style={{ fontSize: '0.98rem', lineHeight: 1.6 }}>
                    <span className="whitespace-pre-wrap">{renderBold(s.reasoning)}</span>
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};

export default PredictiveDisplay;
