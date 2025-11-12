
import { Product, ParserConfig } from '../types';

// Let TypeScript know that Papa is available globally from the script tag in index.html
declare var Papa: any;

/**
 * Robustly parses CSV text into an array of product objects using the PapaParse library.
 * It supports two configuration modes:
 * 1. `requiredHeaders`: Uses PapaParse's header detection and validates that all required headers are present.
 * 2. `columnMapping`: Maps columns by their position, assuming the first row is a header to be skipped.
 * @param text The raw CSV string.
 * @param config The parser configuration.
 * @returns An array of product objects.
 */
export const parseCSVData = (text: string, config: ParserConfig): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1); // Remove BOM
  }

  // --- Case 1: Header-based mapping (most common) ---
  if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    const papaConfig: any = {
      header: true, // Let PapaParse automatically detect the header row
      skipEmptyLines: true,
    };
    if (config.delimiter) {
      papaConfig.delimiter = config.delimiter;
    }
    // FIX: Pass quoteChar to PapaParse if it is defined in the config.
    if (config.quoteChar) {
      papaConfig.quoteChar = config.quoteChar;
    }

    const parseResult = Papa.parse(text, papaConfig);

    if (parseResult.errors.length > 0) {
      console.error('PapaParse Errors:', parseResult.errors);
      throw new Error(`CSV Parsing Error: ${parseResult.errors[0].message}`);
    }

    // Validate that all required headers were found by PapaParse
    const foundHeaders = (parseResult.meta.fields || []).map(h => String(h || '').trim().toLowerCase());
    const missingHeaders = config.requiredHeaders.filter(
      reqHeader => !foundHeaders.includes(reqHeader.toLowerCase())
    );
    
    if (missingHeaders.length > 0) {
      console.error(
        "Could not find required CSV headers.",
        { required: config.requiredHeaders, found: parseResult.meta.fields, missing: missingHeaders },
        "First 10 lines of file:", text.split(/\r?\n|\r/).slice(0, 10).join('\n')
      );
      throw new Error(`Could not find the required CSV header. Please check the file structure.`);
    }
    
    // PapaParse returns an array of objects directly. Filter out any completely empty rows.
    return parseResult.data.filter((row: Product) => 
        Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '')
    );
  }

  // --- Case 2: Position-based mapping (for files without reliable headers) ---
  if (config.columnMapping) {
    const papaConfig: any = {
      skipEmptyLines: true,
    };
    if (config.delimiter) {
      papaConfig.delimiter = config.delimiter;
    }
    // FIX: Pass quoteChar to PapaParse if it is defined in the config.
    if (config.quoteChar) {
      papaConfig.quoteChar = config.quoteChar;
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
    
    const headers = config.columnMapping;
    const dataRows = table.slice(1); // Assumes first row is a header and skips it

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
  }
  
  // --- Fallback error ---
  throw new Error("CSV parser config must include either 'requiredHeaders' or 'columnMapping'.");
};
