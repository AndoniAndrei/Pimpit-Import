
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
            
            const isXml = source.type === 'xml';
            let text: string;

            if (!isXml && source.parserConfig.encoding) {
                const buffer = await res.arrayBuffer();
                const decoder = new TextDecoder(source.parserConfig.encoding);
                text = decoder.decode(buffer);
            } else {
                text = await res.text();
            }

            if (!text.trim()) {
              throw new Error('este un fișier gol.');
            }
            
            const parsedData = isXml
                ? parseXMLData(text)
                : parseCSVData(text, source.parserConfig);

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
          <img src="https://pimpit.ro/wp-content/uploads/2024/08/logo-pimpit-ro.png" alt="Pimpit.ro Logo" className="mx-auto mb-4" style={{ maxWidth: '400px' }}/>
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