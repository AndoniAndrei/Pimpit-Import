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
      const description = String(p.Description || '').trim();

      // If Brand or Model is missing, try to extract them from the Description.
      // This rule only applies to rows with incomplete data.
      if ((!brand || !model) && description) {
          const descriptionParts = description.split(/\s+/);
          if (descriptionParts.length >= 2) {
              // Only fill in the missing piece of information.
              if (!brand) {
                  brand = descriptionParts[0];
              }
              if (!model) {
                  model = descriptionParts[1];
              }
          }
      }

      const product: Product = {
        PartNumber: p.Articlecode,
        Brand: brand,
        Model: model,
        PartDescription: p.Description,
        Finish: p.Color, // Direct mapping from the 'Color' column
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
    // Rely on headers to map columns. These are essential for mapping.
    // We assume the file is now consistent and these headers are present.
    requiredHeaders: ['articlecode', 'brand', 'model', 'color', 'nett-price', 'stock'],
    delimiter: ';',
    encoding: 'windows-1252',
  },
  map,
};