
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Product, Filters, AvailableOptions, FilterMode } from './types';
import ProductCard from './components/ProductCard';
import FilterControls from './components/FilterControls';
import Spinner from './components/Spinner';
import { allSources } from './sources';
import { parseCSVData } from './utils/csvParser';

const ProductModal = lazy(() => import('./components/ProductModal'));

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('standard');

  const initialFilters: Filters = {
    searchTerm: '',
    Brand: 'all',
    Finish: 'all',
    Size: 'all',
    PCD: 'all',
    Width: 'all',
    Offset: 'all',
    Width_Front: 'all',
    Offset_Front: 'all',
    Width_Rear: 'all',
    Offset_Rear: 'all',
  };
  const [filters, setFilters] = useState<Filters>(initialFilters);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      setProducts([]); // Ensure fresh data on every load

      if (allSources.length === 0) {
        setError("Nicio sursă de date nu este configurată. Verificați directorul 'sources'.");
        setLoading(false);
        return;
      }

      const errors: string[] = [];

      const processSource = async (source: typeof allSources[0]) => {
         try {
            const fetchOptions: RequestInit = { cache: 'no-store' }; // Ensure fresh fetch
            const res = await fetch(source.url, fetchOptions);

            if (!res.ok) {
              throw new Error(`nu a putut fi încărcată (status: ${res.status}).`);
            }

            const csvText = await res.text();
            if (!csvText.trim()) {
              throw new Error('este un fișier gol.');
            }

            const parsedData = parseCSVData(csvText, source.parserConfig.requiredHeaders);
            const mappedData = source.map(parsedData);
            
            if (mappedData.length === 0) {
              throw new Error('Nu s-au putut importa produse. Verificați structura fișierului.');
            }
            
            return mappedData;
          } catch (e) {
            console.error(`Error processing ${source.name}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută la procesare.';
            errors.push(`${source.name}: ${errorMessage}`);
            return []; // Return empty array on error for this source
          }
      };

      try {
        setLoadingMessage(`Se încarcă sursele...`);
        
        const promises = allSources.map(source => {
          setLoadingMessage(`Se încarcă ${source.name}...`);
          return processSource(source).then(newProducts => {
            if (newProducts.length > 0) {
               setProducts(prevProducts => [...prevProducts, ...newProducts]);
            }
          });
        });

        await Promise.all(promises);

        if (errors.length > 0) {
            setError(errors.join(' '));
        }

      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'A apărut o eroare necunoscută.';
        setError(`A apărut o eroare la încărcarea produselor: ${errorMessage}`);
      } finally {
        setLoading(false);
        setLoadingMessage('');
      }
    };
    fetchProducts();
  }, []);

  const baseFilteredProducts = useMemo(() => {
    return products.filter(product => {
      const { searchTerm, Brand, Finish, Size, PCD } = filters;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const name = String(product['PartDescription'] || '').toLowerCase();
        const code = String(product['PartNumber'] || '').toLowerCase();
        const ean = String(product['EAN'] || '').toLowerCase();
        if (!name.includes(term) && !code.includes(term) && !ean.includes(term)) return false;
      }
      if (Brand !== 'all' && product['Brand'] !== Brand) return false;
      if (Finish !== 'all' && product['Finish'] !== Finish) return false;
      if (Size !== 'all' && String(product['Size']) !== Size) return false;
      if (PCD !== 'all' && product['PCD'] !== PCD) return false;
      return true;
    });
  }, [products, filters]);

  const availableOptions = useMemo<AvailableOptions>(() => {
    const getUniqueSortedValues = (items: Product[], key: string): string[] => {
      const values = [...new Set(items.map(p => p[key]).filter(Boolean))];
      return values.sort((a,b) => String(a).localeCompare(String(b), undefined, {numeric: true}));
    };

    const newOptions: AvailableOptions = {
        Brand: getUniqueSortedValues(products.filter(p => filters.searchTerm ? (String(p['PartDescription']||'').toLowerCase().includes(filters.searchTerm.toLowerCase()) || String(p['PartNumber']||'').toLowerCase().includes(filters.searchTerm.toLowerCase()) || String(p['EAN']||'').toLowerCase().includes(filters.searchTerm.toLowerCase())) : true), 'Brand'),
        Finish: getUniqueSortedValues(products.filter(p => filters.Brand === 'all' || p.Brand === filters.Brand), 'Finish'),
        Size: getUniqueSortedValues(products.filter(p => (filters.Brand === 'all' || p.Brand === filters.Brand) && (filters.Finish === 'all' || p.Finish === filters.Finish)), 'Size'),
        PCD: getUniqueSortedValues(products.filter(p => (filters.Brand === 'all' || p.Brand === filters.Brand) && (filters.Finish === 'all' || p.Finish === filters.Finish) && (filters.Size === 'all' || String(p.Size) === filters.Size)), 'PCD'),
        Width: [], Offset: [], Width_Front: [], Offset_Front: [], Width_Rear: [], Offset_Rear: []
    };

    newOptions.Width = getUniqueSortedValues(baseFilteredProducts, 'Width');
    newOptions.Offset = getUniqueSortedValues(baseFilteredProducts.filter(p => filters.Width === 'all' || String(p.Width) === filters.Width), 'Offset');
    
    newOptions.Width_Front = getUniqueSortedValues(baseFilteredProducts, 'Width');
    newOptions.Offset_Front = getUniqueSortedValues(baseFilteredProducts.filter(p => filters.Width_Front === 'all' || String(p.Width) === filters.Width_Front), 'Offset');
    
    newOptions.Width_Rear = getUniqueSortedValues(baseFilteredProducts, 'Width');
    newOptions.Offset_Rear = getUniqueSortedValues(baseFilteredProducts.filter(p => filters.Width_Rear === 'all' || String(p.Width) === filters.Width_Rear), 'Offset');
    
    return newOptions;
  }, [products, filters, baseFilteredProducts]);

  useEffect(() => {
    const newFilters = { ...filters };
    let changed = false;
    const checkAndReset = (key: keyof Filters, options: string[]) => {
      if (newFilters[key] !== 'all' && !options.includes(newFilters[key] as string)) {
        (newFilters[key] as any) = 'all';
        changed = true;
      }
    };
    checkAndReset('Finish', availableOptions.Finish);
    checkAndReset('Size', availableOptions.Size);
    checkAndReset('PCD', availableOptions.PCD);
    if (filterMode === 'standard') {
        checkAndReset('Width', availableOptions.Width);
        checkAndReset('Offset', availableOptions.Offset);
    } else {
        checkAndReset('Width_Front', availableOptions.Width_Front);
        checkAndReset('Offset_Front', availableOptions.Offset_Front);
        checkAndReset('Width_Rear', availableOptions.Width_Rear);
        checkAndReset('Offset_Rear', availableOptions.Offset_Rear);
    }
    if (changed) setFilters(newFilters);
  }, [availableOptions, filters, filterMode]);


  const filteredProducts = useMemo(() => {
    if (filterMode === 'standard') {
      return baseFilteredProducts.filter(product => {
        if (filters.Width !== 'all' && String(product['Width']) !== filters.Width) return false;
        if (filters.Offset !== 'all' && String(product['Offset']) !== filters.Offset) return false;
        return true;
      });
    } else { // staggered mode
      const frontFiltersActive = filters.Width_Front !== 'all' || filters.Offset_Front !== 'all';
      const rearFiltersActive = filters.Width_Rear !== 'all' || filters.Offset_Rear !== 'all';
      if (!frontFiltersActive && !rearFiltersActive) return baseFilteredProducts;

      return baseFilteredProducts.filter(product => {
        const matchesFront = (filters.Width_Front === 'all' || String(product.Width) === filters.Width_Front) &&
                             (filters.Offset_Front === 'all' || String(product.Offset) === filters.Offset_Front);
        const matchesRear = (filters.Width_Rear === 'all' || String(product.Width) === filters.Width_Rear) &&
                            (filters.Offset_Rear === 'all' || String(product.Offset) === filters.Offset_Rear);
        if (frontFiltersActive && !rearFiltersActive) return matchesFront;
        if (!frontFiltersActive && rearFiltersActive) return matchesRear;
        return matchesFront || matchesRear;
      });
    }
  }, [baseFilteredProducts, filters, filterMode]);

  const handleResetFilters = () => setFilters(initialFilters);
  const handleProductClick = (product: Product) => setSelectedProduct(product);
  const handleCloseModal = () => setSelectedProduct(null);

  const isAnyFilterActive = useMemo(() => {
    if (filterMode === 'standard') {
      return Object.keys(initialFilters).some(key => 
        !['Width_Front', 'Offset_Front', 'Width_Rear', 'Offset_Rear'].includes(key) &&
        filters[key as keyof Filters] !== initialFilters[key as keyof Filters]
      );
    } else {
       return Object.keys(initialFilters).some(key => 
        !['Width', 'Offset'].includes(key) &&
        filters[key as keyof Filters] !== initialFilters[key as keyof Filters]
      );
    }
  }, [filters, filterMode, initialFilters]);

  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">Catalog Produse B2B</h1>
        <p className="text-gray-500 mt-2">Catalog Furnizori Piese Auto</p>
      </header>
      
      <FilterControls
        filters={filters}
        setFilters={setFilters}
        availableOptions={availableOptions}
        onReset={handleResetFilters}
        filterMode={filterMode}
        setFilterMode={setFilterMode}
      />

      <main>
        {loading ? <Spinner message={loadingMessage} /> : error ? (
          <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg"><p className="font-bold">A apărut o eroare</p><p>{error}</p></div>
        ) : (
          <>
            <div className="text-left text-gray-600 mb-4">
                Afișare <strong>{filteredProducts.length}</strong> din <strong>{products.length}</strong> produse.
                {products.length === 0 && !loading && <span className="ml-2">Niciun produs nu a putut fi încărcat.</span>}
            </div>
            
            {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredProducts.map((product, index) => <ProductCard key={`${product['PartNumber']}-${index}`} product={product} onProductClick={handleProductClick} />)}
                </div>
            ) : (
                <div className="text-center text-gray-500 mt-12 bg-white shadow-md rounded-lg p-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-4 text-xl font-semibold text-gray-800">
                      {isAnyFilterActive ? 'Niciun produs nu corespunde filtrelor' : 'Niciun produs disponibil'}
                    </h3>
                    <p className="mt-2 text-gray-600">
                      {isAnyFilterActive ? 'Încercați să modificați termenii de căutare sau să resetați filtrele.' : 'Momentan nu există produse în catalog. Vă rugăm să reveniți mai târziu.'}
                    </p>
                    {isAnyFilterActive && (
                      <div className="mt-6">
                        <button
                          onClick={handleResetFilters}
                          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
