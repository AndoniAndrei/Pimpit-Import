
import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Product, Filters, AvailableOptions, FilterMode, DataSource } from './types';
import ProductCard from './components/ProductCard';
import FilterControls from './components/FilterControls';
import ActiveFilters from './components/ActiveFilters';
import Spinner from './components/Spinner';
import Pagination from './components/Pagination';
import { allSources } from './sources';
import { parseCSVData } from './utils/csvParser';
import { parseXMLData } from './utils/xmlParser';

const ProductModal = lazy(() => import('./components/ProductModal'));

// Helper function to expand multi-value PCD strings
const expandPcdValues = (values: (string | number)[]): string[] => {
  const allPcds = new Set<string>();
  values.forEach(pcd => {
    if (!pcd) return;
    String(pcd).split(/[,/\s]+/).filter(Boolean).forEach(part => allPcds.add(part.trim()));
  });
  return Array.from(allPcds);
};

// Helper function to expand ET/Offset ranges and comma-separated lists
const expandOffsetValues = (values: (string | number)[]): string[] => {
  const allOffsets = new Set<string>();
  values.forEach(offset => {
    if (offset === null || offset === undefined) return;
    const offsetStr = String(offset).trim();
    if (offsetStr === '') return;

    // Split by comma/space to handle lists like "20, 21, 22" or ranges like "20-40"
    const parts = offsetStr.split(/[,/\s]+/).filter(Boolean);

    parts.forEach(part => {
      const trimmedPart = part.trim();
      const rangeMatch = trimmedPart.match(/^(-?\d+)-(-?\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            allOffsets.add(String(i));
          }
        } else {
          allOffsets.add(trimmedPart); // Add invalid range as is
        }
      } else if (!isNaN(parseInt(trimmedPart, 10))) {
        // Add if it's a valid number
        allOffsets.add(trimmedPart);
      }
    });
  });
  return Array.from(allOffsets);
};

