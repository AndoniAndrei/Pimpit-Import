
import { useState, useEffect, useRef } from 'react';
import { Product, SourceError } from '../types';
import { allSources } from '../sources';
import { parseXMLData } from '../utils/xmlParser';
import { parseCsvInWorker } from '../utils/csvWorker'; 
import { supabase, checkSupabaseConnection } from '../lib/supabase';
import { mapDbToProduct, mapProductToDb } from '../utils/dbMapper';

export const useProductsData = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [sourceErrors, setSourceErrors] = useState<SourceError[]>([]);
  const [isUsingDatabase, setIsUsingDatabase] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load products from DB (Fast)
  const loadFromSupabase = async () => {
      try {
          const { count } = await supabase.from('products').select('*', { count: 'exact', head: true });
          const totalRows = count || 0;
          
          if (totalRows === 0) return false; // DB is empty

          let allDbProducts: Product[] = [];
          const PAGE_SIZE = 5000;
          let from = 0;
          let hasMore = true;

          setLoadingMessage(`Se încarcă catalogul...`);

          while (hasMore) {
              const to = from + PAGE_SIZE - 1;
              const { data, error } = await supabase.from('products').select('*').range(from, to);
              
              if (error) throw error;
              
              if (data && data.length > 0) {
                  const mappedBatch = data.map(mapDbToProduct);
                  allDbProducts = allDbProducts.concat(mappedBatch);
                  // Update UI incrementally so user sees something fast
                  setProducts(prev => [...prev, ...mappedBatch]);
                  
                  if (data.length < PAGE_SIZE) hasMore = false;
                  else from += PAGE_SIZE;
              } else {
                  hasMore = false;
              }
          }
          setIsUsingDatabase(true);
          setLoading(false); // Done loading initial view
          return true;
      } catch (e) {
          console.error("Error loading from Supabase:", e);
          return false;
      }
  };

  // The Heavy Worker: Background Sync
  const performBackgroundSync = async () => {
      if (isSyncing) return;
      setIsSyncing(true);
      console.log("Starting Background Sync...");

      try {
        // 1. Fetch CSVs (Browser Logic)
        const processedProducts: Product[] = [];
        const fetchPromises = allSources.map(async (source) => {
            try {
                const fetchOptions: RequestInit = { cache: 'no-store' };
                const res = source.fetcher ? await source.fetcher() : await fetch(source.url!, fetchOptions);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

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
                const mapped = await source.map(parsedData);
                processedProducts.push(...mapped);
            } catch (e) {
                console.error(`Sync error source ${source.name}`, e);
            }
        });

        await Promise.allSettled(fetchPromises);

        if (processedProducts.length === 0) throw new Error("No products fetched from CSVs.");

        // 2. Wipe DB (RPC)
        const { error: truncError } = await supabase.rpc('truncate_products');
        if (truncError) throw truncError;

        // 3. Batch Insert (Raw Data, No Upsert Check)
        const dbRows = processedProducts.map(mapProductToDb);
        const BATCH_SIZE = 1000;
        
        for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
            const batch = dbRows.slice(i, i + BATCH_SIZE);
            const { error: insError } = await supabase.from('products').insert(batch);
            if (insError) console.error("Batch insert error", insError);
        }

        // 4. Update Status
        await supabase.from('sync_status').upsert({ id: 1, last_synced_at: new Date().toISOString(), is_syncing: false });
        
        // 5. Refresh UI with new data
        await loadFromSupabase();

      } catch (e) {
          console.error("Sync Failed", e);
      } finally {
          setIsSyncing(false);
      }
  };

  const initData = async () => {
      setLoading(true);
      const isConnected = await checkSupabaseConnection();
      
      if (isConnected) {
          // 1. Check if we need to sync
          const { data: statusData } = await supabase.from('sync_status').select('*').eq('id', 1).single();
          const lastSynced = statusData?.last_synced_at ? new Date(statusData.last_synced_at).getTime() : 0;
          const now = Date.now();
          const hoursSinceSync = (now - lastSynced) / (1000 * 60 * 60);

          // 2. Load what we have
          const hasData = await loadFromSupabase();

          // 3. If empty or old (>1 hour), trigger sync
          if (!hasData || hoursSinceSync > 1) {
              if (!hasData) setLoadingMessage("Se inițializează catalogul pentru prima dată (poate dura 1 minut)...");
              performBackgroundSync(); // Don't await this if we have data, let it run in bg
          }
      } else {
          setSourceErrors([{ name: 'System', message: 'Nu s-a putut conecta la baza de date.'}]);
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
      isSyncing
  };
};
