
import { createClient } from '@supabase/supabase-js';

// Credentials for Pimpit.ro Supabase Project
const SUPABASE_URL = 'https://elfumzzbfrpqyaztxyee.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZnVtenpiZnJwcXlhenR4eWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODg3ODksImV4cCI6MjA4NjU2NDc4OX0.y3T3KYIuDhocc81jq0PsmMWy2JfmsezqcXpGcsGzNcU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const checkSupabaseConnection = async (): Promise<{ success: boolean; message?: string }> => {
    console.log("[Supabase] Verificare conexiune la:", SUPABASE_URL);

    // Basic validation to ensure placeholder keys aren't being used
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        return { success: false, message: 'Configuration missing: PROJECT_ID not set.' };
    }
    try {
        // We do a lightweight check. 'head: true' returns only headers/count, no data.
        // This validates connection AND that the 'products' table exists.
        const { error } = await supabase.from('products').select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error("[Supabase] Connection Error Object:", error);
            
            // Error code 42P01 means 'undefined_table' (table missing)
            if (error.code === '42P01') {
                console.warn("[Supabase] Table 'products' is missing.");
                return { 
                    success: false, 
                    message: "Conectat la Supabase, dar tabelul 'products' lipsește. Te rog rulează conținutul fișierului 'schema.sql' în SQL Editor din Supabase." 
                };
            }
            return { success: false, message: `Eroare conexiune Supabase: ${error.message} (Cod: ${error.code})` };
        }
        
        console.log("[Supabase] Conexiune reușită.");
        return { success: true };
    } catch (e) {
        console.error("[Supabase] Exception:", e);
        return { success: false, message: "Eroare neașteptată la conectarea cu baza de date." };
    }
};
