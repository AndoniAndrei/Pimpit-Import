
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
          
          if (totalRows === 0) return false;

          let allDbProducts: Product[] = [];
          const PAGE_SIZE = 1000; 
          let from = 0;
          let hasMore = true;

          setLoadingMessage(`Se încarcă catalogul... (0 din ${totalRows})`);

          while (hasMore) {
              const to = from + PAGE_SIZE - 1;
              const { data, error } = await supabase.from('products').select('*').range(from, to);
              
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
          return false;
      }
  };

  const performBackgroundSync = async () => {
      if (isSyncing) return;
      setIsSyncing(true);
      console.log("Starting Background Sync...");

      try {
        const processedProducts: Product[] = [];
        const errors: SourceError[] = [];
        
        for (const source of allSources) {
            console.log(`Syncing ${source.name}...`);
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
                console.log(`${source.name}: Found ${mapped.length} products.`);
                processedProducts.push(...mapped);
            } catch (e) {
                console.error(`Sync error source ${source.name}`, e);
                errors.push({ name: source.name, message: e instanceof Error ? e.message : 'Eroare necunoscută' });
            }
        }

        setSourceErrors(errors);

        // Lower threshold slightly (8k) to be safe but still protective
        if (processedProducts.length < 8000) {
            console.error(`Safety Abort: Only ${processedProducts.length} products found. Aborting sync to preserve data.`);
            throw new Error("Sincronizare eșuată: Prea puține produse găsite.");
        }

        console.log(`Data sync successful (${processedProducts.length} items). Updating database...`);
        
        const { error: truncError } = await supabase.rpc('truncate_products');
        if (truncError) throw truncError;

        const dbRows = processedProducts.map(mapProductToDb);
        const BATCH_SIZE = 250; 
        
        for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
            const batch = dbRows.slice(i, i + BATCH_SIZE);
            const { error: insError } = await supabase.from('products').insert(batch);
            if (insError) {
                console.error("Batch insert error at index " + i, insError);
            }
        }

        await supabase.from('sync_status').upsert({ id: 1, last_synced_at: new Date().toISOString(), is_syncing: false });
        
        console.log("Sync finished. Refreshing view...");
        setProducts([]); 
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
          const { data: statusData } = await supabase.from('sync_status').select('*').eq('id', 1).single();
          const lastSynced = statusData?.last_synced_at ? new Date(statusData.last_synced_at).getTime() : 0;
          const now = Date.now();
          const hoursSinceSync = (now - lastSynced) / (1000 * 60 * 60);

          const hasData = await loadFromSupabase();

          // Sync if data is older than 2 hours or missing
          if (!hasData || hoursSinceSync > 2) {
              if (!hasData) setLoadingMessage("Se inițializează catalogul pentru prima dată...");
              performBackgroundSync();
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
