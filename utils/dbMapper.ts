
import { Product } from '../types';

// Converts an App Product (PascalCase) to a Database Row (snake_case)
export const mapProductToDb = (p: Product) => {
  // CRITICAL FIX: Force PartNumber to be a string and trim it.
  // This prevents duplicates where one source sends 123 (number) and another "123" (string).
  const cleanPartNumber = String(p.PartNumber || '').trim();

  return {
    part_number: cleanPartNumber, // Primary Key
    brand: p.Brand,
    model: p.Model,
    part_description: p.PartDescription,
    price: p.Price,
    old_price: p.OldPrice,
    stock: p.Stock,
    image_url: p.ImageUrl,
    
    // Indexed filters
    size: p.Size ? String(p.Size) : null,
    width: p.Width ? String(p.Width) : null,
    pcd: p.PCD ? String(p.PCD) : null,
    offset: p.Offset ? String(p.Offset) : null,
    finish: p.Finish,
    product_type: p.ProductType,
    
    // Everything else goes into metadata
    metadata: {
        ean: p.EAN,
        cb: p.CB,
        load: p.Load,
        weight: p.Weight,
        description: p.Description,
        image_urls: p.ImageUrls,
        source: p.Source,
        is_winter_approved: p.IsWinterApproved,
        on_the_water_stock: p.OnTheWaterStock,
        youtube_url: p.YoutubeUrl,
        three_sixty_url: p.ThreeSixtyImageUrl,
        tuv_url: p.TuvUrl,
        next_delivery: p.next_delivery
    }
  };
};

// Converts a Database Row (snake_case) back to App Product (PascalCase)
export const mapDbToProduct = (row: any): Product => {
  const metadata = row.metadata || {};
  
  return {
    PartNumber: row.part_number,
    Brand: row.brand,
    Model: row.model,
    PartDescription: row.part_description,
    Price: row.price,
    OldPrice: row.old_price,
    Stock: row.stock,
    ImageUrl: row.image_url,
    
    Size: row.size,
    Width: row.width,
    PCD: row.pcd,
    Offset: row.offset,
    Finish: row.finish,
    ProductType: row.product_type,
    
    // Spread metadata back to top level
    EAN: metadata.ean,
    CB: metadata.cb,
    Load: metadata.load,
    Weight: metadata.weight,
    Description: metadata.description,
    ImageUrls: metadata.image_urls || (row.image_url ? [row.image_url] : []),
    Source: metadata.source || 'Database',
    IsWinterApproved: metadata.is_winter_approved,
    OnTheWaterStock: metadata.on_the_water_stock,
    YoutubeUrl: metadata.youtube_url,
    ThreeSixtyImageUrl: metadata.three_sixty_url,
    TuvUrl: metadata.tuv_url,
    next_delivery: metadata.next_delivery
  };
};
