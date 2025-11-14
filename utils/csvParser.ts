import { Product, ParserConfig } from '../types';

// Let TypeScript know that Papa is available globally from the script tag in index.html
declare var Papa: any;

/**
 * Robustly parses CSV text into an array of product objects.
 * This version is designed to be resilient to malformed CSV files, such as those with
 * inconsistent column counts per row or minor header name variations.
 */
export const parseCSVData = (text: string, config: ParserConfig): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1); // Remove BOM
  }
  
  // --- Case 1: Position-based mapping (for files without reliable headers like Source 4) ---
  if (config.columnMapping) {
    const papaConfig: any = { skipEmptyLines: true };
    if (config.delimiter) papaConfig.delimiter = config.delimiter;
    
    const parseResult = Papa.parse(text, papaConfig);
    if (parseResult.errors.length > 0) {
      const fatalError = parseResult.errors.find((e: any) => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
      if (fatalError) throw new Error(`CSV Parsing Error: ${fatalError.message}`);
    }
    const table: string[][] = parseResult.data;
    if (table.length === 0) return [];
    
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

  // --- Case 2: Robust Header-based mapping (for all other sources) ---
  if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    const papaConfig: any = { skipEmptyLines: true };
    if (config.delimiter) papaConfig.delimiter = config.delimiter;

    // We parse without headers to get an array of arrays, which is easier to work with for inconsistent files.
    const parseResult = Papa.parse(text, papaConfig);
    
    // We will tolerate field count mismatch errors, but log them.
    if (parseResult.errors.length > 0) {
      const fatalError = parseResult.errors.find((e: any) => e.code !== 'TooFewFields' && e.code !== 'TooManyFields');
      if (fatalError) {
        console.error('PapaParse Fatal Error:', fatalError);
        throw new Error(`CSV Parsing Error: ${fatalError.message}`);
      }
      console.warn('PapaParse Recoverable Errors:', parseResult.errors);
    }

    const allRows: string[][] = parseResult.data;
    if (allRows.length === 0) return [];

    const requiredLower = config.requiredHeaders.map(h => h.toLowerCase());
    let headerRowIndex = -1;
    let originalHeaders: string[] = [];

    // Find the header row by checking which row is the best match for the required headers.
    for (let i = 0; i < allRows.length; i++) {
      const potentialHeader = allRows[i].map(h => String(h || '').trim().toLowerCase());
      const matchCount = requiredLower.filter(req => potentialHeader.includes(req)).length;
      
      // We need a high degree of confidence. Let's require at least 80% of headers to match.
      // This provides resilience against minor column name changes or a few missing columns.
      const threshold = Math.ceil(requiredLower.length * 0.8);

      if (requiredLower.length > 0 && matchCount >= threshold) {
        headerRowIndex = i;
        // Use the actual headers from the file for mapping
        originalHeaders = allRows[i].map(h => String(h || '').trim()); 
        break;
      }
    }


    if (headerRowIndex === -1) {
      // Get the first row from the file as a sample of what was found.
      const foundHeadersSample = allRows.length > 0 ? allRows[0].join(', ') : 'Fișier gol';
      
      const errorMessage = `Antet (coloane) invalid. Așteptat: [..., ${config.requiredHeaders.slice(0, 3).join(', ')}, ...]. Găsit: [${foundHeadersSample}].`;
      
      console.error("Robust Parser: Could not find required CSV headers.", { 
          required: config.requiredHeaders, 
          filePreview: allRows.slice(0, 5) 
      });

      throw new Error(errorMessage);
    }

    const dataRows = allRows.slice(headerRowIndex + 1);

    return dataRows.map(row => {
      if (row.every(cell => !cell || !String(cell).trim())) return null;

      const product: Product = {};
      originalHeaders.forEach((headerName, index) => {
        // This gracefully handles rows that are shorter than the header row.
        if (headerName && index < row.length) {
          product[headerName] = row[index];
        }
      });
      return product;
    }).filter((p): p is Product => p !== null);
  }

  throw new Error("CSV parser config must include either 'requiredHeaders' or 'columnMapping'.");
};