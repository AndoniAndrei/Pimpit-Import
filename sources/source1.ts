
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && getProp(p, 'PartNumber') && String(getProp(p, 'PartNumber')).trim() !== '')
    .map(p => {
      const priceStr = String(getProp(p, 'Pret client in lei/buc') || '0');
      let cleanPrice = priceStr.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
      const price = parseFloat(cleanPrice) || 0;

      const imageUrls = [
          getProp(p, 'Image URL'), 
          getProp(p, 'Image URL 1'), 
          getProp(p, 'Image URL 2'), 
          getProp(p, 'Image URL 3'), 
          getProp(p, 'Image URL 4')
      ].filter((url): url is string => url && typeof url === 'string' && url.trim().startsWith('http'));

      const description = String(getProp(p, 'PartDescription') || '');
      const etMatch = description.match(/\bET(-?\d+(?:-\d+)?)\b/i);
      const extractedOffset = etMatch ? etMatch[1] : undefined;

      const product: Product = {
        PartNumber: getProp(p, 'PartNumber'),
        PartDescription: getProp(p, 'PartDescription'),
        Brand: getProp(p, 'Brand'),
        EAN: getProp(p, 'EAN'),
        Model: getProp(p, 'Model'),
        Size: getProp(p, 'Size'),
        Width: getProp(p, 'Width'),
        PCD: getProp(p, 'PCD'),
        CB: getProp(p, 'CB'),
        Finish: getProp(p, 'Finish'),
        Load: getProp(p, 'Load'),
        Weight: getProp(p, 'Weight'),
        Description: getProp(p, 'Description'),
        next_delivery: getProp(p, 'next_delivery'),
        ThreeSixtyImageUrl: getProp(p, 'ThreeSixtyImageUrl'),
        TuvUrl: getProp(p, 'TuvUrl'),
        YoutubeUrl: getProp(p, 'YoutubeUrl'),
        Offset: getProp(p, 'Offset') || extractedOffset,
        Price: price,
        Stock: parseInt(String(getProp(p, '7001')), 10) || 0,
        OnTheWaterStock: parseInt(String(getProp(p, 'On the water')), 10) || 0,
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        Source: 'Sursa 1',
        ProductType: 'Jante',
      };

      return product;
    });

  return initialProducts.map(product => normalizeProductAttributes(product));
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
