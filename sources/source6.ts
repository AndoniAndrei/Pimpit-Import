import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    // Rule: Filter for ProductGroupId 220 exclusively. Use loose comparison for flexibility.
    .filter(p => p && String(p.ProductGroupId || '').trim() == '220')
    .map(p => {
      // Price Calculation: (((((pret achizitie * 4)+1080)*1.21)*1.4)/4)*0.48
      const purchasePriceStr = String(p.Price || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round((((((purchasePrice * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48);

      // PCD combination from 'Number of bolts' and 'BoltCirlce'
      const numberOfBolts = String(p['Number of bolts'] || '').trim();
      const boltCircle = String(p.BoltCirlce || '').trim();
      const pcd = (numberOfBolts && boltCircle) ? `${numberOfBolts}x${boltCircle}` : '';

      const imageUrl = p.ImageURL;

      const product: Product = {
        // Mapped fields according to the new user request
        PartNumber: p.ArticleId,
        PartDescription: p['Article Text'],
        Brand: p['Brand Name'],
        Model: p['Model Name'],
        Finish: p.Color,
        Width: p.Width,
        Size: p.Diameter,
        PCD: pcd,
        Offset: p.offset,
        CB: p.CenterBore,
        Load: p.LoadRating,
        IsWinterApproved: p.IsWinterApproved,
        Stock: parseInt(String(p.QuantityAvailable), 10) || 0,
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
  type: 'json', // The API now returns JSON
  fetcher,
  // parserConfig is no longer needed for JSON type
  map,
};