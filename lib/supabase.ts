
import { createClient } from '@supabase/supabase-js';

// Credentials for Pimpit.ro Supabase Project
const SUPABASE_URL = 'https://elfumzzbfrpqyaztxyee.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsZnVtenpiZnJwcXlhenR4eWVlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5ODg3ODksImV4cCI6MjA4NjU2NDc4OX0.y3T3KYIuDhocc81jq0PsmMWy2JfmsezqcXpGcsGzNcU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const checkSupabaseConnection = async () => {
    // Basic validation to ensure placeholder keys aren't being used
    if (SUPABASE_URL.includes('YOUR_PROJECT_ID')) {
        return false;
    }
    try {
        // We do a lightweight check. 'head: true' returns only headers/count, no data.
        // This validates connection AND that the 'products' table exists.
        const { error } = await supabase.from('products').select('count', { count: 'exact', head: true });
        
        if (error) {
            // Error code 42P01 means 'undefined_table' (table missing)
            if (error.code === '42P01') {
                console.warn("Supabase Connected, but 'products' table is missing.");
                return false;
            }
            console.warn("Supabase connection check failed:", error.message);
            return false;
        }
        return true;
    } catch (e) {
        console.error("Supabase connection exception:", e);
        return false;
    }
};
