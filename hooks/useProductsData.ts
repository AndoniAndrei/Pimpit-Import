
import { useState, useEffect } from 'react';
import { Product, SourceError } from '../types';
import { allSources } from '../sources';
import { parseCSVData } from '../utils/csvParser';
import { parseXMLData } from '../utils/xmlParser';
import { getProductsFromCache, saveProductsToCache } from '../utils/cache';

export const useProductsData = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);

  // Function to apply price history logic
  const applyPriceDropLogic = (newProducts: Product[], cachedProducts: Product[] | null): Product[] => {
      if (!cachedProducts || cachedProducts.length === 0) return newProducts;

      // Create a map for fast lookup of historical prices
      const historyMap = new Map(cachedProducts.map(p => [p.PartNumber, p]));

      return newProducts.map(newProduct => {
          const cachedProduct = historyMap.get(newProduct.PartNumber);
          
          if (!cachedProduct) {
              return newProduct;
          }

          // Clone to avoid mutating original source data directly
          const processedProduct = { ...newProduct };

          // LOGIC: Compare Current Calculated Price vs Last Known Calculated Price
          
          // Case 1: Price Dropped (New < Old)
          // We flag this as a discount based on history.
          if (newProduct.Price < cachedProduct.Price) {
              processedProduct.OldPrice = cachedProduct.Price;
          }
          // Case 2: Price Stable (New == Old)
          // If the product was already marked as discounted in the cache, we preserve that flag
          // so the bubble doesn't disappear immediately on a page refresh.
          else if (newProduct.Price === cachedProduct.Price && cachedProduct.OldPrice && cachedProduct.OldPrice > newProduct.Price) {
               processedProduct.OldPrice = cachedProduct.OldPrice;
          }
          // Case 3: Price Increased (New > Old)
          // The discount is no longer valid. We remove the OldPrice flag (or keep the RRP if it was set by source).
          else if (newProduct.Price > cachedProduct.Price) {
               // If the logic relies strictly on history, we clear it. 
               // If source had an RRP-based OldPrice, it might be overwritten here depending on preference.
               // For now, we assume history takes precedence for "Drop Alerts".
               processedProduct.OldPrice = undefined;
          }

          return processedProduct;
      });
  };

  const fetchProducts = async (forceRefresh = false) => {
      setLoading(true);
      setSourceErrors([]);
      
      let cachedData: Product[] | null = null;

      // 1. Try to load from cache first to show something immediately
      try {
        cachedData = await getProductsFromCache();
      } catch (e) {
        console.warn("Could not read cache for history comparison", e);
      }

      if (!forceRefresh && cachedData && cachedData.length > 0) {
          setLoadingMessage('Se verifică memoria cache...');
          setProducts(cachedData);
          setLoading(false);
          // Even if we use cache, we might want to trigger a background refresh in a real app,
          // but here we follow the standard flow.
          return; 
      }

      setProducts([]); // Clear UI if strictly refreshing
      
      if (allSources.length === 0) {
        setSourceErrors([{ name: 'Configurație Aplicație', message: "Nicio sursă de date nu este configurată." }]);
        setLoading(false);
        return;
      }
      
      setLoadingMessage(`Se descarcă și procesează ${allSources.length} surse de date...`);

      const results = await Promise.allSettled(
        allSources.map(async (source) => {
          try {
            const fetchOptions: RequestInit = { cache: 'no-store' };
            const res = source.fetcher 
                ? await source.fetcher()
                : await fetch(source.url!, fetchOptions);

            if (!res.ok) {
              throw new Error(`nu a putut fi încărcată (status: ${res.status}).`);
            }
            
            let parsedData: any[];

            if (source.type === 'xml') {
              const text = await res.text();
              if (!text.trim()) {
                throw new Error('este un fișier gol.');
              }
              parsedData = parseXMLData(text);
            } else if (source.type === 'json') {
              parsedData = await res.json();
              if (!Array.isArray(parsedData)) {
                throw new Error('nu a returnat un format JSON valid (array).');
              }
            } else { // 'csv' or undefined (default)
              if (!source.parserConfig) {
                throw new Error(`este configurată ca CSV dar îi lipsește 'parserConfig'.`);
              }
              let text: string;
              if (source.parserConfig.encoding) {
                  const buffer = await res.arrayBuffer();
                  const decoder = new TextDecoder(source.parserConfig.encoding);
                  text = decoder.decode(buffer);
              } else {
                  text = await res.text();
              }
              if (!text.trim()) {
                throw new Error('este un fișier gol.');
              }
              parsedData = parseCSVData(text, source.parserConfig);
            }

            const mappedData = await source.map(parsedData);
            
            if (mappedData.length === 0) {
              console.warn(`Sursa ${source.name} a returnat 0 produse după mapare.`);
            }
            
            return mappedData;
          } catch (e) {
            console.error(`Error processing ${source.name}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută la procesare.';
            // Reject the promise with a structured error that allSettled will capture
            return Promise.reject({ name: source.name, message: errorMessage });
          }
        })
      );

      const allFreshProducts: Product[] = [];
      const errors: SourceError[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allFreshProducts.push(...result.value);
        } else {
          errors.push(result.reason as SourceError);
        }
      });
      
      // 2. Apply "Price Drop" Logic
      // Compare the fresh data against the cached data (history) before saving.
      const finalProducts = applyPriceDropLogic(allFreshProducts, cachedData);

      setProducts(finalProducts);
      setSourceErrors(errors);
      setLoading(false);
      setLoadingMessage('');

      if (finalProducts.length > 0) {
          saveProductsToCache(finalProducts);
      }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  return { 
      products, 
      loading, 
      loadingMessage, 
      sourceErrors, 
      refetch: () => fetchProducts(true) 
  };
};
