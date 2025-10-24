import React from 'react';
import SearchBar from './SearchBar';
import { Filters, AvailableOptions, FilterMode } from '../types';

interface FilterControlsProps {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  availableOptions: AvailableOptions;
  onReset: () => void;
  filterMode: FilterMode;
  setFilterMode: React.Dispatch<React.SetStateAction<FilterMode>>;
}

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  setFilters,
  availableOptions,
  onReset,
  filterMode,
  setFilterMode,
}) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSearchChange = (term: string) => {
    setFilters(prev => ({ ...prev, searchTerm: term }));
  };

  const handleModeChange = (newMode: FilterMode) => {
    if (newMode === filterMode) return;
    setFilterMode(newMode);

    if (newMode === 'standard') {
      setFilters(prev => ({
        ...prev,
        Width_Front: 'all', Offset_Front: 'all',
        Width_Rear: 'all', Offset_Rear: 'all',
      }));
    } else {
      setFilters(prev => ({ ...prev, Width: 'all', Offset: 'all' }));
    }
  };

  const renderSelect = (name: keyof Omit<Filters, 'searchTerm'>, label: string, options: string[], disabled: boolean = false) => (
    <div>
        <label htmlFor={`${name}-select`} className="sr-only">{label}</label>
        <select
          id={`${name}-select`}
          name={name}
          value={filters[name]}
          onChange={handleInputChange}
          className="block w-full h-full px-3 py-3 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm disabled:bg-gray-100"
          disabled={disabled}
        >
          <option value="all">{label}</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
    </div>
  );
  
  const ModeButton: React.FC<{mode: FilterMode; label: string}> = ({ mode, label }) => (
      <button
        onClick={() => handleModeChange(mode)}
        className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
          filterMode === mode
            ? 'bg-blue-600 text-white shadow'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`}
      >
        {label}
      </button>
  );

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mb-8 space-y-4">
      {/* Search and Base Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
            <SearchBar searchTerm={filters.searchTerm} setSearchTerm={handleSearchChange} />
        </div>
        {renderSelect('Brand', 'Toate Brandurile', availableOptions.Brand)}
        {renderSelect('Finish', 'Toate Culorile', availableOptions.Finish)}
      </div>
      
      {/* Mode Switcher */}
      <div className="flex items-center justify-center space-x-2 border-t pt-4">
        <ModeButton mode="standard" label="Standard" />
        <ModeButton mode="staggered" label="Față - Spate" />
      </div>

      {/* Conditional Filters */}
      {filterMode === 'standard' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {renderSelect('Size', 'Toate Diametrele (R)', availableOptions.Size)}
          {renderSelect('Width', 'Toate Lățimile', availableOptions.Width)}
          {renderSelect('PCD', 'Toate PCD-urile', availableOptions.PCD)}
          {renderSelect('Offset', 'Toate Offset-urile', availableOptions.Offset)}
        </div>
      ) : (
        <div className="space-y-4 pt-4 border-t border-dashed">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderSelect('Size', 'Toate Diametrele (R)', availableOptions.Size)}
            {renderSelect('PCD', 'Toate PCD-urile', availableOptions.PCD)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div className="p-3 border rounded-lg bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 mb-2 text-center md:text-left">Față</h3>
              <div className="grid grid-cols-2 gap-4">
                {renderSelect('Width_Front', 'Lățime Față', availableOptions.Width_Front)}
                {renderSelect('Offset_Front', 'Offset Față', availableOptions.Offset_Front)}
              </div>
            </div>
            <div className="p-3 border rounded-lg bg-gray-50/50">
              <h3 className="font-semibold text-gray-700 mb-2 text-center md:text-left">Spate</h3>
              <div className="grid grid-cols-2 gap-4">
                {renderSelect('Width_Rear', 'Lățime Spate', availableOptions.Width_Rear)}
                {renderSelect('Offset_Rear', 'Offset Spate', availableOptions.Offset_Rear)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Button */}
      <div className="flex justify-end pt-2 border-t mt-4">
            <button 
                onClick={onReset}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm font-semibold shadow-sm"
            >
                Resetează Toate Filtrele
            </button>
      </div>
    </div>
  );
};

export default FilterControls;
