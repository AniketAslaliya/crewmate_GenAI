import React from 'react';
import { motion } from 'framer-motion';

// Pure, memoized filters container. Parent should pass stable callbacks (useCallback)
const FilterSection = React.memo(({ title, children }) => (
  <motion.div className="border-b border-gray-200 pb-4 mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <h3 className="font-semibold text-gray-900 mb-3 flex items-center justify-between">{title}</h3>
    {children}
  </motion.div>
));

const FiltersContainer = ({ filters, onFilterChange, onReset, show = true, onClose, counts = {} }) => {
  return (
    <motion.aside initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} className={`lg:w-80 ${show ? 'block' : 'hidden lg:block'}`}>
      <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-lg border border-white/20 p-6 sticky top-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Filters</h2>
          <div className="flex items-center gap-2">
            {onClose && (
              <button onClick={onClose} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
                Close
              </button>
            )}
            <button onClick={onReset} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Reset All</button>
          </div>
        </div>

        <div className="filter-sections-wrapper">
          <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            <FilterSection title="Search">
              <input
                value={filters.query}
                onChange={e => onFilterChange('query', e.target.value)}
                placeholder="Search by name, specialty..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </FilterSection>

            <FilterSection title="Location & Specialization">
              <div className="space-y-3">
                <input
                  value={filters.city}
                  onChange={e => onFilterChange('city', e.target.value)}
                  placeholder="City e.g. Mumbai"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  list="city-list"
                />
                <input
                  value={filters.specialization}
                  onChange={e => onFilterChange('specialization', e.target.value)}
                  placeholder="Specialization e.g. Criminal"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </FilterSection>

            <FilterSection title="Experience">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Min Experience</label>
                  <input
                    value={filters.minExp}
                    onChange={e => onFilterChange('minExp', e.target.value)}
                    type="number"
                    min="0"
                    placeholder="Years"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </FilterSection>

            <FilterSection title="Fee Range">
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={filters.feeMin}
                    onChange={e => onFilterChange('feeMin', e.target.value)}
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    className="w-1/2 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <input
                    value={filters.feeMax}
                    onChange={e => onFilterChange('feeMax', e.target.value)}
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    className="w-1/2 px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </FilterSection>

            <FilterSection title="Additional Filters">
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Consultation Mode</label>
                  <select
                    value={filters.modeFilter}
                    onChange={e => onFilterChange('modeFilter', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Any Mode</option>
                    <option value="in-person">In-person</option>
                    <option value="video">Video Call</option>
                    <option value="chat">Chat</option>
                    <option value="phone">Phone</option>
                  </select>
                </div>

                
              </div>
            </FilterSection>


          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default React.memo(FiltersContainer);
