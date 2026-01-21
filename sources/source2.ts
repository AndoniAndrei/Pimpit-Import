
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && (getProp(p, 'UID') || getProp(p, 'ID') || getProp(p, 'BRAND')))
    .map(p => {
      const priceBaseStr = String(getProp(p, 'PRICE') || getProp(p, 'PRET') || getProp(p, 'NET') || '0').replace(',', '.');
      const priceBase = parseFloat(priceBaseStr) || 0;
      
      // Formula: (((((M cell value *4)+80)*1.21)*1.43)/4)*6
      const calculatedPrice = priceBase > 0 
        ? Math.round((((((priceBase * 4) + 80) * 1.21) * 1.43) / 4) * 6)
        : 0;
      
      const brand = String(getProp(p, 'BRAND') || getProp(p, 'PRODUCATOR') || 'Unknown').trim();
      const design = String(getProp(p, 'DESIGN') || getProp(p, 'MODEL') || '').trim();
      const colour = String(getProp(p, 'COLOUR') || getProp(p, 'CULOARE') || '').trim();
      const holes = String(getProp(p, 'HOLES') || '').trim();
      const pcdVal = String(getProp(p, 'PCD') || '').trim();
      const pcd = (holes && pcdVal) ? `${holes}x${pcdVal}` : pcdVal;

      const imageUrl = getProp(p, 'IMG') || getProp(p, 'IMAGE') || getProp(p, 'URL');

      const product: Product = {
        PartNumber: String(getProp(p, 'UID') || getProp(p, 'ID') || Math.random().toString(36).substr(2, 9)),
        Brand: brand,
        Model: design,
        Finish: colour,
        PartDescription: `${brand} ${design} ${colour}`.trim().replace(/\s+/g, ' '),
        Width: getProp(p, 'WIDTH'),
        Size: getProp(p, 'DIAMETER') || getProp(p, 'INCH') || getProp(p, 'SIZE'),
        Offset: getProp(p, 'ET') || getProp(p, 'OFFSET'),
        PCD: pcd,
        CB: getProp(p, 'CB') || getProp(p, 'HUB'),
        Load: getProp(p, 'LOAD'),
        Weight: getProp(p, 'WEIGHT'),
        ThreeSixtyImageUrl: getProp(p, '360 IMAGE'),
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Stock: parseInt(String(getProp(p, 'STOCK') || '0'), 10) || 0,
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
  map,
};
