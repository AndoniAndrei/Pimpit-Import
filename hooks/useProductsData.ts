
import { useState, useEffect, useRef } from 'react';
import { Product, SourceError } from '../types';
import { allSources } from '../sources';
import { parseXMLData } from '../utils/xmlParser';
import { parseCsvInWorker } from '../utils/csvWorker'; // Use the new worker
import { getProductsFromCache, saveProductsToCache } from '../utils/cache';

export const useProductsData = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);

  // We use a ref to track products by source to efficiently merge updates without re-filtering the entire list constantly
  const productsBySourceRef = useRef<Map<string, Product[]>>(new Map());

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

          const processedProduct = { ...newProduct };

          // Case 1: Price Dropped (New < Old)
          if (newProduct.Price < cachedProduct.Price) {
              processedProduct.OldPrice = cachedProduct.Price;
          }
          // Case 2: Price Stable (New == Old), keep existing flag
          else if (newProduct.Price === cachedProduct.Price && cachedProduct.OldPrice && cachedProduct.OldPrice > newProduct.Price) {
               processedProduct.OldPrice = cachedProduct.OldPrice;
          }
          // Case 3: Price Increased, clear flag
          else if (newProduct.Price > cachedProduct.Price) {
               processedProduct.OldPrice = undefined;
          }

          return processedProduct;
      });
  };

  const fetchProducts = async (forceRefresh = false) => {
      setLoading(true);
      setSourceErrors([]);
      
      // 1. Initialize from Cache
      let cachedData: Product[] | null = null;
      try {
        cachedData = await getProductsFromCache();
      } catch (e) {
        console.warn("Could not read cache", e);
      }

      // Initialize the source map
      productsBySourceRef.current.clear();
      
      if (!forceRefresh && cachedData && cachedData.length > 0) {
          // Hydrate the map with cached data
          cachedData.forEach(p => {
              const src = p.Source || 'Unknown';
              if (!productsBySourceRef.current.has(src)) {
                  productsBySourceRef.current.set(src, []);
              }
              productsBySourceRef.current.get(src)!.push(p);
          });
          
          setProducts(cachedData);
          setLoadingMessage('Se actualizează ofertele...');
      } else {
          setLoadingMessage(`Se inițializează descărcarea din ${allSources.length} surse...`);
          setProducts([]);
      }

      if (allSources.length === 0) {
        setSourceErrors([{ name: 'Configurație', message: "Nicio sursă de date nu este configurată." }]);
        setLoading(false);
        return;
      }

      // Helper to update the main state from the ref map
      const refreshState = () => {
          const allProducts = Array.from(productsBySourceRef.current.values()).flat();
          setProducts(allProducts);
          if (allProducts.length > 0) saveProductsToCache(allProducts);
      };

      // 2. Fire requests for all sources in parallel, but handle them individually (Streaming/Incremental)
      const fetchPromises = allSources.map(async (source) => {
          try {
            const fetchOptions: RequestInit = { cache: 'no-store' };
            const res = source.fetcher 
                ? await source.fetcher()
                : await fetch(source.url!, fetchOptions);

            if (!res.ok) {
              throw new Error(`HTTP Error ${res.status}`);
            }
            
            let parsedData: any[];

            if (source.type === 'xml') {
              // XML still on main thread (usually smaller or no easy JS parser without deps)
              const text = await res.text();
              parsedData = parseXMLData(text);
            } else if (source.type === 'json') {
              parsedData = await res.json();
            } else { 
              // CSV processing -> Offload to Web Worker
              let text: string;
              if (source.parserConfig?.encoding) {
                  const buffer = await res.arrayBuffer();
                  const decoder = new TextDecoder(source.parserConfig.encoding);
                  text = decoder.decode(buffer);
              } else {
                  text = await res.text();
              }
              // This is the key optimization:
              parsedData = await parseCsvInWorker(text, source.parserConfig);
            }

            const mappedData = await source.map(parsedData);
            
            // Apply history logic using the cache snapshot we took at the beginning
            const finalData = applyPriceDropLogic(mappedData, cachedData);

            // Update the map for this specific source, replacing any stale cache data
            productsBySourceRef.current.set(source.name, finalData);
            
            // Update UI immediately
            refreshState();

          } catch (e) {
            console.error(`Error processing ${source.name}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută.';
            setSourceErrors(prev => [...prev, { name: source.name, message: errorMessage }]);
          }
      });

      // Wait for all to finish (successfully or with error) to clear the "Loading" state completely
      await Promise.allSettled(fetchPromises);
      
      setLoading(false);
      setLoadingMessage('');
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
