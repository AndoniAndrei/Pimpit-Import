import { Product } from '../types';

const keysToNormalize: (keyof Product)[] = ['Size', 'Width', 'Offset', 'CB', 'Load', 'Weight'];

/**
 * Standardizes product attributes to ensure data consistency for filtering.
 * - Trims whitespace from all string values.
 * - Normalizes decimal separators to a dot (e.g., "8,5" becomes "8.5").
 * - Converts numeric-like strings to a consistent format (e.g., "19.0" becomes "19", "8.50" becomes "8.5").
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
      // Standardize decimal separator from comma to dot
      const standardizedValue = value.replace(',', '.');
      const num = parseFloat(standardizedValue);
      
      // If the value is a valid number, represent it as a standardized string.
      // This converts "8.50" to "8.5" and "8.0" to "8".
      if (!isNaN(num)) {
        normalizedProduct[key] = String(num);
      }
    }
  }

  return normalizedProduct;
};