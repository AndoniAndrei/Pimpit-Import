
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://elfumzzbfrpqyaztxyee.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '...';
const supabase = createClient(supabaseUrl, supabaseKey);

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const results: any = {
    timestamp: new Date().toISOString(),
    tables: {},
    sync_status: {},
  };

  try {
    // 1. Check published_catalog_products
    const { count: publishedCount, error: publishedError } = await supabase
      .from('published_catalog_products')
      .select('*', { count: 'exact', head: true });
    
    results.tables.published_catalog_products = {
      exists: !publishedError || publishedError.code !== '42P01',
      count: publishedCount || 0,
      error: publishedError ? { message: publishedError.message, code: publishedError.code } : null
    };

    // 2. Check sync_runs
    const { data: lastSync, error: syncError } = await supabase
      .from('sync_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastSync) {
      results.sync_status = {
        id: lastSync.id,
        status: lastSync.status,
        started_at: lastSync.started_at,
        finished_at: lastSync.finished_at,
        total_raw: lastSync.total_raw_products,
        total_valid: lastSync.total_valid_products,
        total_inserted: lastSync.total_inserted_products,
        error_summary: lastSync.error_summary,
        publish_decision: lastSync.status === 'completed' ? 'EXECUTAT' : (lastSync.status === 'failed' ? 'REFUZAT/EROARE' : 'IN CURS'),
      };

      // 3. Check sync_run_sources for the last run
      const { data: sources } = await supabase
        .from('sync_run_sources')
        .select('*')
        .eq('sync_run_id', lastSync.id);
      
      results.sync_status.sources = sources?.map(s => ({
        name: s.source_identifier,
        status: s.status,
        raw: s.raw_count,
        valid: s.valid_count,
        error: s.message
      })) || [];

      // 4. Check issues for this specific run
      const { data: issues } = await supabase
        .from('product_import_issues')
        .select('issue_type')
        .eq('sync_run_id', lastSync.id);
      
      const issueCounts: Record<string, number> = {};
      issues?.forEach(i => {
        issueCounts[i.issue_type] = (issueCounts[i.issue_type] || 0) + 1;
      });
      results.sync_status.issue_counts = issueCounts;
    } else {
      results.sync_status = { message: "Nicio rulare de sync gasita." };
    }

    // 5. Global stats
    const { count: totalIssues } = await supabase
      .from('product_import_issues')
      .select('*', { count: 'exact', head: true });
    
    results.global_stats = {
      total_import_issues: totalIssues || 0
    };

    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
