
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

// Helper to get value case-insensitively
const getVal = (item: any, key: string): string => {
    if (item[key] !== undefined) return String(item[key]);
    const lowerKey = key.toLowerCase();
    const foundKey = Object.keys(item).find(k => k.toLowerCase() === lowerKey);
    return foundKey ? String(item[foundKey]) : '';
};

// Maps data from the second source, calculates price, and unifies structure
const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => {
        const uid = getVal(p, 'UID');
        return uid && uid.trim() !== '';
    })
    .map(p => {
      const priceBaseStr = getVal(p, 'PRICE').replace(',', '.') || '0';
      const priceBase = parseFloat(priceBaseStr) || 0;
      
      // -> (((((M cell value *4)+80)*1.21)*1.43)/4)*6 -> rezultatul este pretul in lei afisat pe platforma, rotunjeste.
      const calculatedPrice = Math.round((((((priceBase * 4) + 80) * 1.21) * 1.43) * 6) / 4);
      
      const brand = getVal(p, 'BRAND');
      const design = getVal(p, 'DESIGN');
      const colour = getVal(p, 'COLOUR');
      const holes = getVal(p, 'HOLES');
      const pcdVal = getVal(p, 'PCD');
      const pcd = (holes && pcdVal) ? `${holes}x${pcdVal}` : pcdVal;

      const imageUrl = getVal(p, 'IMG');

      const product: Product = {
        PartNumber: getVal(p, 'UID'),
        Brand: brand,
        Model: design,
        Finish: colour,
        PartDescription: `${brand} ${design} ${colour}`.trim().replace(/\s+/g, ' '),
        Width: getVal(p, 'WIDTH'),
        Size: getVal(p, 'DIAMETER'),
        Offset: getVal(p, 'ET'),
        PCD: pcd,
        CB: getVal(p, 'CB'),
        Load: getVal(p, 'LOAD'),
        Weight: getVal(p, 'WEIGHT(KG)'),
        ThreeSixtyImageUrl: getVal(p, '360 IMAGE'),
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Stock: parseInt(getVal(p, 'TOTAL STOCK'), 10) || 0,
        Price: calculatedPrice,
        Source: 'Sursa 2',
        ProductType: 'Jante',
      };

      return product;
    });

  // Just normalize product attributes
  return initialProducts.map(product => normalizeProductAttributes(product));
};

export const source2: DataSource = {
  name: 'Sursa 2',
  url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTq1-FVmTlr588SwWJHqpPg9R9dW2M60QjR5bFmP20Wp-q5T0b1gc4krXy0b0ePi8_fkBc39ea8RbPS/pub?output=csv',
  type: 'csv',
  parserConfig: {
    // Relaxed validation: We only strictly require 'uid' to be present to identify the header row.
    // The map function will handle missing 'brand' or 'price' columns gracefully (returning empty/0).
    requiredHeaders: ['uid'],
  },
  map,
};
