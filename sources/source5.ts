import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p.Articlecode && String(p.Articlecode).trim() !== '')
    .map(p => {
      // Price Calculation: ((((pret de achizitie*4)*1.21)*1.4)*5)/4
      const purchasePriceStr = String(p['Nett-price'] || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round(((((purchasePrice * 4) * 1.21) * 1.4) * 5) / 4);

      const imageUrl = p['URL-to-photo'];
      const imageUrls = imageUrl ? [imageUrl] : [];
      
      let brand = p.Brand;
      let model = p.Model;

      // Data correction: If the brand field contains the model (e.g., "ABS F55") and the model field is empty,
      // split them into the correct fields. This handles inconsistencies like ";;" in the source CSV.
      if (typeof brand === 'string' && brand.toUpperCase().startsWith('ABS ') && !model) {
        const brandParts = brand.split(' ');
        if (brandParts.length > 1) {
            model = brandParts.slice(1).join(' ').trim();
            brand = 'ABS';
        }
      }

      const product: Product = {
        PartNumber: p.Articlecode,
        Brand: brand, // Use corrected brand
        Model: model, // Use corrected model
        PartDescription: p.Description,
        Finish: p.Color,
        Size: p.Inch,
        Width: p.Width,
        PCD: p.PCD,
        Offset: p.Offset,
        CB: p.Centerhole,
        Stock: parseInt(String(p.Stock), 10) || 0,
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

export const source5: DataSource = {
  name: 'Sursa 5',
  type: 'csv',
  fetcher,
  parserConfig: {
    // Switched to header-based mapping with the correct headers provided by the user.
    // Adding brand and model to ensure the data correction logic works reliably.
    requiredHeaders: ['articlecode', 'brand', 'model', 'nett-price', 'stock'],
  },
  map,
};