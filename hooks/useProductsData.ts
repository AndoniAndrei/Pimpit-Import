
import { useState, useEffect } from 'react';
import { Product, SourceError } from '../types';
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { mapDbToProduct } from '../utils/dbMapper';

export const useProductsData = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);
  const [isUsingDatabase, setIsUsingDatabase] = useState(false);

  // Load products from DB (Fast)
  const loadFromSupabase = async () => {
      try {
          const { count } = await supabase.from('published_catalog_products').select('*', { count: 'exact', head: true });
          const totalRows = count || 0;
          
          if (totalRows === 0) {
              setLoading(false);
              return false; // DB is empty
          }

          let allDbProducts: Product[] = [];
          const PAGE_SIZE = 1000; 
          let from = 0;
          let hasMore = true;

          setLoadingMessage(`Se încarcă catalogul... (0 din ${totalRows})`);

          while (hasMore) {
              const to = from + PAGE_SIZE - 1;
              const { data, error } = await supabase.from('published_catalog_products').select('*').range(from, to);
              
              if (error) throw error;
              
              if (data && data.length > 0) {
                  const mappedBatch = data.map(mapDbToProduct);
                  allDbProducts = allDbProducts.concat(mappedBatch);
                  
                  setProducts(prev => {
                      if (from === 0) return mappedBatch; 
                      return [...prev, ...mappedBatch];
                  });

                  setLoadingMessage(`Se încarcă catalogul... (${allDbProducts.length} din ${totalRows})`);
                  
                  if (data.length < PAGE_SIZE) {
                      hasMore = false;
                  } else {
                      from += PAGE_SIZE;
                  }
              } else {
                  hasMore = false;
              }
          }
          setIsUsingDatabase(true);
          setLoading(false); 
          return true;
      } catch (e) {
          console.error("Error loading from Supabase:", e);
          setLoading(false);
          return false;
      }
  };

  const initData = async () => {
      setLoading(true);
      const connectionStatus = await checkSupabaseConnection();
      
      if (connectionStatus.success) {
          const hasData = await loadFromSupabase();
          if (!hasData) {
              setSourceErrors([{ 
                name: 'Catalog Gol', 
                message: 'Catalogul public este gol. Vă rugăm să rulați sincronizarea din panoul de administrare.' 
              }]);
          }
      } else {
          setSourceErrors([{ 
            name: 'System', 
            message: connectionStatus.message || 'Eroare generică de conexiune (verifică consola).' 
          }]);
          setLoading(false);
      }
  };

  useEffect(() => {
    initData();
  }, []);

  return { 
      products, 
      loading, 
      loadingMessage, 
      sourceErrors, 
      isUsingDatabase,
      isSyncing: false // Sync is no longer done in the client
  };
};
