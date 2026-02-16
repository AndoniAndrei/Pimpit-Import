
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

// Configurare: Lista de branduri permise și variațiile lor (Regex).
// Cheia: Numele standardizat care va fi salvat în baza de date.
// Valoarea: Expresia regulată (Regex) care verifică dacă brandul din API se potrivește.
const ALLOWED_BRANDS: Record<string, RegExp> = {
  'Dirt AT': /\b(Dirt|Dirt\s*A\.?T\.?)\b/i,      // Prinde: "Dirt", "Dirt AT", "Dirt A.T."
  'Boost Wheels': /\b(Boost|Boost\s*Wheels)\b/i, // Prinde: "Boost", "Boost Wheels"
  'Status Wheels': /\b(Status|Status\s*Wheels)\b/i // Prinde: "Status", "Status Wheels"
};

const map = async (data: any): Promise<Product[]> => {
  const articles = Array.isArray(data) ? data : (data?.Articles || []);
  if (!Array.isArray(articles)) return [];

  const initialProducts = articles
    .map(p => {
      // 1. Verificare ID Valid
      const id = getProp(p, 'ArticleId') || getProp(p, 'Id');
      if (!id) return null;

      // 2. Identificare și Filtrare Brand
      const rawBrand = String(getProp(p, 'Brand Name') || getProp(p, 'BrandName') || '').trim();
      
      let matchedBrandName: string | null = null;
      
      // Iterăm prin configurație pentru a găsi o potrivire
      for (const [officialName, regex] of Object.entries(ALLOWED_BRANDS)) {
        if (regex.test(rawBrand)) {
          matchedBrandName = officialName;
          break;
        }
      }

      // Dacă brandul nu este în lista permisă, ignorăm produsul (return null)
      if (!matchedBrandName) {
        return null;
      }

      // 3. Calcul Preț
      const rawPrice = getProp(p, 'NettPrice') || getProp(p, 'Price') || 0;
      const purchasePrice = parseFloat(String(rawPrice).replace(',', '.')) || 0;
      
      // Formula: (((((M cell value *4)+1080)*1.21)*1.4)/4)*0.48
      const calculatedPrice = purchasePrice > 0 
        ? Math.round((((((purchasePrice * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48)
        : 0;

      // 4. Procesare Date Tehnice
      const numberOfBolts = String(getProp(p, 'Number of bolts') || getProp(p, 'NumberOfBolts') || '').trim();
      const boltCircle = String(getProp(p, 'BoltCirlce') || getProp(p, 'BoltCircle') || '').trim();
      const pcd = (numberOfBolts && boltCircle) ? `${numberOfBolts}x${boltCircle}` : boltCircle;

      const model = getProp(p, 'Model Name') || getProp(p, 'ModelName') || '';
      const imageId = getProp(p, 'ImageId') || getProp(p, 'MainImageId');
      const imageUrl = imageId ? `https://api.statusfalgar.se/api/Images/${imageId}` : undefined;

      const product: Product = {
        PartNumber: id,
        PartDescription: getProp(p, 'Article Text') || `${matchedBrandName} ${model}`.trim(),
        Brand: matchedBrandName, // Folosim numele standardizat (ex: Boost Wheels)
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
    })
    .filter((p): p is Product => p !== null); // Eliminăm produsele care au returnat null (cele filtrate)

    return initialProducts.map(product => normalizeProductAttributes(product));
};

export const source6: DataSource = {
  name: 'Sursa 6',
  type: 'json',
  fetcher: async () => fetch('/api/source6', { cache: 'no-store' }),
  map,
};
