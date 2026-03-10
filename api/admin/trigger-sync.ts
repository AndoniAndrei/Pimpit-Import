import { runSyncPipeline } from '../../utils/sync/syncPipeline';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://elfumzzbfrpqyaztxyee.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      ok: false, 
      status: "error", 
      message: "Method Not Allowed. Folosiți POST." 
    });
  }

  try {
    // Verificăm conectivitatea la baza de date înainte de a porni
    const { error: pingError } = await supabase.from('sync_runs').select('id').limit(1);
    if (pingError) {
      throw new Error(`Eroare conexiune Supabase: ${pingError.message}`);
    }

    // Pornim pipeline-ul în background
    // ATENȚIE: În Vercel (fără configurări speciale), funcțiile serverless "îngheață" 
    // imediat după ce se trimite răspunsul (res.json). 
    // Dacă sync-ul durează mult, Vercel îl va opri.
    runSyncPipeline().catch(err => {
      console.error("[VERCEL API] Pipeline execution failed:", err);
    });

    return res.status(202).json({
      ok: true,
      status: "accepted",
      message: "Sincronizarea a fost programată și a pornit."
    });

  } catch (error: any) {
    console.error("[VERCEL API] Trigger error:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      message: error.message || "Eroare internă la pornirea sincronizării"
    });
  }
}
