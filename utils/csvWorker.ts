
/* global importScripts, self */
declare var Papa: any;

export const parseCsvInWorker = (text: string, config: any): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        if (typeof window !== 'undefined' && (window as any).Papa) {
            try {
                const result = internalParseCSV((window as any).Papa, text, config);
                return resolve(result);
            } catch (e) {
                return reject(e);
            }
        }

        const workerBlob = new Blob([`
            importScripts('https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js');
            self.onmessage = function(e) {
                const { text, config } = e.data;
                try {
                    const result = parseLogic(Papa, text, config);
                    self.postMessage({ success: true, data: result });
                } catch (err) {
                    self.postMessage({ success: false, error: err.message });
                }
            };

            function parseLogic(Papa, text, config) {
                if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
                const pConfig = { skipEmptyLines: 'greedy' };
                if (config.delimiter) pConfig.delimiter = config.delimiter;
                
                const parseResult = Papa.parse(text, pConfig);
                const allRows = parseResult.data;
                if (!allRows || allRows.length === 0) return [];

                // 1. Strict Column Mapping (e.g. Source 4)
                if (config.columnMapping) {
                    const headers = config.columnMapping;
                    return allRows.slice(1).map(row => {
                        const obj = {};
                        headers.forEach((h, i) => { if(h && i < row.length) obj[h] = row[i]; });
                        return obj;
                    }).filter(o => Object.values(o).some(v => v));
                }

                // 2. Header Finding Logic
                let headerIdx = -1;
                if (config.requiredHeaders) {
                    const req = config.requiredHeaders.map(h => h.toLowerCase());
                    headerIdx = allRows.findIndex(row => {
                        const r = row.map(c => String(c || '').toLowerCase().trim());
                        return req.every(h => r.includes(h)) || (req.length > 3 && req.slice(0, 3).every(h => r.includes(h)));
                    });
                }

                if (headerIdx === -1) {
                    const keywords = ['brand', 'sku', 'price', 'pret', 'artnr', 'article'];
                    headerIdx = allRows.findIndex(row => {
                        const r = row.map(c => String(c || '').toLowerCase());
                        return keywords.some(kw => r.some(cell => cell.includes(kw)));
                    });
                }

                if (headerIdx === -1) headerIdx = allRows.findIndex(row => row.length > 3);
                if (headerIdx === -1) headerIdx = 0;

                const headers = allRows[headerIdx].map(h => String(h || '').trim());
                const dataRows = allRows.slice(headerIdx + 1);

                return dataRows.map(row => {
                    const obj = {};
                    headers.forEach((h, i) => { if(h && i < row.length) obj[h] = row[i]; });
                    return obj;
                }).filter(o => Object.values(o).some(v => v));
            }
        `], { type: 'application/javascript' });

        const worker = new Worker(URL.createObjectURL(workerBlob));
        worker.onmessage = (e) => {
            if (e.data.success) resolve(e.data.data);
            else reject(new Error(e.data.error));
            worker.terminate();
        };
        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };
        worker.postMessage({ text, config });
    });
};

function internalParseCSV(Papa: any, text: string, config: any) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const pConfig: any = { skipEmptyLines: 'greedy' };
    if (config.delimiter) pConfig.delimiter = config.delimiter;
    
    const parseResult = Papa.parse(text, pConfig);
    const allRows = parseResult.data;
    if (!allRows || allRows.length === 0) return [];

    if (config.columnMapping) {
        const headers = config.columnMapping;
        return allRows.slice(1).map(row => {
            const obj: any = {};
            headers.forEach((h, i) => { if(h && i < row.length) obj[h] = row[i]; });
            return obj;
        }).filter((o: any) => Object.values(o).some(v => v));
    }

    let headerIdx = -1;
    if (config.requiredHeaders) {
        const req = config.requiredHeaders.map((h: string) => h.toLowerCase());
        headerIdx = allRows.findIndex((row: any[]) => {
            const r = row.map(c => String(c || '').toLowerCase().trim());
            return req.every(h => r.includes(h));
        });
    }

    if (headerIdx === -1) {
        const keywords = ['brand', 'sku', 'price', 'pret'];
        headerIdx = allRows.findIndex((row: any[]) => {
            const r = row.map(c => String(c || '').toLowerCase());
            return keywords.some(kw => r.some(cell => cell.includes(kw)));
        });
    }

    if (headerIdx === -1) headerIdx = 0;

    const headers = allRows[headerIdx].map((h: any) => String(h || '').trim());
    return allRows.slice(headerIdx + 1).map((row: any[]) => {
        const obj: any = {};
        headers.forEach((h, i) => { if(h && i < row.length) obj[h] = row[i]; });
        return obj;
    }).filter((o: any) => Object.values(o).some(v => v));
}
