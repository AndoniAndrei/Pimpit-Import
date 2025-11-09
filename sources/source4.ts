import { DataSource, Product } from '../types';
import { normalizeProductAttributes } from '../utils/productUtils';

const map = async (data: Product[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && p['sku'] && String(p['sku']).trim() !== '')
    .map(p => {
      // 1. Price Calculation
      const purchasePriceStr = String(p['cena_zakupu_netto_eur'] || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      // Formula: (((((Pret achizitie * 4) + 70) * 1.21) * 1.35) * 5) / 4
      const calculatedPrice = Math.round((((((purchasePrice * 4) + 70) * 1.21) * 1.35) * 5) / 4);

      // 2. Stock Calculation
      const stockProducer = parseInt(String(p['stan_magazynowy_producenta']).trim(), 10) || 0;
      const stockOwn = parseInt(String(p['stan_magazynowy_własny']).trim(), 10) || 0;
      const totalStock = Math.max(stockProducer, stockOwn);

      // 3. PCD combination
      const pcd1 = String(p['rozstaw'] || '').trim();
      const pcd2 = String(p['rozstaw2'] || '').trim();
      const combinedPcd = [pcd1, pcd2].filter(Boolean).join(', ');

      // 4. Image splitting
      const imageUrls = String(p['zdjęcie'] || '')
        .split(',')
        .map(url => url.trim())
        .filter(url => url.startsWith('http'));

      // 5. Map to unified Product structure
      const product: Product = {
        PartNumber: p['sku'],
        Brand: p['producent'],
        Model: p['model'],
        PartDescription: p['nazwa_produktu'],
        Finish: p['kolor'],
        Size: p['średnica'],
        Width: p['szerokość'],
        PCD: combinedPcd,
        Offset: p['et'],
        CB: p['otwór'],
        Stock: totalStock,
        Price: calculatedPrice,
        Weight: p['waga_netto_kg'],
        Load: p['nośność'],
        ProductionMethod: p['technologia_produkcji'], // Custom field
        Concavity: p['wklęsłość'], // Custom field
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        Source: 'Sursa 4',
        ProductType: 'Jante', // Assuming all are wheels for now
      };
      
      return product;
    });

    // Normalize product attributes for consistency
    return initialProducts.map(product => normalizeProductAttributes(product));
};


export const source4: DataSource = {
  name: 'Sursa 4',
  url: 'http://gl-traders1.nazwa.pl/felgeostocks/felgeo.csv',
  type: 'csv',
  parserConfig: {
    requiredHeaders: ['sku', 'producent', 'cena_zakupu_netto_eur'],
  },
  map,
};
