import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = (data: Product[]): Product[] => {
  return data
    .filter(p => p && p.part_number)
    .map(p => {
      // 1. Price Calculation Logic
      const suggestedPriceEur = parseFloat(String(p.suggested_retail_price || '0').replace(',', '.')) || 0;
      const yourNetPriceEur = parseFloat(String(p.your_net_price || '0').replace(',', '.')) || 0;

      let finalPriceRon = 0;

      // Price based on suggested retail price, converted to RON, with bonus for low prices
      let srpBasedPriceRon = 0;
      if (suggestedPriceEur > 0 && suggestedPriceEur <= 100) {
          srpBasedPriceRon = (suggestedPriceEur + 10) * 5;
      } else {
          srpBasedPriceRon = suggestedPriceEur * 5;
      }

      // Price based on minimum 15% margin over net price (net price converted to RON plus 15%)
      const minMarginPriceRon = (yourNetPriceEur * 5) * 1.15;
      
      // The final price is the higher of the two, ensuring profitability, but only if SRP is available. Otherwise use margin price.
      if (srpBasedPriceRon > 0) {
        finalPriceRon = Math.max(srpBasedPriceRon, minMarginPriceRon);
      } else {
        finalPriceRon = minMarginPriceRon;
      }

      // 2. Image Aggregation
      const imageUrls = [p.photo, p.photo1, p.photo2, p.photo3, p.photo4, p.photo5]
        .filter((url): url is string => url && typeof url === 'string' && url.trim().startsWith('http'));
      
      // 3. Product Type Categorization
      const productType = (p.thickness || p.thread_size) ? 'Accesorii' : 'Jante';

      // 4. Map to unified Product structure
      const product: Product = {
        PartNumber: p.part_number,
        EAN: p.ean,
        Brand: p.brand,
        Model: p.model,
        PartDescription: p.name || `${p.brand} ${p.model}`.trim(),
        Finish: p.colour,
        Size: p.size,
        Width: p.width,
        PCD: p.pcd,
        CB: p.center_bore,
        Stock: Math.floor(parseFloat(String(p.stock || '0').replace(',', '.'))) || 0,
        Price: Math.round(finalPriceRon),
        Source: 'Sursa 3',
        ProductType: productType,
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        ThreeSixtyImageUrl: p.link_3d,
        YoutubeUrl: p.youtube_link,
        TuvUrl: p.certificate_download,
        Description: p.description || p.decsription,
        Load: p.max_load,
        next_delivery: p.next_delivery,
        //... any other fields from the XML can be added here
      };
      
      return normalizeProductAttributes(product);
    });
};

/**
 * Fetches data from the Wheeltrade API using a secure and reliable method.
 * It reads the API key from environment variables and uses a single, trusted
 * CORS proxy to bypass browser security restrictions.
 */
const fetcher = async (): Promise<Response> => {
    // 1. Get the API Key securely from environment variables.
    const apiKey = process.env.WHEELTRADE_API_KEY;

    // 2. If the key is not configured, fail immediately with a clear error.
    if (!apiKey) {
        throw new Error('Cheia API pentru Sursa 3 (Wheeltrade) nu este configurată. Vă rugăm să setați variabila de mediu WHEELTRADE_API_KEY.');
    }

    // 3. Construct the correct, authorized URL using the API key.
    const targetUrl = `https://b2b.wheeltrade.pl/en/xmlapi/7/2/utf8_withoutbom/${apiKey}?stream=true`;
    
    // 4. Use a single, reliable CORS proxy to bypass browser security restrictions.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        
        if (!response.ok) {
            throw new Error(`Serviciul intermediar a eșuat cu status: ${response.status}`);
        }

        // 5. Quick verification to ensure we received a valid XML file.
        const text = await response.clone().text();
        if (!text.trim().startsWith('<')) {
            throw new Error('Răspunsul primit de la sursă nu este un fișier XML valid.');
        }

        return response;

    } catch (error) {
        console.error("Eroare la încărcarea Sursei 3:", error);
        // Re-throw a more user-friendly error to be displayed in the UI.
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        throw new Error(`Nu s-a putut încărca Sursa 3. Motiv: ${message}`);
    }
};

export const source3: DataSource = {
  name: 'Sursa 3',
  type: 'xml',
  fetcher, // Use the new secure and reliable fetcher
  parserConfig: {
    // Not needed for XML, but required by the interface for consistency
    requiredHeaders: [], 
  },
  map,
};
