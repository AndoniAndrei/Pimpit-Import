import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p.producer_code && String(p.producer_code).trim() !== '')
    .map(p => {
      // Price Calculation: ((((pret de achizitie*4)*1.21)*1.4)*5)/4
      const purchasePriceStr = String(p.price || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round(((((purchasePrice * 4) * 1.21) * 1.4) * 5) / 4);

      const imageUrl = p.photo_url;
      const imageUrls = imageUrl ? [imageUrl] : [];

      // Clean quotes from text fields as requested
      const productName = String(p.name || '').replace(/"/g, '').trim();
      const productFinish = String(p.finish || '').replace(/"/g, '').trim();

      const product: Product = {
        PartNumber: p.producer_code,
        Brand: p.producer,
        Model: p.model,
        PartDescription: productName,
        Finish: productFinish,
        Size: p.size,
        Width: p.width,
        PCD: p.pcd,
        Offset: p.et,
        CB: p.cb,
        Stock: parseInt(String(p.stock), 10) || 0,
        Price: calculatedPrice,
        ImageUrl: imageUrl,
        ImageUrls: imageUrls,
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

const columnMapping = [
  'producer_code',  // Column 0: 1000@5x114.3
  'name',           // Column 1: "ABS F22 Dark Tint..."
  'size',           // Column 2: 21
  'width',          // Column 3: 10.5
  'et',             // Column 4: 42
  'cb',             // Column 5: 74.1
  'pcd',            // Column 6: 5x114.3
  'producer',       // Column 7: ABS
  'model',          // Column 8: F22
  'finish',         // Column 9: "DARK TINT"
  'price',          // Column 10: 323
  'stock',          // Column 11: 17
  'photo_url',      // Column 12: https://...
];

export const source5: DataSource = {
  name: 'Sursa 5',
  type: 'csv',
  fetcher,
  parserConfig: {
    columnMapping: columnMapping,
  },
  map,
};
