import { Product } from '../types';

const keysToNormalize: (keyof Product)[] = ['Size', 'Width', 'Offset', 'CB', 'Load', 'Weight'];

/**
 * Standardizes product attributes to ensure data consistency for filtering.
 * - Trims whitespace from all string values.
 * - Normalizes decimal separators to a dot (e.g., "8,5" becomes "8.5").
 * - Converts numeric-like strings to a consistent format (e.g., "19.0" becomes "19", "8.50" becomes "8.5").
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
      // Standardize decimal separator from comma to dot
      const standardizedValue = value.replace(',', '.');
      
      // A simple regex to check for a valid numeric format (allows for negative numbers and decimals)
      const isSimpleNumber = /^-?\d+(\.\d+)?$/.test(standardizedValue);

      if (isSimpleNumber) {
        const num = parseFloat(standardizedValue);
        // This converts "8.50" to "8.5" and "8.0" to "8" for consistent filtering
        normalizedProduct[key] = String(num);
      } else {
        // It's likely a range or some other format (e.g., "20-35"), so keep the standardized string
        normalizedProduct[key] = standardizedValue;
      }
    }
  }

  return normalizedProduct;
};
