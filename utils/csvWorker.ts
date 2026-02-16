
// This worker script is defined as a string to allow dynamic creation via Blob,
// ensuring it works without complex bundler configurations for separate worker files.

const workerCode = `
importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');

self.onmessage = function(e) {
    const { text, config, id } = e.data;
    try {
        const result = parseCSV(text, config);
        self.postMessage({ id, success: true, data: result });
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};

function parseCSV(text, config) {
    if (text.charCodeAt(0) === 0xFEFF) {
        text = text.slice(1);
    }

    // Logic ported from original csvParser.ts

    // Case 1: Column Mapping (Position based)
    if (config.columnMapping) {
        const papaConfig = { skipEmptyLines: true };
        if (config.delimiter) papaConfig.delimiter = config.delimiter;
        
        const parseResult = Papa.parse(text, papaConfig);
        if (parseResult.errors.length > 0) {
            const fatalError = parseResult.errors.find(e => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
            if (fatalError) throw new Error("CSV Parsing Error: " + fatalError.message);
        }
        
        const table = parseResult.data;
        if (table.length === 0) return [];

        const headers = config.columnMapping;
        const dataRows = table.slice(1);

        return dataRows.map(row => {
            if (row.every(cell => !cell || !String(cell).trim())) return null;
            const product = {};
            headers.forEach((header, index) => {
                if (header && index < row.length) {
                    product[header] = row[index];
                }
            });
            return product;
        }).filter(p => p !== null);
    }

    // Case 2: Required Headers (Name based)
    if (config.requiredHeaders && config.requiredHeaders.length > 0) {
        const papaConfig = { skipEmptyLines: true };
        if (config.delimiter) papaConfig.delimiter = config.delimiter;

        const parseResult = Papa.parse(text, papaConfig);
         if (parseResult.errors.length > 0) {
            const fatalError = parseResult.errors.find(e => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
            if (fatalError) {
                 // We ignore recoverable errors like row length mismatches here, matching original logic
                 // throw new Error("CSV Parsing Error: " + fatalError.message);
            }
        }

        const allRows = parseResult.data;
        if (allRows.length === 0) return [];

        const requiredLower = config.requiredHeaders.map(h => h.toLowerCase());
        let headerRowIndex = -1;
        let originalHeaders = [];

        // Robust header detection
        for (let i = 0; i < allRows.length; i++) {
            const potentialHeader = allRows[i].map(h => String(h || '').trim().toLowerCase());
            const matchCount = requiredLower.filter(req => potentialHeader.includes(req)).length;
            const threshold = Math.ceil(requiredLower.length * 0.8);

            if (requiredLower.length > 0 && matchCount >= threshold) {
                headerRowIndex = i;
                originalHeaders = allRows[i].map(h => String(h || '').trim());
                break;
            }
        }

        if (headerRowIndex === -1) {
            const foundHeadersSample = allRows.length > 0 ? allRows[0].join(', ') : 'File Empty';
            throw new Error("Antet (coloane) invalid. Nu s-au gasit coloanele necesare: " + config.requiredHeaders.join(', '));
        }

        const dataRows = allRows.slice(headerRowIndex + 1);

        return dataRows.map(row => {
            if (row.every(cell => !cell || !String(cell).trim())) return null;
            const product = {};
            originalHeaders.forEach((headerName, index) => {
                if (headerName && index < row.length) {
                    product[headerName] = row[index];
                }
            });
            return product;
        }).filter(p => p !== null);
    }

    throw new Error("Invalid CSV Parser config: must include requiredHeaders or columnMapping");
}
`;

// Singleton worker management
let worker: Worker | null = null;
const pendingMap = new Map<string, { resolve: (data: any) => void, reject: (err: any) => void }>();

export const parseCsvInWorker = (text: string, config: any): Promise<any[]> => {
    // Initialize worker if it doesn't exist
    if (!worker) {
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
            const { id, success, data, error } = e.data;
            const resolver = pendingMap.get(id);
            if (resolver) {
                if (success) {
                    resolver.resolve(data);
                } else {
                    resolver.reject(new Error(error));
                }
                pendingMap.delete(id);
            }
        };
        
        worker.onerror = (e) => {
            console.error("Worker fatal error", e);
        };
    }

    const id = Math.random().toString(36).substr(2, 9);
    return new Promise((resolve, reject) => {
        pendingMap.set(id, { resolve, reject });
        worker!.postMessage({ text, config, id });
    });
};