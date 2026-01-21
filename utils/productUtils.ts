
import { Product } from '../types';

const keysToNormalize: (keyof Product)[] = ['Size', 'Width', 'Offset', 'CB', 'Load', 'Weight'];

/**
 * Helper to get a property from an object regardless of key casing.
 * Useful for CSV/JSON data from various suppliers.
 */
export const getProp = (obj: any, targetKey: string): any => {
  if (!obj) return undefined;
  if (obj[targetKey] !== undefined) return obj[targetKey];
  
  const lowerTarget = targetKey.toLowerCase();
  const foundKey = Object.keys(obj).find(k => k.toLowerCase() === lowerTarget);
  return foundKey ? obj[foundKey] : undefined;
};

/**
 * Standardizes product attributes to ensure data consistency for filtering.
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
      
      const isComplexValue = standardizedValue.includes(',') || 
                             standardizedValue.includes('/') || 
                             standardizedValue.includes(' ') || 
                             /^-?\d+-\d+$/.test(standardizedValue);
      
      if (!isComplexValue) {
        let numericString = standardizedValue.replace(',', '.');
        const num = parseFloat(numericString);
        
        if (!isNaN(num)) {
           standardizedValue = String(num);
        }
      }

      normalizedProduct[key] = standardizedValue;
    }
  }

  return normalizedProduct;
};
