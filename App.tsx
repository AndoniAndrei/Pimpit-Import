import React, { useState, useEffect, useMemo } from 'react';
import { Product, Filters, AvailableOptions, FilterMode } from './types';
import ProductCard from './components/ProductCard';
import FilterControls from './components/FilterControls';
import Spinner from './components/Spinner';
import ProductModal from './components/ProductModal';

// Noul URL, direct către fișierul CSV public și funcțional
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1AFZLyen_l9P5JxBYlTyVCQocZt3X8IAU-Jh785Gseos/export?format=csv&gid=187323146';

// Funcție ajutătoare pentru a detecta separatorul (virgulă vs. punct și virgulă)
const getDelimiter = (line: string): string => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  if (semicolonCount > commaCount && semicolonCount > 0) {
    return ';';
  }
  return ',';
};

// Parser CSV complet, care gestionează rânduri multi-linie, ghilimele și separatori
const parseFullCsv = (text: string): string[][] => {
    const table: string[][] = [];
    if (!text) return table;
    const firstLines = text.substring(0, 1000);
    const delimiter = getDelimiter(firstLines);
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentVal);
                currentVal = '';
            } else if (char === '\r' || char === '\n') {
                currentRow.push(currentVal);
                table.push(currentRow);
                currentRow = [];
                currentVal = '';
                if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                    i++;
                }
            } else {
                currentVal += char;
            }
        }
    }
    currentRow.push(currentVal);
    if (currentRow.length > 0 && currentRow.some(val => val && val.trim() !== '')) {
      table.push(currentRow);
    }
    return table;
};

// Funcție robustă pentru a interpreta textul CSV
const parseCSV = (text: string): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  const table = parseFullCsv(text);
  if (table.length === 0) {
      console.error("Parsarea CSV a rezultat într-un tabel gol.");
      throw new Error("Fișierul CSV este gol sau are un format neașteptat.");
  }
  let headerIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < table.length; i++) {
    const potentialHeaders = table[i].map(h => h ? h.trim() : '');
    const lowercasedHeaders = potentialHeaders.map(h => h.toLowerCase());
    if (lowercasedHeaders.includes('partnumber') && lowercasedHeaders.includes('brand') && lowercasedHeaders.includes('pret client in lei/buc')) {
      headerIndex = i;
      headers = potentialHeaders.map(h => h.replace(/\r?\n|\r/g, ' ').trim());
      break;
    }
  }
  if (headerIndex === -1) {
    const firstLinesForError = text.split(/\r\n|\n|\r/).slice(0, 10).join('\n');
    console.error("Antetul CSV nu a putut fi găsit. Verificați structura fișierului. Primele 10 linii:", firstLinesForError);
    throw new Error("Antetul CSV (linia cu 'PartNumber', 'Brand', etc.) nu a putut fi găsit. Verificați dacă fișierul este corect și accesibil public.");
  }
  const dataRows = table.slice(headerIndex + 1);
  const products = dataRows.map(row => {
    if (row.every(cell => !cell || !cell.trim())) return null;
    const product: Product = {};
    headers.forEach((header, index) => {
        if (header && index < row.length) {
            product[header] = row[index];
        }
    });
    return product;
  });
  return products.filter((p): p is Product => p !== null);
};

const App: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
      try {
        const response = await fetch(SHEET_URL);
        if (!response.ok) throw new Error(`Eroare de rețea. Status: ${response.status}`);
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('text/csv')) throw new Error('Fișierul primit nu este în format CSV valid. Este posibil ca link-ul să fie invalid sau să necesite autentificare.');
        const csvText = await response.text();
        const data = parseCSV(csvText);
        if (!Array.isArray(data)) throw new Error("Fișierul este gol sau formatat incorect. Niciun produs nu a putut fi încărcat.");
        const processedData = data.filter(p => p && p['PartNumber'] && String(p['PartNumber']).trim() !== '');
        setProducts(processedData);
      } catch (e) {
        if (e instanceof Error) setError(e.message);
        else setError('A apărut o eroare necunoscută.');
      } finally {
        setLoading(false);
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
        <p className="text-gray-500 mt-2">7001 Stock Wheels</p>
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
        {loading ? <Spinner /> : error ? (
          <div className="text-center text-red-500 bg-red-100 p-4 rounded-lg"><p className="font-bold">A apărut o eroare</p><p>{error}</p></div>
        ) : (
          <>
            <div className="text-left text-gray-600 mb-4">
                Afișare <strong>{filteredProducts.length}</strong> din <strong>{products.length}</strong> produse.
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
      
      {selectedProduct && <ProductModal product={selectedProduct} onClose={handleCloseModal} />}

    </div>
  );
};

export default App;
