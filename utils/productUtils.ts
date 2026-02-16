
import { Product } from '../types';

const keysToNormalize: (keyof Product)[] = ['Size', 'Width', 'Offset', 'CB', 'Load', 'Weight'];
/**
 * Helper to get a property from an object regardless of key casing, spaces or special characters.
 */
export const getProp = (obj: any, targetKey: string): any => {
  if (!obj) return undefined;
  
  // 1. Direct match
  if (obj[targetKey] !== undefined) return obj[targetKey];
  
  // 2. Normalized match (lowercase, no spaces)
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedTarget = normalize(targetKey);
  
  const foundKey = Object.keys(obj).find(k => normalize(k) === normalizedTarget);
  return foundKey ? obj[foundKey] : undefined;
};
/**
 * Standardizes product attributes to ensure data consistency for filtering.
 * - Trims whitespace from all string values.
 * - For single numeric values, it normalizes decimal separators and formats (e.g., "8,5" becomes "8.5", "7." becomes "7").
 * - It explicitly PRESERVES complex values like lists ("0, 1, 2") or ranges ("20-40") without modification.
 * @param product The product object to normalize.
 * @returns The normalized product object.
 */
export const normalizeProductAttributes = (product: Product): Product => {
  const normalizedProduct = { ...product };

  // Trim all string values first 
  for (const key in normalizedProduct) {
    if (typeof normalizedProduct[key] === 'string') {
      normalizedProduct[key] = String(normalizedProduct[key]).trim();
    }
  }
  
  // Standardize specific numeric-like fields
  for (const key of keysToNormalize) {
    const value = normalizedProduct[key];
    if (typeof value === 'string' && value) {
      let standardizedValue = value;
      
      // Check for complex values (lists, ranges, etc.) which should not be parsed as a single number.
      const isComplexValue = standardizedValue.includes(',') || 
                             standardizedValue.includes('/') || 
                             standardizedValue.includes(' ') || 
                             /^-?\d+-\d+$/.test(standardizedValue);
      
      if (!isComplexValue) {
        // It appears to be a single value, so let's try to clean it as a number.
        // This handles decimal commas ("8,5") and trailing punctuation ("7.").
        let numericString = standardizedValue.replace(',', '.');
        const num = parseFloat(numericString);
        
        if (!isNaN(num)) {
           // Successfully parsed as a number. This cleans up "7." -> "7", "8.50" -> "8.5".
           standardizedValue = String(num);
        }
      }

      normalizedProduct[key] = standardizedValue;
    }
  }

  return normalizedProduct;
};