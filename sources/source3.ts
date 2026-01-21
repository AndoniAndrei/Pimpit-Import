
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && getProp(p, 'part_number'))
    .map(p => {
      // 1. Price Calculation Logic
      const suggestedPriceEur = parseFloat(String(getProp(p, 'suggested_retail_price') || '0').replace(',', '.')) || 0;
      const yourNetPriceEur = parseFloat(String(getProp(p, 'your_net_price') || '0').replace(',', '.')) || 0;

      let finalPriceRon = 0;
      let srpBasedPriceRon = suggestedPriceEur > 0 && suggestedPriceEur <= 100 ? (suggestedPriceEur + 10) * 5 : suggestedPriceEur * 5;
      const minMarginPriceRon = (yourNetPriceEur * 5) * 1.15;
      
      finalPriceRon = srpBasedPriceRon > 0 ? Math.max(srpBasedPriceRon, minMarginPriceRon) : minMarginPriceRon;
      const oldPriceRon = suggestedPriceEur > 0 ? suggestedPriceEur * 5 : 0;
      const displayOldPrice = (oldPriceRon > finalPriceRon) ? oldPriceRon : undefined;

      // 2. Image Aggregation
      const imageUrls = [
          getProp(p, 'photo'), getProp(p, 'photo1'), getProp(p, 'photo2'), 
          getProp(p, 'photo3'), getProp(p, 'photo4'), getProp(p, 'photo5')
      ].filter((url): url is string => url && typeof url === 'string' && url.trim().startsWith('http'));
      
      // 3. Product Type Categorization
      const productType = (getProp(p, 'thickness') || getProp(p, 'thread_size')) ? 'Accesorii' : 'Jante';

      // 4. Extract ET from name field as a fallback
      const name = String(getProp(p, 'name') || '');
      const etMatch = name.match(/\bET(-?\d+(?:-\d+)?)\b/i);
      const extractedOffset = etMatch ? etMatch[1] : undefined;
      
      // 5. Map to unified Product structure
      const product: Product = {
        PartNumber: getProp(p, 'part_number'),
        EAN: getProp(p, 'ean'),
        Brand: getProp(p, 'brand'),
        Model: getProp(p, 'model'),
        PartDescription: name || `${getProp(p, 'brand')} ${getProp(p, 'model')}`.trim(),
        Finish: getProp(p, 'colour'),
        Size: getProp(p, 'size'),
        Width: getProp(p, 'width'),
        PCD: getProp(p, 'pcd'),
        Offset: getProp(p, 'et') || extractedOffset,
        CB: getProp(p, 'center_bore'),
        Stock: Math.floor(parseFloat(String(getProp(p, 'stock') || '0').replace(',', '.'))) || 0,
        Price: Math.round(finalPriceRon),
        OldPrice: displayOldPrice ? Math.round(displayOldPrice) : undefined,
        Source: 'Sursa 3',
        ProductType: productType,
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        ThreeSixtyImageUrl: getProp(p, 'link_3d'),
        YoutubeUrl: getProp(p, 'youtube_link'),
        TuvUrl: getProp(p, 'certificate_download'),
        Description: getProp(p, 'description') || getProp(p, 'decsription'),
        Load: getProp(p, 'max_load'),
        next_delivery: getProp(p, 'next_delivery'),
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/wheeltrade';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) {
            let errorDetails = `Proxy-ul intern a eșuat cu status: ${response.status}.`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.details || errorData.error || errorDetails;
            } catch (e) {}
            throw new Error(errorDetails);
        }
        return response;
    } catch (error) {
        throw new Error(`Nu s-a putut încărca Sursa 3. Motiv: ${error instanceof Error ? error.message : 'Eroare necunoscută.'}`);
    }
};

export const source3: DataSource = {
  name: 'Sursa 3',
  type: 'csv',
  fetcher,
  parserConfig: {
    requiredHeaders: ['part_number', 'brand', 'your_net_price'],
    delimiter: ';',
  },
  map,
};
