
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

  const fetchProducts = async (forceRefresh = false) => {
      setLoading(true);
      setSourceErrors([]);

      if (!forceRefresh) {
          setLoadingMessage('Se verifică memoria cache...');
          const cachedProducts = await getProductsFromCache();
          if (cachedProducts && cachedProducts.length > 0) {
              setProducts(cachedProducts);
              setLoading(false);
              return;
          }
      }

      setProducts([]); // Clear existing products if refreshing
      
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

      const allProducts: Product[] = [];
      const errors: SourceError[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          allProducts.push(...result.value);
        } else {
          errors.push(result.reason as SourceError);
        }
      });
      
      setProducts(allProducts);
      setSourceErrors(errors);
      setLoading(false);
      setLoadingMessage('');

      if (allProducts.length > 0) {
          saveProductsToCache(allProducts);
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
