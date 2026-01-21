
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

  const loadFromSupabase = async () => {
      try {
          const { count, error: countError } = await supabase.from('products').select('*', { count: 'exact', head: true });
          if (countError) throw countError;
          const totalRows = count || 0;
          
          if (totalRows === 0) return false;

          let allDbProducts: Product[] = [];
          const PAGE_SIZE = 1000; 
          let from = 0;
          let hasMore = true;

          setLoadingMessage(`Se încarcă catalogul... (0 din ${totalRows})`);

          while (hasMore) {
              const to = from + PAGE_SIZE - 1;
              const { data, error } = await supabase.from('products').select('*').range(from, to).order('brand', { ascending: true });
              
              if (error) throw error;
              
              if (data && data.length > 0) {
                  const mappedBatch = data.map(mapDbToProduct);
                  allDbProducts = allDbProducts.concat(mappedBatch);
                  setProducts(prev => from === 0 ? mappedBatch : [...prev, ...mappedBatch]);
                  setLoadingMessage(`Se încarcă catalogul... (${allDbProducts.length} din ${totalRows})`);
                  if (data.length < PAGE_SIZE) hasMore = false;
                  else from += PAGE_SIZE;
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
      const errors: SourceError[] = [];
      const allMappedProducts: Product[] = [];

      try {
        for (const source of allSources) {
            try {
                const res = source.fetcher ? await source.fetcher() : await fetch(source.url!, { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                let parsedData: any[];
                if (source.type === 'xml') {
                    parsedData = parseXMLData(await res.text());
                } else if (source.type === 'json') {
                    parsedData = await res.json();
                } else {
                    let text: string;
                    if (source.parserConfig?.encoding) {
                         text = new TextDecoder(source.parserConfig.encoding).decode(await res.arrayBuffer());
                    } else {
                         text = await res.text();
                    }
                    parsedData = await parseCsvInWorker(text, source.parserConfig);
                }
                const mapped = await source.map(parsedData);
                allMappedProducts.push(...mapped);
            } catch (e) {
                console.error(`Sync error: ${source.name}`, e);
                errors.push({ name: source.name, message: e instanceof Error ? e.message : 'Eroare necunoscută' });
            }
        }

        setSourceErrors(errors);

        // Safeguard: Only update DB if we have a significant portion of the catalog
        // Assuming normal catalog is ~10k+ items, 5k is a safe "halfway" point for critical failure detection.
        if (allMappedProducts.length < 5000) {
            console.error("Sync aborted: Data volume too low. Critical source failure likely.");
            return;
        }

        const { error: truncError } = await supabase.rpc('truncate_products');
        if (truncError) throw truncError;

        const dbRows = allMappedProducts.map(mapProductToDb);
        const BATCH_SIZE = 500; 
        for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
            const batch = dbRows.slice(i, i + BATCH_SIZE);
            await supabase.from('products').insert(batch);
        }

        await supabase.from('sync_status').upsert({ id: 1, last_synced_at: new Date().toISOString() });
        await loadFromSupabase();

      } catch (e) {
          console.error("Sync Process Failed:", e);
      } finally {
          setIsSyncing(false);
      }
  };

  useEffect(() => {
    const init = async () => {
        const isConnected = await checkSupabaseConnection();
        if (!isConnected) {
            setSourceErrors([{ name: 'Sistem', message: 'Conexiunea la baza de date a eșuat.' }]);
            setLoading(false);
            return;
        }
        
        const { data: status } = await supabase.from('sync_status').select('last_synced_at').eq('id', 1).single();
        const lastSynced = status?.last_synced_at ? new Date(status.last_synced_at).getTime() : 0;
        const needsSync = (Date.now() - lastSynced) > (1000 * 60 * 60 * 2); // 2 hours

        const hasData = await loadFromSupabase();
        if (!hasData || needsSync) {
            performBackgroundSync();
        }
    };
    init();
  }, []);

  return { products, loading, loadingMessage, sourceErrors, isUsingDatabase, isSyncing };
};
