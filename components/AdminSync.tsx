
import React, { useState } from 'react';
import { useProductsData } from '../hooks/useProductsData';
import { supabase } from '../lib/supabase';
import { mapProductToDb } from '../utils/dbMapper';

const AdminSync: React.FC = () => {
  const { products, loading, refetch } = useProductsData();
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [`${new Date().toLocaleTimeString()} - ${msg}`, ...prev]);

  const handleSync = async () => {
    if (products.length === 0) {
        addLog("Nu există produse încărcate. Așteaptă încărcarea CSV-urilor.");
        return;
    }

    setSyncing(true);
    setProgress('Începe sincronizarea...');
    addLog(`Pregătesc ${products.length} produse pentru baza de date...`);

    try {
        // 1. Transform data
        // mapProductToDb now ensures part_number is always a string and trimmed
        const rawDbRows = products.map(mapProductToDb);
        
        // 1.1 Deduplicate rows based on part_number
        const uniqueRowsMap = new Map();
        let duplicateCount = 0;

        rawDbRows.forEach(row => {
            if (row.part_number) {
                // Check if we already have this part number
                if (uniqueRowsMap.has(row.part_number)) {
                    duplicateCount++;
                }
                // Overwrite: If duplicate exists, we keep the last one found (usually from a higher priority source if sorted, or just random)
                uniqueRowsMap.set(row.part_number, row);
            }
        });
        
        const dbRows = Array.from(uniqueRowsMap.values());
        
        if (duplicateCount > 0) {
            addLog(`Corecție date: S-au eliminat ${duplicateCount} coduri duplicate (ex: 123 vs "123").`);
            addLog(`Total produse unice de trimis: ${dbRows.length}.`);
        } else {
            addLog(`Date curate: Toate cele ${dbRows.length} produse sunt unice.`);
        }
        
        // 2. Batch upload (Supabase accepts max request sizes, safer to batch 1000 rows)
        const BATCH_SIZE = 500;
        const totalBatches = Math.ceil(dbRows.length / BATCH_SIZE);
        let hasErrors = false;
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * BATCH_SIZE;
            const end = start + BATCH_SIZE;
            const batch = dbRows.slice(start, end);
            
            setProgress(`Se încarcă pachetul ${i + 1} din ${totalBatches}...`);
            
            const { error } = await supabase
                .from('products')
                .upsert(batch, { onConflict: 'part_number' });

            if (error) {
                console.error("Supabase Error:", error);
                
                if (error.code === '42P01') {
                     addLog("CRITIC: Tabelul 'products' nu există în baza de date.");
                     addLog("SOLUȚIE: Mergi în Supabase -> SQL Editor și rulează scriptul de creare a tabelului.");
                     setSyncing(false);
                     hasErrors = true;
                     break; // Stop syncing immediately
                } else if (error.code === '42501') {
                     addLog("CRITIC: Permisiune refuzată (RLS).");
                     addLog("SOLUȚIE: Rulează scriptul SQL pentru politici (Policies).");
                     setSyncing(false);
                     hasErrors = true;
                     break;
                } else {
                    addLog(`Eroare la pachetul ${i+1}: ${error.message}`);
                    hasErrors = true; 
                }
            }
        }
        
        if (!hasErrors) {
            addLog("Sincronizare finalizată cu succes!");
            setProgress('Gata. Dă refresh paginii pentru a folosi baza de date.');
        } else {
            setProgress('Sincronizare finalizată cu erori. Verifică log-ul.');
        }

    } catch (e: any) {
        addLog(`Eroare critică: ${e.message}`);
    } finally {
        setSyncing(false);
    }
  };

  if (!loading && products.length === 0) {
      return (
          <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200 my-4">
              <h3 className="font-bold text-yellow-800">Admin Sync</h3>
              <p className="text-sm text-yellow-700">Nu sunt date disponibile.</p>
              <button onClick={() => refetch()} className="text-blue-600 underline text-sm mt-1">Încarcă datele din CSV</button> pentru a putea sincroniza.
          </div>
      )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-8 mb-8 animate-fade-in-down">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center">
            <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded mr-2 border border-purple-200">ADMIN</span>
            Sincronizare Bază de Date
        </h2>
        
        <div className="mb-4 text-sm text-gray-600">
            <p>Această unealtă ia produsele procesate din CSV-uri (browser) și le salvează în Supabase.</p>
            <p>Produse disponibile în memorie: <strong className="text-blue-600">{products.length.toLocaleString()}</strong></p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button
                onClick={handleSync}
                disabled={syncing || loading}
                className={`px-6 py-2 rounded-md font-bold text-white transition-colors shadow-sm ${
                    syncing || loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2'
                }`}
            >
                {syncing ? 'Se sincronizează...' : 'SYNC TO DATABASE'}
            </button>
        </div>

        {progress && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4 overflow-hidden">
                <div className={`h-2.5 rounded-full ${progress.includes('Eroare') || progress.includes('erori') ? 'bg-red-500' : 'bg-green-600 animate-pulse-fast'}`} style={{ width: '100%' }}></div>
            </div>
        )}
        <p className={`text-sm font-semibold mb-2 ${progress.includes('Eroare') || progress.includes('erori') ? 'text-red-600' : 'text-green-700'}`}>{progress}</p>

        <div className="bg-gray-900 text-green-400 p-4 rounded-md h-48 overflow-y-auto text-xs font-mono shadow-inner border border-gray-700">
            {log.length === 0 ? <span className="text-gray-500 opacity-50">Log-urile vor apărea aici...</span> : log.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
        </div>
    </div>
  );
};

export default AdminSync;
