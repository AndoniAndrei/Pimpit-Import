import { Product } from '../types';

const keysToNormalize: (keyof Product)[] = ['Size', 'Width', 'Offset', 'CB', 'Load', 'Weight'];

/**
 * Standardizes product attributes to ensure data consistency for filtering.
 * - Trims whitespace from all string values.
 * - Normalizes decimal separators to a dot (e.g., "8,5" becomes "8.5").
 * - Converts numeric-like strings to a consistent format (e.g., "19.0" or "19." becomes "19", "8.50" becomes "8.5").
 * - Preserves non-standard numeric formats like ranges (e.g., "20-35").
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
      let standardizedValue = value.replace(',', '.');
      
      // Preserve ranges like "20-35" and don't attempt to parse them as a single float.
      const isRange = /^-?\d+--?\d+$/.test(standardizedValue) || /^-?\d+-\d+$/.test(standardizedValue);
      
      if (!isRange) {
          const num = parseFloat(standardizedValue);
          // If the string can be parsed into a valid number, use the parsed version.
          // This cleans up formats like "7.", "7.0" into "7", and "8.50" into "8.5".
          if (!isNaN(num)) {
            standardizedValue = String(num);
          }
      }

      normalizedProduct[key] = standardizedValue;
    }
  }

  return normalizedProduct;
};