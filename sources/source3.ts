
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
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

      // Calculate Old Price (RRP in RON) - assuming exchange rate of 5 used elsewhere
      const oldPriceRon = suggestedPriceEur > 0 ? suggestedPriceEur * 5 : 0;
      // Only set OldPrice if the calculated sell price is actually lower than the RRP
      const displayOldPrice = (oldPriceRon > finalPriceRon) ? oldPriceRon : undefined;


      // 2. Image Aggregation
      const imageUrls = [p.photo, p.photo1, p.photo2, p.photo3, p.photo4, p.photo5]
        .filter((url): url is string => url && typeof url === 'string' && url.trim().startsWith('http'));
      
      // 3. Product Type Categorization
      const productType = (p.thickness || p.thread_size) ? 'Accesorii' : 'Jante';

      // 4. Extract ET from name field as a fallback
      const name = String(p.name || '');
      const etMatch = name.match(/\bET(-?\d+(?:-\d+)?)\b/i);
      const extractedOffset = etMatch ? etMatch[1] : undefined;
      
      // 5. Map to unified Product structure
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
        Offset: p.et || extractedOffset,
        CB: p.center_bore,
        Stock: Math.floor(parseFloat(String(p.stock || '0').replace(',', '.'))) || 0,
        Price: Math.round(finalPriceRon),
        OldPrice: displayOldPrice ? Math.round(displayOldPrice) : undefined,
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
      
      return product;
    });

    // Just normalize product attributes
    return initialProducts.map(product => normalizeProductAttributes(product));
};

/**
 * Fetches data from the Wheeltrade API via a secure, server-side proxy.
 * This function calls a local API endpoint which handles the API key securely.
 */
const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/wheeltrade';

    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        
        if (!response.ok) {
            let errorDetails = `Proxy-ul intern a eșuat cu status: ${response.status}.`;
            try {
                // The proxy now reliably returns a JSON object on error.
                const errorData = await response.json();
                if (errorData.details) {
                    errorDetails = `Mesaj de la furnizor: "${errorData.details}"`;
                } else if (errorData.error) {
                    errorDetails = errorData.error;
                }
            } catch (e) {
                // Fallback if the response isn't JSON for some unexpected reason
                errorDetails = `Proxy-ul a returnat o eroare neașteptată (status ${response.status}).`;
            }
            // Add a helpful tip for the user
            errorDetails += " Vă rugăm să verificați dacă cheia API a fost copiată corect în secretele platformei.";
            throw new Error(errorDetails);
        }

        return response;

    } catch (error) {
        console.error("Eroare la încărcarea Sursei 3 prin proxy:", error);
        const message = error instanceof Error ? error.message : 'Eroare necunoscută.';
        throw new Error(`Nu s-a putut încărca Sursa 3. Motiv: ${message}`);
    }
};


export const source3: DataSource = {
  name: 'Sursa 3',
  type: 'csv', // The API is returning CSV, not XML.
  fetcher, // Use the secure server-side fetcher
  parserConfig: {
    // Define the headers required for the CSV parser to identify the data correctly.
    requiredHeaders: ['part_number', 'brand', 'your_net_price'],
    delimiter: ';',
  },
  map,
};
