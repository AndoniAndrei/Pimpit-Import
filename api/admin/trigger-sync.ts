import { runSyncPipeline } from '../../utils/sync/syncPipeline';
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: any, res: any) {
  console.log("[DIAGNOSTIC] TRIGGER REQUEST RECEIVED");
  
  if (req.method !== 'POST') {
    console.log("[DIAGNOSTIC] METHOD VALIDATED: FAILED");
    return res.status(405).json({ 
      ok: false, 
      status: "error", 
      message: "Method Not Allowed. Folosiți POST." 
    });
  }
  console.log("[DIAGNOSTIC] METHOD VALIDATED: PASSED");

  try {
    console.log("[DIAGNOSTIC] ENV CHECK START");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://elfumzzbfrpqyaztxyee.supabase.co';
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseKey || supabaseKey === '...') {
      console.log("[DIAGNOSTIC] ENV CHECK FAILED: Missing Supabase Key");
      return res.status(500).json({
        ok: false,
        status: "error",
        message: "Eroare de configurare server: Cheia Supabase lipsește.",
        details: {
          stage: "ENV_CHECK",
          errorName: "MissingEnvVar",
          errorMessage: "VITE_SUPABASE_ANON_KEY is not defined or invalid in Vercel environment variables.",
          hint: "Adăugați VITE_SUPABASE_ANON_KEY în setările proiectului din Vercel."
        }
      });
    }
    console.log("[DIAGNOSTIC] ENV CHECK PASSED");

    console.log("[DIAGNOSTIC] SUPABASE CHECK START");
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error: pingError } = await supabase.from('sync_runs').select('id').limit(1);
    
    if (pingError) {
      console.log("[DIAGNOSTIC] SUPABASE CHECK FAILED:", pingError.message);
      return res.status(500).json({
        ok: false,
        status: "error",
        message: "Eroare conexiune Supabase",
        details: {
          stage: "SUPABASE_CHECK",
          errorName: pingError.code || "SupabaseError",
          errorMessage: pingError.message,
          hint: "Verificați dacă URL-ul și cheia Supabase sunt corecte și dacă baza de date este activă."
        }
      });
    }
    console.log("[DIAGNOSTIC] SUPABASE CHECK PASSED");

    console.log("[DIAGNOSTIC] PIPELINE INVOCATION START");
    // Pornim pipeline-ul în background
    runSyncPipeline().catch(err => {
      console.error("[VERCEL API] Pipeline execution failed in background:", err);
    });

    console.log("[DIAGNOSTIC] RESPONSE 202 SENT");
    return res.status(202).json({
      ok: true,
      status: "accepted",
      message: "Sincronizarea a fost programată și a pornit.",
      mode: "immediate"
    });

  } catch (error: any) {
    console.error("[DIAGNOSTIC] RESPONSE ERROR SENT:", error);
    return res.status(500).json({
      ok: false,
      status: "error",
      message: "Eroare internă neașteptată la pornirea sincronizării",
      details: {
        stage: "UNKNOWN",
        errorName: error.name || "Error",
        errorMessage: error.message || String(error),
        hint: "Verificați logurile din Vercel pentru stack trace complet."
      }
    });
  }
}
