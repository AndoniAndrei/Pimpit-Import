
import { useState, useMemo, useEffect } from 'react';
import { Product, Filters, FilterMode, AvailableOptions } from '../types';
import { expandPcdValues, expandOffsetValues, productMatchesFilter } from '../utils/filterUtils';

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

// Helper to read filters from URL
const getFiltersFromUrl = (): Filters | null => {
    if (typeof window === 'undefined') return null;
    
    const params = new URLSearchParams(window.location.search);
    const filtersFromUrl: any = { ...initialFilters };
    let hasParams = false;

    for (const key of Object.keys(initialFilters)) {
        const val = params.get(key);
        if (val) {
            filtersFromUrl[key] = val;
            hasParams = true;
        }
    }
    
    return hasParams ? filtersFromUrl : null;
};

export const useProductFilters = (products: Product[]) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('standard');
  
  // Initialize state from URL or defaults
  const [filters, setFilters] = useState<Filters>(() => {
      const urlFilters = getFiltersFromUrl();
      if (urlFilters) {
          // If we have "Front/Rear" specific filters in URL, switch mode automatically
          if (urlFilters.Width_Front !== 'all' || urlFilters.Offset_Front !== 'all' || 
              urlFilters.Width_Rear !== 'all' || urlFilters.Offset_Rear !== 'all') {
              // We need to set this mode in a useEffect, but we can infer it here logic-wise
              // However, since state init runs once, we'll handle the mode switch via effect below or just let the user toggle.
              // For better UX, let's detect it.
          }
          return urlFilters;
      }
      return initialFilters;
  });

  // Effect: Sync URL when filters change
  useEffect(() => {
      const params = new URLSearchParams();
      let hasActiveFilters = false;

      (Object.keys(filters) as Array<keyof Filters>).forEach(key => {
          const value = filters[key];
          if (value !== initialFilters[key] && value !== '') {
              params.set(key, value);
              hasActiveFilters = true;
          }
      });

      const newUrl = `${window.location.pathname}${hasActiveFilters ? '?' + params.toString() : ''}`;
      
      // We use replaceState to avoid cluttering the browser history with every filter click
      window.history.replaceState({ path: newUrl }, '', newUrl);
  }, [filters]);

  // Effect: Auto-switch mode based on URL params on mount
  useEffect(() => {
      if (filters.Width_Front !== 'all' || filters.Offset_Front !== 'all' || 
          filters.Width_Rear !== 'all' || filters.Offset_Rear !== 'all') {
          setFilterMode('staggered');
      }
  }, []); // Run only once on mount

  const handleResetFilters = () => {
      setFilters(initialFilters);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
  };

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

    // Create a cascade of filtered product sets.
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
    
    const allWidths = sortNumeric(getRawUniqueValues(pcdFiltered, 'Width').map(String));
    newOptions.Width = allWidths;
    newOptions.Width_Front = allWidths;
    newOptions.Width_Rear = allWidths;

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
      // Don't reset if it's currently loading initial data (Available options might be empty initially)
      if (products.length === 0) return;
      
      if (newFilters[key] !== 'all' && !options.includes(newFilters[key] as string)) {
        (newFilters[key] as any) = 'all';
        changed = true;
      }
    };
    
    if (products.length > 0) {
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
    }
  }, [availableOptions, filters, filterMode, products.length]);


  const filteredProducts = useMemo(() => {
    if (filterMode === 'standard') {
      return baseFilteredProducts.filter(product => {
        if (filters.Width !== 'all' && String(product['Width']) !== filters.Width) return false;
        if (filters.Offset !== 'all' && !productMatchesFilter(product['Offset'], filters.Offset, 'Offset')) return false;
        return true;
      });
    } else { 
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
  }, [filters, filterMode]);

  return {
      filters,
      setFilters,
      filterMode,
      setFilterMode,
      availableOptions,
      filteredProducts,
      handleResetFilters,
      isAnyFilterActive,
      initialFilters
  };
};