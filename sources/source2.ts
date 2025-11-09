
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

// Maps data from the second source, calculates price, and unifies structure
const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p['UID'] && String(p['UID']).trim() !== '')
    .map(p => {
      const priceBaseStr = String(p['PRICE'] || '0').replace(',', '.');
      const priceBase = parseFloat(priceBaseStr) || 0;
      
      // -> (((((M cell value *4)+80)*1.21)*1.43)/4)*6 -> rezultatul este pretul in lei afisat pe platforma, rotunjeste.
      const calculatedPrice = Math.round((((((priceBase * 4) + 80) * 1.21) * 1.43) / 4) * 6);
      
      const brand = p['BRAND'] || '';
      const design = p['DESIGN'] || '';
      const colour = p['COLOUR'] || '';
      const holes = p['HOLES'] || '';
      const pcdVal = p['PCD'] || '';
      const pcd = (holes && pcdVal) ? `${holes}x${pcdVal}` : pcdVal;

      const imageUrl = p['IMG'];

      const product: Product = {
        PartNumber: p['UID'],
        Brand: brand,
        Model: design,
        Finish: colour,
        PartDescription: `${brand} ${design} ${colour}`.trim().replace(/\s+/g, ' '),
        Width: p['WIDTH'],
        Size: p['DIAMETER'],
        Offset: p['ET'],
        PCD: pcd,
        CB: p['CB'],
        Load: p['LOAD'],
        Weight: p['WEIGHT(KG)'],
        ThreeSixtyImageUrl: p['360 IMAGE'],
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Stock: parseInt(p['STOCK'], 10) || 0,
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
    // Using the exact headers from the user's file
    requiredHeaders: ['uid', 'brand', 'price'],
  },
  map,
};
