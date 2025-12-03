
import React, { useState, useEffect } from 'react';

interface SearchBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchTerm, setSearchTerm }) => {
  const [localTerm, setLocalTerm] = useState(searchTerm);

  // Update local state when prop changes (e.g. from Reset Filters button or URL load)
  useEffect(() => {
    setLocalTerm(searchTerm);
  }, [searchTerm]);

  // Debounce logic: Update parent state only after user stops typing for 500ms
  useEffect(() => {
    const handler = setTimeout(() => {
      // Only update if the value actually changed to prevent loops
      if (localTerm !== searchTerm) {
        setSearchTerm(localTerm);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [localTerm, setSearchTerm, searchTerm]);

  return (
    <div className="relative w-full">
      <label htmlFor="search-input" className="sr-only">Căutare produs</label>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </div>
      <input
        id="search-input"
        type="text"
        value={localTerm}
        onChange={(e) => setLocalTerm(e.target.value)}
        placeholder="Căutați după nume, cod, EAN..."
        className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
      />
    </div>
  );
};

export default SearchBar;
