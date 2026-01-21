
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

// Maps data from the second source, calculates price, and unifies structure
const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && getProp(p, 'UID') && String(getProp(p, 'UID')).trim() !== '')
    .map(p => {
      const priceBaseStr = String(getProp(p, 'PRICE') || '0').replace(',', '.');
      const priceBase = parseFloat(priceBaseStr) || 0;
      
      // -> (((((M cell value *4)+80)*1.21)*1.43)/4)*6 -> rezultatul este pretul in lei afisat pe platforma, rotunjeste.
      const calculatedPrice = Math.round((((((priceBase * 4) + 80) * 1.21) * 1.43) / 4) * 6);
      
      const brand = String(getProp(p, 'BRAND') || '').trim();
      const design = String(getProp(p, 'DESIGN') || '').trim();
      const colour = String(getProp(p, 'COLOUR') || '').trim();
      const holes = String(getProp(p, 'HOLES') || '').trim();
      const pcdVal = String(getProp(p, 'PCD') || '').trim();
      const pcd = (holes && pcdVal) ? `${holes}x${pcdVal}` : pcdVal;

      const imageUrl = getProp(p, 'IMG');

      const product: Product = {
        PartNumber: getProp(p, 'UID'),
        Brand: brand,
        Model: design,
        Finish: colour,
        PartDescription: `${brand} ${design} ${colour}`.trim().replace(/\s+/g, ' '),
        Width: getProp(p, 'WIDTH'),
        Size: getProp(p, 'DIAMETER'),
        Offset: getProp(p, 'ET'),
        PCD: pcd,
        CB: getProp(p, 'CB'),
        Load: getProp(p, 'LOAD'),
        Weight: getProp(p, 'WEIGHT(KG)'),
        ThreeSixtyImageUrl: getProp(p, '360 IMAGE'),
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Stock: parseInt(String(getProp(p, 'STOCK')), 10) || 0,
        Price: calculatedPrice,
        Source: 'Sursa 2',
        ProductType: 'Jante',
      };

      return product;
    });

  return initialProducts.map(product => normalizeProductAttributes(product));
};

export const source2: DataSource = {
  name: 'Sursa 2',
  url: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTq1-FVmTlr588SwWJHqpPg9R9dW2M60QjR5bFmP20Wp-q5T0b1gc4krXy0b0ePi8_fkBc39ea8RbPS/pub?output=csv',
  type: 'csv',
  parserConfig: {
    requiredHeaders: ['uid', 'brand', 'price'],
  },
  map,
};
