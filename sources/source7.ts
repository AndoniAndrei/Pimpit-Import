
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p['Item Code'] && String(p['Item Code']).trim() !== '')
    .map(p => {
      // 1. Price Calculation
      const rrpStr = String(p['RRP'] || '0').replace(',', '.');
      const rrp = parseFloat(rrpStr) || 0;
      // Formula: (((((rrp-(0.2*rrp)*4)+100)*1.21)*1.4)*5.78)/4
      const calculatedPrice = Math.round((((((rrp - (0.2 * rrp)) * 4) + 100) * 1.21) * 1.4) * 5.78 / 4);

      // Calculate Old Price (RRP in RON) - using 5.78 from formula
      const oldPriceRon = rrp * 5.78;
      const displayOldPrice = (oldPriceRon > calculatedPrice) ? oldPriceRon : undefined;

      // 2. Size splitting (e.g., "19x8.5")
      const sizeStr = String(p['Size'] || '').trim();
      const sizeParts = sizeStr.toLowerCase().split('x');
      const diameter = sizeParts[0] || undefined;
      const width = sizeParts[1] || undefined;

      // 3. Stock calculation - use 'Available Stock' as it's more reliable
      const stock = parseInt(String(p['Available Stock'] || '0'), 10) || 0;

      // 4. Image URL
      const imageUrl = p['Image'];
      
      const product: Product = {
        PartNumber: p['Item Code'],
        Brand: p['Brand'],
        Model: p['Wheel Model Name'],
        PartDescription: p['Product Name'],
        Description: p['Description'],
        Finish: p['Colour/Finish'],
        Size: diameter,
        Width: width,
        PCD: p['PCD'],
        Offset: p['Offest'], // Note: 'Offest' is a typo in the source file
        CB: p['Centre Bore'],
        Load: p['Load Rating'],
        Stock: stock,
        Price: calculatedPrice,
        OldPrice: displayOldPrice ? Math.round(displayOldPrice) : undefined,
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
    // These headers are now an exact match to what was found in the error log.
    requiredHeaders: [
        'Brand',
        'Item Code',
        'Product Name',
        'RRP',
        'Size',
        'PCD',
        'Available Stock',
    ],
    delimiter: ',',
    encoding: 'windows-1252',
  },
  map,
};