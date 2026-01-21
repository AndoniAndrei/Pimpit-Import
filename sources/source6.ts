
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: any): Promise<Product[]> => {
  // Status Falgar API can return an array directly or an object with an 'Articles' property
  const articles = Array.isArray(data) ? data : (data?.Articles || []);

  if (!Array.isArray(articles)) {
      console.warn("Source 6: Data format is not an array of articles.", data);
      return [];
  }

  const initialProducts = articles
    .filter(p => p && (p.ArticleId || p.Id))
    .map(p => {
      // 1. Price Calculation: (((((pret achizitie * 4)+1080)*1.21)*1.4)/4)*0.48
      const rawPrice = p.Price || p.NettPrice || 0;
      const purchasePriceStr = String(rawPrice).replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round((((((purchasePrice * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48);

      // 2. PCD logic (handle various API naming inconsistencies)
      const numberOfBolts = String(p['Number of bolts'] || p.NumberOfBolts || p.Bolts || '').trim();
      // They often have a typo 'BoltCirlce' in their documentation/API
      const boltCircleRaw = p.BoltCirlce || p.BoltCircle || p.BoltPattern || '';
      const boltCircle = String(boltCircleRaw).trim();
      const pcd = (numberOfBolts && boltCircle) ? `${numberOfBolts}x${boltCircle}` : boltCircle;

      // 3. Brand and Model mapping (resilient to space vs camelCase)
      const brand = p['Brand Name'] || p.BrandName || p.Brand || 'Unknown Brand';
      const model = p['Model Name'] || p.ModelName || p.Model || '';
      const articleText = p['Article Text'] || p.ArticleText || p.Description || '';

      // 4. Image URL logic
      const imageId = p.ImageId || p.MainImageId;
      const imageUrl = imageId ? `https://api.statusfalgar.se/api/Images/${imageId}` : undefined;

      // 5. Stock logic
      const stock = parseInt(String(p.QuantityAvailable || p.Stock || 0), 10) || 0;

      const product: Product = {
        PartNumber: p.ArticleId || p.Id,
        PartDescription: articleText || `${brand} ${model}`.trim(),
        Brand: brand,
        Model: model,
        Finish: p.Color || p.Finish,
        Width: p.Width,
        Size: p.Diameter || p.Size,
        PCD: pcd,
        Offset: p.offset || p.ET,
        CB: p.CenterBore || p.CH,
        Load: p.LoadRating || p.MaxLoad,
        IsWinterApproved: p.IsWinterApproved === true || String(p.IsWinterApproved).toLowerCase() === 'yes',
        Stock: stock,
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

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/source6';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) {
            let errorDetails = `Proxy-ul pentru Sursa 6 a eșuat (status: ${response.status}).`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.details || errorData.error || errorDetails;
            } catch (e) { /* ignore if response is not json */ }
            throw new Error(errorDetails);
        }
        return response;
    } catch (error) {
        console.error("Eroare la încărcarea Sursei 6:", error);
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        throw new Error(`Nu s-a putut încărca Sursa 6. Motiv: ${message}`);
    }
};

export const source6: DataSource = {
  name: 'Sursa 6',
  type: 'json',
  fetcher,
  map,
};
