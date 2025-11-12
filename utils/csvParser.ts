import { Product, ParserConfig } from '../types';

// Let TypeScript know that Papa is available globally from the script tag in index.html
declare var Papa: any;

/**
 * Robustly parses CSV text into an array of product objects using the PapaParse library.
 * It supports two configuration modes:
 * 1. `requiredHeaders`: Searches the CSV for a header row containing these headers and maps subsequent rows.
 * 2. `columnMapping`: Maps columns by their position using the provided array of names, assuming no header row.
 * @param text The raw CSV string.
 * @param config The parser configuration.
 * @returns An array of product objects.
 */
export const parseCSVData = (text: string, config: ParserConfig): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1); // Remove BOM
  }

  const papaConfig: any = {
    skipEmptyLines: true,
  };

  if (config.delimiter) {
    papaConfig.delimiter = config.delimiter;
  }

  const parseResult = Papa.parse(text, papaConfig);

  if (parseResult.errors.length > 0) {
    console.error('PapaParse Errors:', parseResult.errors);
    throw new Error(`CSV Parsing Error: ${parseResult.errors[0].message}`);
  }

  const table: string[][] = parseResult.data;
  if (table.length === 0) {
    throw new Error("CSV parsing resulted in an empty table.");
  }

  let headers: string[] = [];
  let dataRows: string[][];

  if (config.columnMapping) {
    // Position-based mapping.
    headers = config.columnMapping;
    dataRows = table;
  } else if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    // Header-based mapping: find the header row first.
    let headerIndex = -1;
    // Search only first 10 rows for performance and to avoid false positives in data.
    for (let i = 0; i < Math.min(table.length, 10); i++) {
        const potentialHeaders = table[i].map(h => h ? String(h).trim() : '');
        const lowercasedHeaders = potentialHeaders.map(h => h.toLowerCase());
        
        if (config.requiredHeaders.every(reqHeader => lowercasedHeaders.includes(reqHeader))) {
            headerIndex = i;
            headers = potentialHeaders;
            break;
        }
    }

    if (headerIndex === -1) {
        console.error("Could not find CSV header. Required headers:", config.requiredHeaders, "First 10 lines of file:", text.split(/\r?\n|\r/).slice(0, 10).join('\n'));
        throw new Error("Could not find the required CSV header. Please check the file structure.");
    }
    dataRows = table.slice(headerIndex + 1);
  } else {
      throw new Error("CSV parser config must include either 'requiredHeaders' or 'columnMapping'.");
  }

  return dataRows.map(row => {
    if (row.every(cell => !cell || !String(cell).trim())) return null;
    const product: Product = {};
    headers.forEach((header, index) => {
        if (header && index < row.length) {
            product[header] = row[index];
        }
    });
    return product;
  }).filter((p): p is Product => p !== null);
};