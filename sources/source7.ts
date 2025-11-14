
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p['SKU'] && String(p['SKU']).trim() !== '')
    .map(p => {
      // 1. Price Calculation
      const rrpStr = String(p['RRP'] || '0').replace(',', '.');
      const rrp = parseFloat(rrpStr) || 0;
      // Formula: (((((rrp-(0.2*rrp)*4)+100)*1.21)*1.4)*5.78)/4
      const calculatedPrice = Math.round((((((rrp - (0.2 * rrp)) * 4) + 100) * 1.21) * 1.4) * 5.78 / 4);

      // 2. Size splitting
      const sizeStr = String(p['Size'] || '').trim();
      const sizeParts = sizeStr.toLowerCase().split('x');
      const diameter = sizeParts[0] || undefined;
      const width = sizeParts[1] || undefined;

      // 3. Stock calculation - simplified to use a single quantity field
      const stock = parseInt(String(p['StockQuantity'] || '0'), 10) || 0;

      // 4. Image URL
      const imageUrl = p['Image'];
      
      const product: Product = {
        PartNumber: p['SKU'],
        Brand: p['Brand'],
        Model: p['Model'],
        PartDescription: p['Name'],
        Finish: p['Color'],
        Size: diameter,
        Width: width,
        PCD: p['PCD'],
        Offset: p['Offset'],
        CB: p['CenterBore'],
        Load: p['LoadRating'],
        Stock: stock,
        Price: calculatedPrice,
        ImageUrl: imageUrl,
        ImageUrls: imageUrl ? [imageUrl] : [],
        Source: 'Sursa 7',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/source7';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) {
            let errorDetails = `Proxy-ul pentru Sursa 7 a eșuat (status: ${response.status}).`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.details || errorData.error || errorDetails;
            } catch (e) { /* ignore if response is not json */ }
            throw new Error(errorDetails);
        }
        return response;
    } catch (error) {
        console.error("Eroare la încărcarea Sursei 7:", error);
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        throw new Error(`Nu s-a putut încărca Sursa 7. Motiv: ${message}`);
    }
};

export const source7: DataSource = {
  name: 'Sursa 7',
  type: 'csv',
  fetcher,
  parserConfig: {
    // Updated headers to match the new, more standardized format from the supplier.
    requiredHeaders: [
        'Brand',
        'SKU',
        'Name',
        'RRP',
        'Size',
        'Color',
        'PCD',
        'Offset',
        'CenterBore',
        'StockQuantity',
        'LoadRating',
        'Model'
    ],
    delimiter: ',',
    encoding: 'windows-1252',
  },
  map,
};
