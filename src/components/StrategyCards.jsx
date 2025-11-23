import React, { useState } from 'react';

export default function StrategyCards({ strategies = [] }) {
  const [done, setDone] = useState({});

  function toggleDone(idx) {
    setDone(prev => ({ ...prev, [idx]: !prev[idx] }));
  }

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        {strategies.map((s, i) => (
          <article
            key={i}
            className={`w-full flex items-center gap-4 rounded-lg border p-4 shadow-sm ${done[i] ? 'border-green-200 bg-green-50/50' : 'bg-white'}`}
            role="region"
            aria-labelledby={`strategy-title-${i}`}
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-md shrink-0 ${done[i] ? 'bg-green-600 text-white' : 'bg-indigo-50 text-indigo-600'}`} aria-hidden>
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 18h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 21h4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 2a7 7 0 00-4 12.2V16a2 2 0 002 2h4a2 2 0 002-2v-1.8A7 7 0 0012 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="flex-1">
              <strong id={`strategy-title-${i}`} className="text-lg font-semibold text-gray-800">{s.title}</strong>
              <p className="mt-1 text-sm text-gray-700">{s.reasoning}</p>
              <div className="mt-3">
                <strong className="text-lg font-semibold text-gray-800">Action</strong>
                <h4 className="mt-1 text-base  text-gray-700 whitespace-pre-wrap">{s.action_item}</h4>
              </div>
            </div>

           
          </article>
        ))}
      </div>
    </div>
  );
}