// Helper to check if a product's value matches the selected filter, accounting for special formats
const productMatchesFilter = (productValue: any, filterValue: string, key: 'PCD' | 'Offset'): boolean => {
  if (filterValue === 'all') return true;
  if (productValue === null || productValue === undefined) return false;

  const prodValStr = String(productValue).trim();
  const filterValStr = String(filterValue).trim();
  if (prodValStr === filterValStr) return true;

  const valueParts = prodValStr.split(/[,/\s]+/).filter(Boolean);

  if (key === 'PCD') {
    return valueParts.includes(filterValStr);
  }

  if (key === 'Offset') {
    const filterNum = parseInt(filterValStr, 10);
    if (isNaN(filterNum)) return false; // Can't match if filter isn't a number

    // Check each part of the product's offset value
    for (const part of valueParts) {
      // Check if the part is the exact number
      if (part === filterValStr) return true;

      // Check if the part is a range and the filter value falls within it
      const rangeMatch = part.match(/^(-?\d+)-(-?\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          if (filterNum >= start && filterNum <= end) {
            return true;
          }
        }
      }
    }
  }

  return false;
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('standard');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(24);

  const initialFilters: Filters = {
    searchTerm: '',
    Brand: 'all',
    Finish: 'all',
    Size: 'all',
    PCD: 'all',
    ProductType: 'all',
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
      setProducts([]);

      if (allSources.length === 0) {
        setError("Nicio sursă de date nu este configurată. Verificați directorul 'sources'.");
        setLoading(false);
        return;
      }

      const errors: string[] = [];

      const processSource = async (source: DataSource): Promise<Product[]> => {
         try {
            const fetchOptions: RequestInit = { cache: 'no-store' };
            
            const res = source.fetcher 
                ? await source.fetcher()
                : await fetch(source.url!, fetchOptions);

            if (!res.ok) {
              throw new Error(`nu a putut fi încărcată (status: ${res.status}).`);
            }

            const text = await res.text();
            if (!text.trim()) {
              throw new Error('este un fișier gol.');
            }
            
            const isXml = source.type === 'xml';
            const parsedData = isXml
                ? parseXMLData(text)
                : parseCSVData(text, source.parserConfig.requiredHeaders);

            const mappedData = await source.map(parsedData);
            
            if (mappedData.length === 0) {
              console.warn(`Sursa ${source.name} a returnat 0 produse după mapare.`);
            }
            
            return mappedData;
          } catch (e) {
            console.error(`Error processing ${source.name}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută la procesare.';
            errors.push(`${source.name}: ${errorMessage}`);
            return [];
          }
      };

      try {
        setLoadingMessage(`Se încarcă ${allSources.length} surse de date...`);
        
        const productArrays = await Promise.all(
          allSources.map(source => processSource(source))
        );
        
        const allProducts = productArrays.flat();
        setProducts(allProducts);

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
      const { searchTerm, Brand, Finish, Size, PCD, ProductType } = filters;
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
      if (PCD !== 'all' && !productMatchesFilter(product['PCD'], PCD, 'PCD')) return false;
      if (ProductType !== 'all' && product['ProductType'] !== ProductType) return false;
      return true;
    });
  }, [products, filters]);

  const availableOptions = useMemo<AvailableOptions>(() => {
    const getRawUniqueValues = (items: Product[], key: string): any[] => {
        return [...new Set(items.map(p => p[key]).filter(v => v !== null && v !== undefined && v !== ''))];
    };
    const sortNumeric = (arr: string[]) => arr.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));

    // Create a cascade of filtered product sets. Each set is used to generate the options for the *next* filter level.
    const productTypeFiltered = products.filter(p => {
        if (filters.searchTerm) {
             const term = filters.searchTerm.toLowerCase();
             if (!(String(p['PartDescription'] || '').toLowerCase().includes(term) || String(p['PartNumber'] || '').toLowerCase().includes(term) || String(p['EAN'] || '').toLowerCase().includes(term))) return false;
        }
        if (filters.ProductType !== 'all' && p.ProductType !== filters.ProductType) return false;
        return true;
    });

    const brandFiltered = productTypeFiltered.filter(p => filters.Brand === 'all' || p.Brand === filters.Brand);
    const finishFiltered = brandFiltered.filter(p => filters.Finish === 'all' || p.Finish === filters.Finish);
    const sizeFiltered = finishFiltered.filter(p => filters.Size === 'all' || String(p.Size) === filters.Size);
    const pcdFiltered = sizeFiltered.filter(p => filters.PCD === 'all' || productMatchesFilter(p.PCD, filters.PCD, 'PCD'));

    const newOptions: AvailableOptions = {
        ProductType: sortNumeric(getRawUniqueValues(products, 'ProductType').map(String)),
        Brand: sortNumeric(getRawUniqueValues(productTypeFiltered, 'Brand').map(String)),
        Finish: sortNumeric(getRawUniqueValues(brandFiltered, 'Finish').map(String)),
        Size: sortNumeric(getRawUniqueValues(finishFiltered, 'Size').map(String)),
        PCD: sortNumeric(expandPcdValues(getRawUniqueValues(sizeFiltered, 'PCD'))),
        Width: [], Offset: [], Width_Front: [], Offset_Front: [], Width_Rear: [], Offset_Rear: []
    };
    
    // Width options depend on the full cascade before it
    const allWidths = sortNumeric(getRawUniqueValues(pcdFiltered, 'Width').map(String));
    newOptions.Width = allWidths;
    newOptions.Width_Front = allWidths;
    newOptions.Width_Rear = allWidths;

    // Offset options depend on the full cascade including Width
    const offsetStandardProducts = pcdFiltered.filter(p => filters.Width === 'all' || String(p.Width) === filters.Width);
    newOptions.Offset = sortNumeric(expandOffsetValues(getRawUniqueValues(offsetStandardProducts, 'Offset')));

    const offsetFrontProducts = pcdFiltered.filter(p => filters.Width_Front === 'all' || String(p.Width) === filters.Width_Front);
    newOptions.Offset_Front = sortNumeric(expandOffsetValues(getRawUniqueValues(offsetFrontProducts, 'Offset')));
    
    const offsetRearProducts = pcdFiltered.filter(p => filters.Width_Rear === 'all' || String(p.Width) === filters.Width_Rear);
    newOptions.Offset_Rear = sortNumeric(expandOffsetValues(getRawUniqueValues(offsetRearProducts, 'Offset')));

    return newOptions;
  }, [products, filters]);

  useEffect(() => {
    const newFilters = { ...filters };
    let changed = false;
    const checkAndReset = (key: keyof Filters, options: string[]) => {
      if (newFilters[key] !== 'all' && !options.includes(newFilters[key] as string)) {
        (newFilters[key] as any) = 'all';
        changed = true;
      }
    };
    checkAndReset('Brand', availableOptions.Brand);
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
        if (filters.Offset !== 'all' && !productMatchesFilter(product['Offset'], filters.Offset, 'Offset')) return false;
        return true;
      });
    } else { // staggered mode
      const frontFiltersActive = filters.Width_Front !== 'all' || filters.Offset_Front !== 'all';
      const rearFiltersActive = filters.Width_Rear !== 'all' || filters.Offset_Rear !== 'all';
      if (!frontFiltersActive && !rearFiltersActive) return baseFilteredProducts;

      return baseFilteredProducts.filter(product => {
        const matchesFront = (filters.Width_Front === 'all' || String(product.Width) === filters.Width_Front) &&
                             (filters.Offset_Front === 'all' || productMatchesFilter(product.Offset, filters.Offset_Front, 'Offset'));
        const matchesRear = (filters.Width_Rear === 'all' || String(product.Width) === filters.Width_Rear) &&
                            (filters.Offset_Rear === 'all' || productMatchesFilter(product.Offset, filters.Offset_Rear, 'Offset'));
        if (frontFiltersActive && !rearFiltersActive) return matchesFront;
        if (!frontFiltersActive && rearFiltersActive) return matchesRear;
        return matchesFront || matchesRear;
      });
    }
  }, [baseFilteredProducts, filters, filterMode]);

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

  const handleResetFilters = () => setFilters(initialFilters);
  const handleProductClick = (product: Product) => setSelectedProduct(product);
  const handleCloseModal = () => setSelectedProduct(null);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    handleResetFilters();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      <header className="text-center mb-8">
        <a href="/" onClick={handleLogoClick} aria-label="Pagina principală, resetează filtrele">
          <img src="data:image/jpeg;base64,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" alt="Pimpit.ro Logo" className="mx-auto mb-4" style={{ maxWidth: '400px' }}/>
        </a>
        <p className="text-gray-500 mt-2">Catalog Furnizori Piese Auto</p>
        {!loading && !error && products.length > 0 && (
          <p className="text-lg text-gray-700 mt-4 font-light">
            <span className="font-semibold">{products.length.toLocaleString('ro-RO')}</span> Produse Unice în Catalog
          </p>
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
        {loading ? <Spinner message={loadingMessage} /> : error ? (
          <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg"><p className="font-bold">A apărut o eroare</p><p>{error}</p></div>
        ) : (
          <>
            <div className="text-left text-gray-600 mb-4">
               {products.length === 0 && !loading 
                    ? <span className="ml-2">Niciun produs nu a putut fi încărcat.</span>
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
                      {paginatedProducts.map((product, index) => <ProductCard key={`${product['PartNumber']}-${index}`} product={product} onProductClick={handleProductClick} />)}
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
