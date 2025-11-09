import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p.producer_code)
    .map(p => {
      // Price Calculation: ((((pret de achizitie*4)*1.21)*1.4)*5)/4
      const purchasePriceStr = String(p.price || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round(((((purchasePrice * 4) * 1.21) * 1.4) * 5) / 4);

      const imageUrl = p.photo_url;
      const imageUrls = imageUrl ? [imageUrl] : [];

      const product: Product = {
        PartNumber: p.producer_code,
        EAN: p.ean_code,
        Brand: p.producer,
        PartDescription: p.name,
        Finish: p.finish,
        Size: p.size,
        Width: p.width,
        PCD: p.pcd,
        Offset: p.et,
        CB: p.cb,
        Stock: parseInt(p.stock, 10) || 0,
        Price: calculatedPrice,
        ImageUrl: imageUrl,
        ImageUrls: imageUrls,
        ThreeSixtyImageUrl: p['360_photo_url'],
        TuvUrl: p.tuv_url,
        Weight: p.weight,
        Source: 'Sursa 5',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/abswheels';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) {
            let errorDetails = `Proxy-ul pentru Sursa 5 a eșuat (status: ${response.status}).`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.details || errorData.error || errorDetails;
            } catch (e) { /* ignore if response is not json */ }
            throw new Error(errorDetails);
        }
        return response;
    } catch (error) {
        console.error("Eroare la încărcarea Sursei 5:", error);
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        throw new Error(`Nu s-a putut încărca Sursa 5. Motiv: ${message}`);
    }
};

export const source5: DataSource = {
  name: 'Sursa 5',
  type: 'csv',
  fetcher,
  parserConfig: {
    requiredHeaders: ['ean_code', 'producer_code', 'price', 'stock'],
  },
  map,
};
