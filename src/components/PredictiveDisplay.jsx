import React from 'react';
import renderBold from '../utils/renderBold';

const PredictiveDisplay = ({ prediction }) => {
  if (!prediction) return null;
  const scenarios = prediction.scenarios || [];
  const disclaimer = prediction.disclaimer || prediction.fine_print || '';

  const severityColor = (outcome = '') => {
    if (/severe|high|critical/i.test(outcome)) return 'border-red-300 bg-red-50 text-red-800';
    if (/forced remediation|reputational|medium/i.test(outcome)) return 'border-yellow-300 bg-yellow-50 text-yellow-800';
    return 'border-indigo-200 bg-indigo-50 text-indigo-800';
  };

  return (
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
      {disclaimer && (
        <div className="mt-2 text-xs text-gray-400 italic">{disclaimer}</div>
      )}
    </div>
  );
};

export default PredictiveDisplay;
