
import { Product } from '../types';

export const mapProductToDb = (p: Product) => {
  const safePrice = Number.isFinite(p.Price) ? p.Price : 0;
  const safeOldPrice = Number.isFinite(p.OldPrice) ? p.OldPrice : null;
  const safeStock = Number.isFinite(p.Stock) ? p.Stock : 0;

  return {
    part_number: String(p.PartNumber || '').trim(),
    brand: String(p.Brand || 'Unknown').trim(),
    model: String(p.Model || '').trim(),
    part_description: String(p.PartDescription || '').trim(),
    price: safePrice,
    old_price: safeOldPrice,
    stock: safeStock,
    image_url: p.ImageUrl || null,
    source_file: p.Source || 'Unknown', 
    
    size: p.Size ? String(p.Size) : null,
    width: p.Width ? String(p.Width) : null,
    pcd: p.PCD ? String(p.PCD) : null,
    et_offset: p.Offset ? String(p.Offset) : null, // Fixed: et_offset instead of offset
    finish: p.Finish || null,
    product_type: p.ProductType || 'Jante',
    
    metadata: {
        ean: p.EAN,
        cb: p.CB,
        load: p.Load,
        weight: p.Weight,
        description: p.Description,
        image_urls: p.ImageUrls || [],
        is_winter_approved: p.IsWinterApproved,
        on_the_water_stock: p.OnTheWaterStock,
        youtube_url: p.YoutubeUrl,
        three_sixty_url: p.ThreeSixtyImageUrl,
        tuv_url: p.TuvUrl,
        next_delivery: p.next_delivery
    }
  };
};

export const mapDbToProduct = (row: any): Product => {
  const metadata = row.metadata || {};
  
  return {
    id: row.id,
    PartNumber: row.part_number,
    Brand: row.brand,
    Model: row.model,
    PartDescription: row.part_description,
    Price: row.price,
    OldPrice: row.old_price,
    Stock: row.stock,
    ImageUrl: row.image_url,
    Source: row.source_file,
    
    Size: row.size,
    Width: row.width,
    PCD: row.pcd,
    Offset: row.et_offset, // Map back from et_offset
    Finish: row.finish,
    ProductType: row.product_type,
    
    EAN: metadata.ean,
    CB: metadata.cb,
    Load: metadata.load,
    Weight: metadata.weight,
    Description: metadata.description,
    ImageUrls: metadata.image_urls || (row.image_url ? [row.image_url] : []),
    IsWinterApproved: metadata.is_winter_approved,
    OnTheWaterStock: metadata.on_the_water_stock,
    YoutubeUrl: metadata.youtube_url,
    ThreeSixtyImageUrl: metadata.three_sixty_url,
    TuvUrl: metadata.tuv_url,
    next_delivery: metadata.next_delivery
  };
};
