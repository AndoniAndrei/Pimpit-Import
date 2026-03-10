
import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
dotenvConfig();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://elfumzzbfrpqyaztxyee.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
  console.log("Checking Supabase...");
  console.log("URL:", supabaseUrl);
  console.log("Key defined:", !!supabaseKey);

  if (!supabaseKey) {
    console.error("Supabase Key is missing!");
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.from('sync_runs').select('*').order('started_at', { ascending: false }).limit(5);

  if (error) {
    console.error("Error fetching sync_runs:", error);
  } else {
    console.log("Last 5 sync runs:", JSON.stringify(data, null, 2));
  }

  const { count, error: countError } = await supabase.from('published_catalog_products').select('*', { count: 'exact', head: true });
  if (countError) {
    console.error("Error counting products:", countError);
  } else {
    console.log("Total products:", count);
  }
}

check();
