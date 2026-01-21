
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any): Promise<Product[]> => {
  const articles = Array.isArray(data) ? data : (data?.Articles || []);
  if (!Array.isArray(articles)) return [];

  const initialProducts = articles
    .filter(p => p && (getProp(p, 'ArticleId') || getProp(p, 'Id')))
    .map(p => {
      const rawPrice = getProp(p, 'Price') || getProp(p, 'NettPrice') || 0;
      const purchasePrice = parseFloat(String(rawPrice).replace(',', '.')) || 0;
      const calculatedPrice = Math.round((((((purchasePrice * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48);

      const numberOfBolts = String(getProp(p, 'Number of bolts') || getProp(p, 'NumberOfBolts') || '').trim();
      const boltCircle = String(getProp(p, 'BoltCirlce') || getProp(p, 'BoltCircle') || '').trim();
      const pcd = (numberOfBolts && boltCircle) ? `${numberOfBolts}x${boltCircle}` : boltCircle;

      const brand = getProp(p, 'Brand Name') || getProp(p, 'BrandName') || 'Unknown Brand';
      const model = getProp(p, 'Model Name') || getProp(p, 'ModelName') || '';
      const imageId = getProp(p, 'ImageId') || getProp(p, 'MainImageId');
      const imageUrl = imageId ? `https://api.statusfalgar.se/api/Images/${imageId}` : undefined;

      const product: Product = {
        PartNumber: getProp(p, 'ArticleId') || getProp(p, 'Id'),
        PartDescription: getProp(p, 'Article Text') || `${brand} ${model}`.trim(),
        Brand: brand,
        Model: model,
        Finish: getProp(p, 'Color') || getProp(p, 'Finish'),
        Width: getProp(p, 'Width'),
        Size: getProp(p, 'Diameter') || getProp(p, 'Size'),
        PCD: pcd,
        Offset: getProp(p, 'offset') || getProp(p, 'ET'),
        CB: getProp(p, 'CenterBore') || getProp(p, 'CH'),
        Load: getProp(p, 'LoadRating') || getProp(p, 'MaxLoad'),
        Stock: parseInt(String(getProp(p, 'QuantityAvailable') || getProp(p, 'Stock') || 0), 10) || 0,
        Price: calculatedPrice,
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Source: 'Sursa 6',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

export const source6: DataSource = {
  name: 'Sursa 6',
  type: 'json',
  fetcher: async () => fetch('/api/source6', { cache: 'no-store' }),
  map,
};
