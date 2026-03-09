import Papa from 'papaparse';
import { Product, ParserConfig } from '../types';

export const parseCSVServer = (text: string, config: ParserConfig): Product[] => {
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  if (config.columnMapping) {
    const papaConfig: any = { skipEmptyLines: true };
    if (config.delimiter) papaConfig.delimiter = config.delimiter;
    
    const parseResult = Papa.parse(text, papaConfig);
    const table: string[][] = parseResult.data as string[][];
    if (table.length === 0) return [];
    
    const headers = config.columnMapping;
    const dataRows = table.slice(1);

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

  if (config.requiredHeaders && config.requiredHeaders.length > 0) {
    const papaConfig: any = { skipEmptyLines: true };
    if (config.delimiter) papaConfig.delimiter = config.delimiter;

    const parseResult = Papa.parse(text, papaConfig);
    const allRows: string[][] = parseResult.data as string[][];
    if (allRows.length === 0) return [];

    const requiredLower = config.requiredHeaders.map(h => h.toLowerCase());
    let headerRowIndex = -1;
    let originalHeaders: string[] = [];

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
      throw new Error(`Antet invalid. Asteptat: ${config.requiredHeaders.join(', ')}`);
    }

    const dataRows = allRows.slice(headerRowIndex + 1);

    return dataRows.map(row => {
      if (row.every(cell => !cell || !String(cell).trim())) return null;
      const product: Product = {};
      originalHeaders.forEach((headerName, index) => {
        if (headerName && index < row.length) {
          product[headerName] = row[index];
        }
      });
      return product;
    }).filter((p): p is Product => p !== null);
  }

  throw new Error("Invalid config");
};
