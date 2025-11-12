
import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
  className?: string;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  className = '',
}) => {
  if (totalItems === 0 || totalItems <= itemsPerPage && itemsPerPage !== 0) {
    return null;
  }

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
      window.scrollTo(0, 0);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
      window.scrollTo(0, 0);
    }
  };

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onItemsPerPageChange(Number(e.target.value));
  };
  
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = itemsPerPage === 0 ? totalItems : Math.min(startItem + itemsPerPage - 1, totalItems);

  return (
    <nav className={`bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow-md ${className}`} aria-label="Pagination">
      <div className="hidden sm:block">
        <p className="text-sm text-gray-700">
          Afișare de la <span className="font-medium">{itemsPerPage === 0 ? 1 : startItem}</span> la <span className="font-medium">{endItem}</span> din{' '}
          <span className="font-medium">{totalItems}</span> rezultate
        </p>
      </div>
      <div className="flex-1 flex justify-between sm:justify-end items-center">
        <div className="mr-4">
            <label htmlFor="items-per-page" className="text-sm font-medium text-gray-700 mr-2">Produse/pagină:</label>
            <select
                id="items-per-page"
                value={itemsPerPage}
                onChange={handleItemsPerPageChange}
                className="py-2 pl-3 pr-8 border border-gray-300 rounded-md leading-5 bg-white text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
            >
                <option value="16">16</option>
                <option value="24">24</option>
                <option value="48">48</option>
                <option value="0">Toate</option>
            </select>
        </div>
        <div className="flex items-center space-x-2">
             <button
                onClick={handlePrev}
                disabled={currentPage === 1 || totalPages === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Anterior
              </button>
              <span className="text-sm text-gray-700 px-2 hidden md:inline-block">
                Pagina <span className="font-medium">{currentPage}</span> din <span className="font-medium">{totalPages}</span>
              </span>
              <button
                onClick={handleNext}
                disabled={currentPage === totalPages || totalPages === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Următor
              </button>
        </div>
      </div>
    </nav>
  );
};

export default Pagination;