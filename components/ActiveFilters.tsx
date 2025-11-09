
import React from 'react';
import { Filters } from '../types';

interface ActiveFiltersProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  initialFilters: Filters;
  onReset: () => void;
}

const filterLabels: Record<keyof Omit<Filters, 'searchTerm'>, string> = {
  Brand: 'Brand',
  Finish: 'Culoare',
  Size: 'Diametru (R)',
  PCD: 'PCD',
  ProductType: 'Tip Produs',
  Width: 'Lățime',
  Offset: 'Offset (ET)',
  Width_Front: 'Lățime Față',
  Offset_Front: 'Offset Față',
  Width_Rear: 'Lățime Spate',
  Offset_Rear: 'Offset Spate',
};

const ActiveFilters: React.FC<ActiveFiltersProps> = ({ filters, setFilters, initialFilters, onReset }) => {
  
  const handleRemoveFilter = (key: keyof Filters) => {
    setFilters(prev => ({ ...prev, [key]: initialFilters[key] }));
  };

  const activeFilterEntries = Object.entries(filters).filter(([key, value]) => {
    return value !== initialFilters[key as keyof Filters] && value !== '';
  });

  if (activeFilterEntries.length === 0) {
    return null; // Don't render anything if no filters are active
  }

  return (
    <div className="mb-6 p-3 bg-gray-50 border rounded-lg shadow-inner">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-700 mr-2">Filtre Active:</span>
        {activeFilterEntries.map(([key, value]) => (
          <span
            key={key}
            className="flex items-center bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full"
            aria-label={`Filtru activ: ${filterLabels[key as keyof typeof filterLabels] || 'Căutare'} este ${value}`}
          >
            {key === 'searchTerm' ? `Căutare: "${value}"` : `${filterLabels[key as keyof typeof filterLabels]}: ${value}`}
            <button
              onClick={() => handleRemoveFilter(key as keyof Filters)}
              className="ml-2 -mr-1 p-0.5 rounded-full text-blue-500 hover:bg-red-200 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
              aria-label={`Anulează filtrul ${filterLabels[key as keyof typeof filterLabels] || 'Căutare'}`}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </span>
        ))}
        {activeFilterEntries.length > 1 && (
             <button 
                onClick={onReset}
                className="ml-auto text-sm font-semibold text-gray-600 hover:text-red-600 transition-colors px-3 py-1 rounded-md hover:bg-red-100"
            >
                Anulează Tot
            </button>
        )}
      </div>
    </div>
  );
};

export default ActiveFilters;
