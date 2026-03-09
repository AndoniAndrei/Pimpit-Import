import { createClient } from '@supabase/supabase-js';
import { allSources } from '../../sources';
import { parseCSVServer } from '../serverCsvParser';
import { PricingRule } from '../pricing/calculateFinalPrice';
import { Product } from '../../types';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://elfumzzbfrpqyaztxyee.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '...';
const supabase = createClient(supabaseUrl, supabaseKey);

export const runSyncPipeline = async () => {
    console.log("[SMOKE TEST] runSyncPipeline INVOCATION START");
    console.log("[DIAGNOSTIC] SYNC START");
    // 1. Create sync_run
    const { data: syncRun, error: syncRunError } = await supabase
        .from('sync_runs')
        .insert({ status: 'running', trigger_type: 'manual' })
        .select()
        .single();
        
    if (syncRunError || !syncRun) {
        console.error("Failed to create sync run", syncRunError);
        return;
    }

    // 2. Fetch pricing rules
    const { data: rulesData } = await supabase.from('pricing_rules').select('*, source_settings(source_identifier)');
    const rulesMap = new Map<string, PricingRule>();
    if (rulesData) {
        rulesData.forEach(r => {
            if (r.source_settings?.source_identifier) {
                rulesMap.set(r.source_settings.source_identifier, r as PricingRule);
            }
        });
    }

    let globalValidProducts: Product[] = [];
    let totalRaw = 0;
    let totalValid = 0;
    let totalInvalid = 0;
    let failedSourcesCount = 0;

    // 3. Process each source
    const CRITICAL_SOURCES = ['Sursa 3', 'Sursa 4', 'Sursa 7']; // Exemplu
    const sourceStatus: Record<string, boolean> = {};

    for (const source of allSources) {
        console.log(`[DIAGNOSTIC] SOURCE START: ${source.name}`);
        let sourceRawCount = 0;
        let sourceValidCount = 0;
        let sourceInvalidCount = 0;
        
        const { data: syncSource, error: syncSourceError } = await supabase
            .from('sync_run_sources')
            .insert({ sync_run_id: syncRun.id, source_identifier: source.name, status: 'running' })
            .select()
            .single();

        try {
            // Fetch data
            let parsedData: any[] = [];
            
            const res = source.fetcher ? await source.fetcher() : await fetch(source.url!);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            if (source.type === 'json') {
                parsedData = await res.json();
            } else {
                // CSV
                let text: string;
                if (source.parserConfig?.encoding) {
                    const buffer = await res.arrayBuffer();
                    const decoder = new TextDecoder(source.parserConfig.encoding);
                    text = decoder.decode(buffer);
                } else {
                    text = await res.text();
                }
                parsedData = parseCSVServer(text, source.parserConfig!);
            }

            sourceRawCount = parsedData.length;
            totalRaw += sourceRawCount;

            const pricingRule = rulesMap.get(source.name);
            const mappedProducts = await source.map(parsedData, pricingRule);

            // Validate products
            for (const p of mappedProducts) {
                const issues: string[] = [];
                if (!p.Price || p.Price <= 0) issues.push('Invalid Price');
                if (!p.Brand) issues.push('Missing Brand');
                if (!p.PartNumber) issues.push('Missing PartNumber');
                
                if (issues.length > 0) {
                    sourceInvalidCount++;
                    totalInvalid++;
                    // Log issue
                    await supabase.from('product_import_issues').insert({
                        sync_run_id: syncRun.id,
                        source_identifier: source.name,
                        external_product_key: p.PartNumber || 'unknown',
                        issue_type: 'validation_failed',
                        message: issues.join(', '),
                        raw_payload_excerpt: p
                    });
                } else {
                    sourceValidCount++;
                    totalValid++;
                    globalValidProducts.push(p);
                }
            }

            if (syncSource) {
                await supabase.from('sync_run_sources').update({
                    status: 'completed',
                    raw_count: sourceRawCount,
                    valid_count: sourceValidCount,
                    invalid_price_count: sourceInvalidCount
                }).eq('id', syncSource.id);
            }
            sourceStatus[source.name] = true;
            console.log(`[DIAGNOSTIC] SOURCE SUCCESS ${source.name}: brute=${sourceRawCount}, valide=${sourceValidCount}`);

        } catch (error: any) {
            console.error(`[DIAGNOSTIC] SOURCE FAIL ${source.name}:`, error.message);
            failedSourcesCount++;
            sourceStatus[source.name] = false;
            if (syncSource) {
                await supabase.from('sync_run_sources').update({
                    status: 'failed',
                    message: error.message
                }).eq('id', syncSource.id);
            }
        }
    }

    // 4. Deduplicate
    const deduplicatedMap = new Map<string, Product>();
    globalValidProducts.forEach(p => {
        // Strategy: Brand + PartNumber
        const key = `${String(p.Brand).toLowerCase()}_${String(p.PartNumber).toLowerCase()}`;
        if (deduplicatedMap.has(key)) {
            const existing = deduplicatedMap.get(key)!;
            // Keep lowest price
            if (p.Price && existing.Price && p.Price < existing.Price) existing.Price = p.Price;
            // Keep max stock
            if ((p.Stock || 0) > (existing.Stock || 0)) existing.Stock = p.Stock;
            // Combine images
            if (p.ImageUrl && !existing.ImageUrl) existing.ImageUrl = p.ImageUrl;
        } else {
            deduplicatedMap.set(key, p);
        }
    });

    const finalProducts = Array.from(deduplicatedMap.values());
    console.log(`[DIAGNOSTIC] DEDUP SUMMARY: ${globalValidProducts.length} -> ${finalProducts.length}`);

    // 5. Strict Validation Before Publish
    // Do not publish if too many sources failed or total products is suspiciously low
    const CRITICAL_SOURCES = ['Sursa 3', 'Sursa 4', 'Sursa 7'];
    const criticalSourceFailed = CRITICAL_SOURCES.some(name => sourceStatus[name] === false);
    
    const MIN_EXPECTED_PRODUCTS = 10000;

    if (criticalSourceFailed || finalProducts.length < MIN_EXPECTED_PRODUCTS) {
        const errorMsg = `PUBLISH REFUZAT: Critical source failed (${criticalSourceFailed}) or too few products (${finalProducts.length}). Existing catalog was NOT modified.`;
        console.error(`[DIAGNOSTIC] SYNC: ${errorMsg}`);
        
        await supabase.from('sync_runs').update({
            status: 'failed',
            finished_at: new Date().toISOString(),
            total_raw_products: totalRaw,
            total_valid_products: totalValid,
            total_invalid_products: totalInvalid,
            error_summary: errorMsg
        }).eq('id', syncRun.id);
        
        return; // Abort here, do not truncate
    }

    console.log(`[DIAGNOSTIC] PUBLISH START: ${finalProducts.length} produse`);
    // 6. Publish to published_catalog_products
    const { error: truncError } = await supabase.rpc('truncate_published_products');
    if (truncError) {
        console.error("[DIAGNOSTIC] PUBLISH ERROR (Truncate):", truncError);
        throw new Error(`Truncate failed: ${truncError.message}`);
    }
    
    // Insert in batches
    const dbRows = finalProducts.map(p => {
        return {
            part_number: String(p.PartNumber || '').trim(),
            brand: p.Brand,
            model: p.Model,
            part_description: p.PartDescription,
            price: p.Price,
            old_price: p.OldPrice,
            stock: p.Stock,
            image_url: p.ImageUrl,
            source_file: p.Source, 
            size: p.Size ? String(p.Size) : null,
            width: p.Width ? String(p.Width) : null,
            pcd: p.PCD ? String(p.PCD) : null,
            et: p.Offset ? String(p.Offset) : null,
            finish: p.Finish,
            product_type: p.ProductType,
            metadata: {
                ean: p.EAN,
                cb: p.CB,
                load: p.Load,
                weight: p.Weight,
                description: p.Description,
                image_urls: p.ImageUrls,
                is_winter_approved: p.IsWinterApproved,
                on_the_water_stock: p.OnTheWaterStock,
                youtube_url: p.YoutubeUrl,
                three_sixty_url: p.ThreeSixtyImageUrl,
                tuv_url: p.TuvUrl,
                next_delivery: p.next_delivery
            }
        };
    });

    const BATCH_SIZE = 250; 
    let insertedCount = 0;
    for (let i = 0; i < dbRows.length; i += BATCH_SIZE) {
        const batch = dbRows.slice(i, i + BATCH_SIZE);
        const { error: insError } = await supabase.from('published_catalog_products').insert(batch);
        if (!insError) {
            insertedCount += batch.length;
        } else {
            console.error(`[DIAGNOSTIC] PUBLISH ERROR (Batch ${i}):`, insError);
        }
    }

    console.log(`[DIAGNOSTIC] PUBLISH EXECUTAT: ${insertedCount} produse inserate`);

    // 7. Update sync run
    await supabase.from('sync_runs').update({
        status: 'completed',
        finished_at: new Date().toISOString(),
        total_raw_products: totalRaw,
        total_valid_products: totalValid,
        total_invalid_products: totalInvalid,
        total_inserted_products: insertedCount
    }).eq('id', syncRun.id);
};
