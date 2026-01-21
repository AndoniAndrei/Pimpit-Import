
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && getProp(p, 'Item Code'))
    .map(p => {
      const rrp = parseFloat(String(getProp(p, 'RRP') || '0').replace(',', '.')) || 0;
      const calculatedPrice = Math.round((((((rrp - (0.2 * rrp)) * 4) + 100) * 1.21) * 1.4) * 5.78 / 4);
      const oldPriceRon = rrp * 5.78;

      const sizeStr = String(getProp(p, 'Size') || '').trim();
      const sizeParts = sizeStr.toLowerCase().split('x');
      const imageUrl = getProp(p, 'Image');
      
      const product: Product = {
        PartNumber: getProp(p, 'Item Code'),
        Brand: getProp(p, 'Brand'),
        Model: getProp(p, 'Wheel Model Name'),
        PartDescription: getProp(p, 'Product Name'),
        Description: getProp(p, 'Description'),
        Finish: getProp(p, 'Colour/Finish'),
        Size: sizeParts[0],
        Width: sizeParts[1],
        PCD: getProp(p, 'PCD'),
        Offset: getProp(p, 'Offest'), 
        CB: getProp(p, 'Centre Bore'),
        Load: getProp(p, 'Load Rating'),
        Stock: parseInt(String(getProp(p, 'Available Stock') || '0'), 10) || 0,
        Price: calculatedPrice,
        OldPrice: Math.round(oldPriceRon),
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Source: 'Sursa 7',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

export const source7: DataSource = {
  name: 'Sursa 7',
  type: 'csv',
  fetcher: async () => fetch('/api/source7', { cache: 'no-store' }),
  parserConfig: {
    requiredHeaders: ['Brand', 'Item Code', 'RRP', 'Available Stock'],
    delimiter: ',',
    encoding: 'windows-1252',
  },
  map,
};
