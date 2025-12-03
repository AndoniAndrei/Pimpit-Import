
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Product } from './types';
import ProductCard from './components/ProductCard';
import FilterControls from './components/FilterControls';
import ActiveFilters from './components/ActiveFilters';
import Spinner from './components/Spinner';
import Pagination from './components/Pagination';
import ErrorNotification from './components/ErrorNotification';
import { useProductsData } from './hooks/useProductsData';
import { useProductFilters } from './hooks/useProductFilters';

const ProductModal = lazy(() => import('./components/ProductModal'));

const App: React.FC = () => {
  // Use custom hooks for data and filtering logic
  const { products, loading, loadingMessage, sourceErrors, isUsingDatabase, isSyncing } = useProductsData();
  const { 
    filters, 
    setFilters, 
    filterMode, 
    setFilterMode, 
    availableOptions, 
    filteredProducts, 
    handleResetFilters, 
    isAnyFilterActive,
    initialFilters 
  } = useProductFilters(products);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(24);

  // Pagination logic
  const totalPages = useMemo(() => {
    if (itemsPerPage === 0) return 1; // 0 means 'All'
    if (filteredProducts.length === 0) return 1;
    return Math.ceil(filteredProducts.length / itemsPerPage);
  }, [filteredProducts.length, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    if (itemsPerPage === 0) { // 'All' selected
      return filteredProducts;
    }
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Effect to reset to page 1 when filters or items per page change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filters, itemsPerPage]);

  const handleProductClick = (product: Product) => setSelectedProduct(product);
  const handleCloseModal = () => setSelectedProduct(null);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    handleResetFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const displayInfo = useMemo(() => {
    const totalFiltered = filteredProducts.length.toLocaleString('ro-RO');
    const totalProducts = products.length.toLocaleString('ro-RO');
    
    if (products.length > 0 && filteredProducts.length === 0) {
        return `Niciun produs găsit. (<strong>${totalProducts}</strong> produse în total)`;
    }
    
    if (filteredProducts.length <= 0) {
        return ``;
    }

    if (itemsPerPage === 0 || filteredProducts.length <= itemsPerPage) {
        return `Afișare <strong>${totalFiltered}</strong> din <strong>${totalProducts}</strong> produse.`;
    }
    
    const start = ((currentPage - 1) * itemsPerPage + 1).toLocaleString('ro-RO');
    const end = Math.min(currentPage * itemsPerPage, filteredProducts.length).toLocaleString('ro-RO');
    
    return `Afișare <strong>${start} - ${end}</strong> din <strong>${totalFiltered}</strong> produse (<strong>${totalProducts}</strong> totale).`;

  }, [filteredProducts.length, products.length, currentPage, itemsPerPage]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <ErrorNotification errors={sourceErrors} />
      <header className="text-center mb-8 relative">
        <a href="/" onClick={handleLogoClick} aria-label="Pagina principală, resetează filtrele">
          <img src="https://pimpit.ro/wp-content/uploads/2024/08/logo-pimpit-ro.png" alt="Pimpit.ro Logo" className="mx-auto mb-4" style={{ maxWidth: '400px' }}/>
        </a>
        <p className="text-gray-500 mt-2">Catalog Furnizori Piese Auto</p>
        {!loading && products.length > 0 && (
          <div className="mt-4 flex justify-center items-center gap-2">
             <p className="text-lg text-gray-700 font-light inline-block">
                <span className="font-semibold">{products.length.toLocaleString('ro-RO')}</span> Produse Unice
             </p>
             {isUsingDatabase && (
                 <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full border border-green-200" title="Bază de date conectată">LIVE</span>
             )}
             {isSyncing && (
                 <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-200 animate-pulse flex items-center">
                    <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Se actualizează catalogul...
                 </span>
             )}
          </div>
        )}
      </header>
      
      <FilterControls
        filters={filters}
        setFilters={setFilters}
        availableOptions={availableOptions}
        onReset={handleResetFilters}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
      />
      
      <ActiveFilters
        filters={filters}
        setFilters={setFilters}
        initialFilters={initialFilters}
        onReset={handleResetFilters}
      />

      <main>
        {loading ? <Spinner message={loadingMessage} /> : (
          <>
            <div className="text-left text-gray-600 mb-4">
               {products.length === 0 && !loading 
                    ? <span className="ml-2">Niciun produs nu a putut fi încărcat. Verifică setările.</span>
                    : <span dangerouslySetInnerHTML={{ __html: displayInfo }} />
               }
            </div>
            
            {filteredProducts.length > 0 ? (
                <>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredProducts.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    className="mb-4"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {paginatedProducts.map((product, index) => <ProductCard key={product.id || `${product['PartNumber']}-${index}`} product={product} onProductClick={handleProductClick} />)}
                  </div>
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    itemsPerPage={itemsPerPage}
                    totalItems={filteredProducts.length}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                    className="mt-8"
                  />
                </>
            ) : (
                <div className="text-center text-gray-500 mt-12 bg-white shadow-md rounded-lg p-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-4 text-xl font-semibold text-gray-800">
                      {isAnyFilterActive ? 'Niciun produs nu corespunde filtrelor' : 'Niciun produs disponibil'}
                    </h3>
                    <p className="mt-2 text-gray-600">
                      {isAnyFilterActive ? 'Încercați să modificați termenii de căutare sau să resetați filtrele.' : 'Se descarcă produsele din server...'}
                    </p>
                    {isAnyFilterActive && (
                      <div className="mt-6">
                        <button
                          onClick={handleResetFilters}
                          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          Resetează Filtrele
                        </button>
                      </div>
                    )}
                </div>
            )}
          </>
        )}
      </main>
      
      <Suspense fallback={<Spinner message="Se încarcă detaliile..." />}>
        {selectedProduct && <ProductModal product={selectedProduct} onClose={handleCloseModal} />}
      </Suspense>

    </div>
  );
};

export default App;
