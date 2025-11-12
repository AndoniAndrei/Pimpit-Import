import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p.Articlecode && String(p.Articlecode).trim() !== '')
    .filter(p => {
        // Rule: Exclude "dirt" products from this source ONLY.
        const combinedSearchString = `${p.Brand || ''} ${p.Model || ''} ${p.Description || ''}`.toLowerCase();
        return !combinedSearchString.includes('dirt');
    })
    .map(p => {
      // Price Calculation: ((((pret de achizitie*4)*1.21)*1.4)*5)/4
      const purchasePriceStr = String(p['Nett-price'] || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round(((((purchasePrice * 4) * 1.21) * 1.4) * 5) / 4);

      const imageUrl = p['URL-to-photo'];
      const imageUrls = imageUrl ? [imageUrl] : [];
      
      let brand = String(p.Brand || '').trim();
      let model = String(p.Model || '').trim();
      const description = String(p.Description || '').trim();

      // --- Data Cleaning and Correction Logic ---
      const combinedSearchString = `${brand} ${model} ${description}`.toLowerCase();
      
      // Rule 1: Correct 'STW' products
      if (combinedSearchString.includes('stw')) {
        brand = 'ABS';
        model = 'STW 287';
      }
      // Rule 2: Correct products mistakenly branded as '355'
      else if (brand === '355') {
        brand = 'ABS';
        model = '355';
      }
      // Rule 3: Correct products mistakenly branded as 'AERO'
      else if (brand.toLowerCase() === 'aero') {
        brand = 'ABS';
        model = 'AERO';
      }
      // Rule 4: Correct the specific 'ABS F55' error, making them 'F88'
      else if (brand === 'ABS F55') {
        brand = 'ABS';
        model = 'F88';
      }
      // Rule 5 (Fallback): If data is still missing, try to extract from description
      else if ((!brand || !model) && description) {
          const descriptionParts = description.split(/\s+/);
          if (descriptionParts.length >= 2) {
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