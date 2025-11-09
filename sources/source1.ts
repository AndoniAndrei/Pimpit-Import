import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

// Maps data from the first source to the unified product structure
const map = (data: Product[]): Product[] => {
  return data
    .filter(p => p && p['PartNumber'] && String(p['PartNumber']).trim() !== '')
    .map(p => {
      const priceStr = String(p['Pret client in lei/buc'] || '0');
      let cleanValue = priceStr.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
      const price = parseFloat(cleanValue) || 0;

      const imageUrls = ['Image URL', 'Image URL 1', 'Image URL 2', 'Image URL 3', 'Image URL 4']
        .map(key => p[key])
        .filter((url): url is string => url && typeof url === 'string' && url.trim().startsWith('http'));

      // Extract ET/Offset from PartDescription if not already present
      const description = String(p['PartDescription'] || '');
      // Regex to find ET followed by numbers, optionally negative or a range (e.g., ET40, ET-10, ET20-35)
      const etMatch = description.match(/\bET(-?\d+(?:-\d+)?)\b/i);
      const extractedOffset = etMatch ? etMatch[1] : undefined;

      const product: Product = {
        ...p,
        Offset: p['Offset'] || extractedOffset, // Prioritize existing Offset column, fallback to extracted value
        Price: price,
        Stock: parseInt(p['7001'], 10) || 0,
        OnTheWaterStock: parseInt(p['On the water'], 10) || 0,
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        Source: 'Sursa 1',
        ProductType: 'Jante',
      };

      return normalizeProductAttributes(product);
    });
};

export const source1: DataSource = {
  name: 'Sursa 1',
  url: 'https://docs.google.com/spreadsheets/d/1AFZLyen_l9P5JxBYlTyVCQocZt3X8IAU-Jh785Gseos/export?format=csv&gid=187323146',
  type: 'csv',
  parserConfig: {
    requiredHeaders: ['partnumber', 'brand', 'pret client in lei/buc'],
  },
  map,
};
