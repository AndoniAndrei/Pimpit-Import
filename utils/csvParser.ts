
import { Product, ParserConfig } from '../types';

// Helper function to detect the delimiter (comma vs. semicolon)
const getDelimiter = (line: string): string => {
  const commaCount = (line.match(/,/g) || []).length;
  const semicolonCount = (line.match(/;/g) || []).length;
  return (semicolonCount > commaCount && semicolonCount > 0) ? ';' : ',';
};

// Full CSV parser that handles multi-line rows, quotes, and delimiters
const parseFullCsv = (text: string): string[][] => {
    const table: string[][] = [];
    if (!text) return table;
    const delimiter = getDelimiter(text.substring(0, 1000));
    let currentRow: string[] = [];
    let currentVal = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < text.length && text[i + 1] === '"') {
                    currentVal += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                currentVal += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === delimiter) {
                currentRow.push(currentVal.trim());
                currentVal = '';
            } else if (char === '\r' || char === '\n') {
                if(currentVal || currentRow.length > 0) {
                    currentRow.push(currentVal.trim());
                    table.push(currentRow);
                    currentRow = [];
                    currentVal = '';
                }
                if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
                    i++;
                }
            } else {
                currentVal += char;
            }
        }
    }
    if(currentVal || currentRow.length > 0) {
        currentRow.push(currentVal.trim());
        table.push(currentRow);
    }
    return table.filter(row => row.length > 1 || (row.length === 1 && row[0] !== ''));
};


// Robust function to parse CSV text into an array of objects
export const parseCSVData = (text: string, config: ParserConfig): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const table = parseFullCsv(text);
  if (table.length === 0) throw new Error("CSV parsing resulted in an empty table.");

  let headers: string[] = [];
  let dataRows: string[][];

  if (config.columnMapping) {
    // Position-based mapping. Assume no header row or ignore it.
    headers = config.columnMapping;
    dataRows = table;
  } else if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    // Header-based mapping
    let headerIndex = -1;
    for (let i = 0; i < table.length; i++) {
        const potentialHeaders = table[i].map(h => h ? h.trim() : '');
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
    if (row.every(cell => !cell || !cell.trim())) return null;
    const product: Product = {};
    headers.forEach((header, index) => {
        if (header && index < row.length) {
            product[header] = row[index];
        }
    });
    return product;
  }).filter((p): p is Product => p !== null);
};