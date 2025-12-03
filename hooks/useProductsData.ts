
import { useState, useEffect, useRef } from 'react';
import { Product, SourceError } from '../types';
import { allSources } from '../sources';
import { parseXMLData } from '../utils/xmlParser';
import { parseCsvInWorker } from '../utils/csvWorker'; 
import { getProductsFromCache, saveProductsToCache } from '../utils/cache';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { mapDbToProduct } from '../utils/dbMapper';

export const useProductsData = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);
  const [isUsingDatabase, setIsUsingDatabase] = useState(false);

  const productsBySourceRef = useRef<Map<string, Product[]>>(new Map());

  // Function to apply price history logic
  const applyPriceDropLogic = (newProducts: Product[], cachedProducts: Product[] | null): Product[] => {
      if (!cachedProducts || cachedProducts.length === 0) return newProducts;
      const historyMap = new Map(cachedProducts.map(p => [p.PartNumber, p]));

      return newProducts.map(newProduct => {
          const cachedProduct = historyMap.get(newProduct.PartNumber);
          if (!cachedProduct) return newProduct;

          const processedProduct = { ...newProduct };
          if (newProduct.Price < cachedProduct.Price) {
              processedProduct.OldPrice = cachedProduct.Price;
          }
          else if (newProduct.Price === cachedProduct.Price && cachedProduct.OldPrice && cachedProduct.OldPrice > newProduct.Price) {
               processedProduct.OldPrice = cachedProduct.OldPrice;
          }
          else if (newProduct.Price > cachedProduct.Price) {
               processedProduct.OldPrice = undefined;
          }
          return processedProduct;
      });
  };

  const fetchProducts = async (forceRefresh = false) => {
      setLoading(true);
      setSourceErrors([]);
      
      // 0. Check for cached data for immediate display
      let cachedData: Product[] | null = null;
      try {
        cachedData = await getProductsFromCache();
      } catch (e) {
        console.warn("Could not read cache", e);
      }

      if (!forceRefresh && cachedData && cachedData.length > 0) {
          setProducts(cachedData);
          setLoadingMessage('Se verifică actualizări...');
      } else {
          setProducts([]);
      }

      // 1. Try fetching from Supabase FIRST
      const isDbConnected = await checkSupabaseConnection();
      
      if (isDbConnected) {
          setIsUsingDatabase(true);
          try {
              // Fetch total count first
              const { count } = await supabase
                  .from('products')
                  .select('*', { count: 'exact', head: true });
              
              const totalRows = count || 0;
              let allDbProducts: Product[] = [];
              const PAGE_SIZE = 2000; // Supabase limit is usually higher, but 2000 is safe and fast
              let from = 0;
              let hasMore = true;

              setLoadingMessage(`Se conectează la baza de date (${totalRows} produse)...`);

              // Loop to fetch ALL data
              while (hasMore) {
                  const to = from + PAGE_SIZE - 1;
                  
                  // Update UI with progress
                  setLoadingMessage(`Se descarcă din DB: ${from.toLocaleString()} - ${Math.min(to, totalRows).toLocaleString()} din ${totalRows.toLocaleString()}...`);
                  
                  const { data, error } = await supabase
                    .from('products')
                    .select('*')
                    .range(from, to);
                  
                  if (error) throw error;
                  
                  if (data && data.length > 0) {
                      const mappedBatch = data.map(mapDbToProduct);
                      allDbProducts = allDbProducts.concat(mappedBatch);
                      
                      // If we got fewer rows than requested, we reached the end
                      if (data.length < PAGE_SIZE) {
                          hasMore = false;
                      } else {
                          from += PAGE_SIZE;
                      }
                  } else {
                      hasMore = false;
                  }
              }
              
              if (allDbProducts.length > 0) {
                  setProducts(allDbProducts);
                  saveProductsToCache(allDbProducts);
                  setLoading(false);
                  return; // EXIT EARLY - WE HAVE FULL DB DATA
              }
          } catch (err) {
              console.error("Eroare la citirea din DB, trecem pe fallback (CSV)", err);
              setSourceErrors(prev => [...prev, { name: 'Baza de Date', message: 'Eroare conexiune DB, se folosesc sursele de rezervă (CSV).' }]);
          }
      }

      // 2. Fallback to CSV Processing (Old Logic) if DB fails or is empty
      setIsUsingDatabase(false);
      productsBySourceRef.current.clear();
      
      // Initialize map with cache if we are falling back
      if (cachedData && cachedData.length > 0 && !forceRefresh) {
          cachedData.forEach(p => {
             const src = p.Source || 'Unknown';
             if (!productsBySourceRef.current.has(src)) productsBySourceRef.current.set(src, []);
             productsBySourceRef.current.get(src)!.push(p);
          });
      }
      
      setLoadingMessage(`Se inițializează descărcarea din ${allSources.length} surse...`);

      const refreshState = () => {
          const allProducts = Array.from(productsBySourceRef.current.values()).flat();
          setProducts(allProducts);
          if (allProducts.length > 0) saveProductsToCache(allProducts);
      };

      const fetchPromises = allSources.map(async (source) => {
          try {
            const fetchOptions: RequestInit = { cache: 'no-store' };
            const res = source.fetcher 
                ? await source.fetcher()
                : await fetch(source.url!, fetchOptions);

            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            
            let parsedData: any[];

            if (source.type === 'xml') {
              const text = await res.text();
              parsedData = parseXMLData(text);
            } else if (source.type === 'json') {
              parsedData = await res.json();
            } else { 
              let text: string;
              if (source.parserConfig?.encoding) {
                  const buffer = await res.arrayBuffer();
                  const decoder = new TextDecoder(source.parserConfig.encoding);
                  text = decoder.decode(buffer);
              } else {
                  text = await res.text();
              }
              parsedData = await parseCsvInWorker(text, source.parserConfig);
            }

            const mappedData = await source.map(parsedData);
            const finalData = applyPriceDropLogic(mappedData, cachedData);

            productsBySourceRef.current.set(source.name, finalData);
            refreshState();

          } catch (e) {
            console.error(`Error processing ${source.name}:`, e);
            const errorMessage = e instanceof Error ? e.message : 'Eroare necunoscută.';
            setSourceErrors(prev => [...prev, { name: source.name, message: errorMessage }]);
          }
      });

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
      isUsingDatabase,
      refetch: () => fetchProducts(true) 
  };
};
