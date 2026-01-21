
/* global importScripts, self */

// Declare Papa for when it's loaded via importScripts in the Worker context
// This fixes: Cannot find name 'Papa'.
declare var Papa: any;

/**
 * --- Client Side (Main Thread Wrapper) ---
 * This part runs in the main thread and provides the interface used by useProductsData.ts.
 */

let workerInstance: Worker | null = null;
let msgId = 0;
const pending = new Map<number, { resolve: (data: any[]) => void, reject: (err: any) => void }>();

/**
 * Sends CSV text to a background worker for parsing to keep the UI responsive.
 * This exported function fixes: File 'file:///utils/csvWorker.ts' is not a module.
 */
export const parseCsvInWorker = (text: string, config: any): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        // Ensure we are in the main thread before creating a Worker
        if (typeof window === 'undefined') {
            return reject(new Error("Worker must be initialized from the main thread"));
        }

        if (!workerInstance) {
            try {
                // Initialize the worker using the current file's URL.
                // Modern bundlers (like Vite or Webpack 5) recognize this pattern to bundle workers.
                workerInstance = new Worker(new URL('./csvWorker.ts', import.meta.url));
                
                workerInstance.onmessage = (e: MessageEvent) => {
                    const { id, success, data, error } = e.data;
                    const handlers = pending.get(id);
                    if (handlers) {
                        pending.delete(id);
                        if (success) handlers.resolve(data);
                        else handlers.reject(new Error(error));
                    }
                };

                workerInstance.onerror = (err) => {
                    console.error("CSV Worker Error:", err);
                    reject(new Error("Failed to initialize CSV worker"));
                };
            } catch (e) {
                console.error("Could not create CSV worker:", e);
                return reject(e);
            }
        }

        const id = msgId++;
        pending.set(id, { resolve, reject });
        workerInstance.postMessage({ text, config, id });
    });
};

/**
 * --- Worker Side Implementation ---
 * This part only runs when the script is loaded as a Web Worker.
 */

// Check if we are running in a worker context (no window object, self is defined)
if (typeof window === 'undefined' && typeof self !== 'undefined') {
    // Load PapaParse from CDN in the background thread
    try {
        importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
    } catch (e) {
        console.error("Worker: Failed to load PapaParse", e);
    }

    self.onmessage = function(e: MessageEvent) {
        const { text, config, id } = e.data;
        try {
            const result = parseCSV(text, config);
            self.postMessage({ id, success: true, data: result });
        } catch (error: any) {
            self.postMessage({ id, success: false, error: error.message });
        }
    };

    /**
     * Internal CSV parsing logic using PapaParse
     */
    function parseCSV(text: string, config: any) {
        if (!text) return [];
        // Handle Byte Order Mark
        if (text.charCodeAt(0) === 0xFEFF) {
            text = text.slice(1);
        }

        // Use 'any' to allow dynamic property assignment
        // This fixes: Property 'delimiter' does not exist on type '{ skipEmptyLines: string; transformHeader: (h: any) => any; }'.
        const papaConfig: any = { 
            skipEmptyLines: 'greedy',
            transformHeader: (h: string) => h.trim().toLowerCase() 
        };
        if (config.delimiter) papaConfig.delimiter = config.delimiter;
        
        // Case 1: Column Mapping (Position based - e.g. Source 4)
        if (config.columnMapping) {
            const parseResult = Papa.parse(text, { skipEmptyLines: 'greedy', delimiter: config.delimiter });
            const table = parseResult.data;
            if (table.length === 0) return [];

            const headers = config.columnMapping;
            // Find the first row that actually looks like data (more than 3 non-empty cells)
            const firstDataRowIndex = table.findIndex((row: any[]) => row.filter(c => c && String(c).trim()).length > 3);
            const dataRows = firstDataRowIndex === -1 ? table : table.slice(firstDataRowIndex);

            return dataRows.map((row: any[]) => {
                const product: any = {};
                headers.forEach((header: string, index: number) => {
                    if (header && index < row.length) {
                        product[header] = row[index];
                    }
                });
                return product;
            }).filter((p: any) => Object.values(p).some(v => v));
        }

        // Case 2: Flexible Header-based mapping
        const parseResult = Papa.parse(text, { skipEmptyLines: 'greedy', delimiter: config.delimiter });
        const allRows = parseResult.data;
        if (allRows.length === 0) return [];

        let headerRowIndex = -1;
        let originalHeaders: string[] = [];

        // Search for header row: must contain at least one of these keywords
        const keywords = ['brand', 'producator', 'sku', 'part', 'price', 'pret', 'uid', 'article', 'model'];
        
        for (let i = 0; i < Math.min(allRows.length, 20); i++) {
            const row = allRows[i].map((h: any) => String(h || '').trim().toLowerCase());
            const hasKeywords = keywords.some(kw => row.some((cell: string) => cell.includes(kw)));
            if (hasKeywords) {
                headerRowIndex = i;
                originalHeaders = allRows[i].map((h: any) => String(h || '').trim());
                break;
            }
        }

        if (headerRowIndex === -1) headerRowIndex = 0; // Fallback to first row
        if (originalHeaders.length === 0) originalHeaders = allRows[headerRowIndex].map((h: any) => String(h || '').trim());

        const dataRows = allRows.slice(headerRowIndex + 1);
        return dataRows.map((row: any[]) => {
            const product: any = {};
            originalHeaders.forEach((headerName: string, index: number) => {
                if (headerName && index < row.length) {
                    product[headerName] = row[index];
                }
            });
            return product;
        }).filter((p: any) => {
            // Validation: must have at least some data to be considered a product
            const vals = Object.values(p).filter(v => v && String(v).trim() !== '');
            return vals.length > 3;
        });
    }
}
