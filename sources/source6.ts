
import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

// --- CONFIGURATION ---

// Whitelist of brands to import.
// Key: The clean, official name to save in DB.
// Value: Regex to match variations in the 'BrandName' field from API.
const BRAND_WHITELIST: Record<string, RegExp> = {
    'Dirt AT': /\b(Dirt|Dirt\s*A\.?T\.?)\b/i,          // Matches "Dirt", "Dirt AT", "Dirt A.T."
    'Boost Wheels': /\b(Boost|Boost\s*Wheels)\b/i,     // Matches "Boost", "Boost Wheels"
    'Status Wheels': /\b(Status|Status\s*Wheels)\b/i   // Matches "Status", "Status Wheels"
};

// Interface reflecting the specific JSON structure from Statusfälgar Docs
interface StatusArticle {
    ArticleId: number;
    EAN: number;
    ArticleText: string;
    BrandName: string;
    ModelName: string;
    Color: string;
    ImageId?: number;
    Width: number;
    Diameter: number;
    NumberOfBolts: number;
    BoltCircle: string; // e.g. "5-112" or "112"
    Offset: number;
    CenterBore: number;
    LoadRating: number;
    QuantityAvailable: number;
    Price: number; // Price excluding recycling fee
    RecyclingFee: number;
}

const map = async (data: any): Promise<Product[]> => {
    // The API returns a direct array of objects based on the docs sample.
    // We handle cases where it might be wrapped, just to be safe.
    const rawArticles: StatusArticle[] = Array.isArray(data) ? data : (data?.Articles || []);

    if (!rawArticles.length) return [];

    const processedProducts: Product[] = [];

    for (const item of rawArticles) {
        // 1. Validate ID
        if (!item.ArticleId) continue;

        // 2. BRAND FILTERING
        const rawBrand = (item.BrandName || '').trim();
        let normalizedBrand: string | null = null;

        for (const [officialName, regex] of Object.entries(BRAND_WHITELIST)) {
            if (regex.test(rawBrand)) {
                normalizedBrand = officialName;
                break;
            }
        }

        // Skip if brand is not in our whitelist
        if (!normalizedBrand) continue;

        // 3. Price Calculation
        // Formula: (((((Price * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48
        const basePrice = Number(item.Price) || 0;
        let calculatedPrice = 0;
        
        if (basePrice > 0) {
             calculatedPrice = Math.round((((((basePrice * 4) + 1080) * 1.21) * 1.4) / 4) * 0.48);
        }

        // 4. PCD Construction
        // API gives NumberOfBolts (e.g., 5) and BoltCircle (e.g., "112" or "114.3")
        const holes = item.NumberOfBolts;
        const pcdVal = item.BoltCircle;
        let pcd = '';
        if (holes && pcdVal) {
            // Check if pcdVal already contains the holes (e.g. "5x112")
            if (String(pcdVal).includes('x') || String(pcdVal).includes('-')) {
                 pcd = String(pcdVal).replace('-', 'x'); // Normalize 5-112 to 5x112
            } else {
                 pcd = `${holes}x${pcdVal}`;
            }
        } else {
            pcd = String(pcdVal || '');
        }

        // 5. Image URL
        // Endpoint: GET api/Images/{id}
        const imageUrl = item.ImageId ? `https://api.statusfalgar.se/api/Images/${item.ImageId}` : undefined;

        const product: Product = {
            PartNumber: String(item.ArticleId),
            EAN: String(item.EAN || ''),
            Brand: normalizedBrand,
            Model: item.ModelName,
            PartDescription: item.ArticleText || `${normalizedBrand} ${item.ModelName}`,
            Finish: item.Color,
            Size: String(item.Diameter),
            Width: String(item.Width),
            PCD: pcd,
            Offset: String(item.Offset),
            CB: String(item.CenterBore),
            Load: String(item.LoadRating),
            Stock: Number(item.QuantityAvailable) || 0,
            Price: calculatedPrice,
            ImageUrl: imageUrl,
            ImageUrls: imageUrl ? [imageUrl] : [],
            Source: 'Sursa 6',
            ProductType: 'Jante',
        };

        processedProducts.push(product);
    }

    // Apply global normalization (trimming, formatting numbers)
    return processedProducts.map(p => normalizeProductAttributes(p));
};

export const source6: DataSource = {
  name: 'Sursa 6',
  type: 'json',
  fetcher: async () => fetch('/api/source6', { cache: 'no-store' }),
  map,
};
