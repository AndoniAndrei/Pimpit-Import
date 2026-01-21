
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => {
        const sku = getProp(p, 'sku');
        if (!sku || String(sku).trim() === '') return false;

        const producer = String(getProp(p, 'producent') || '').trim().toLowerCase();
        if (producer.includes('dirt')) return false;

        return true;
    })
    .map(p => {
      const purchasePriceStr = String(getProp(p, 'cena_zakupu_netto_eur') || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round((((((purchasePrice * 4) + 70) * 1.21) * 1.35) * 5) / 4);

      const stockProducer = parseInt(String(getProp(p, 'stan_magazynowy_producenta') || '0').trim(), 10) || 0;
      const stockOwn = parseInt(String(getProp(p, 'stan_magazynowy_własny') || '0').trim(), 10) || 0;
      const totalStock = Math.max(stockProducer, stockOwn);

      const pcd1 = String(getProp(p, 'rozstaw') || '').trim();
      const pcd2 = String(getProp(p, 'rozstaw2') || '').trim();
      const combinedPcd = [pcd1, pcd2].filter(Boolean).join('/');

      const imageUrls = String(getProp(p, 'zdjęcie') || '')
        .split(',')
        .map(url => url.trim())
        .filter(url => url.startsWith('http'));

      const product: Product = {
        PartNumber: getProp(p, 'sku'),
        Brand: getProp(p, 'producent'),
        Model: getProp(p, 'model'),
        PartDescription: getProp(p, 'nazwa_produktu'),
        Finish: getProp(p, 'kolor'),
        Size: getProp(p, 'średnica'),
        Width: getProp(p, 'szerokość'),
        PCD: combinedPcd,
        Offset: getProp(p, 'et'),
        CB: getProp(p, 'otwór'),
        Stock: totalStock,
        Price: calculatedPrice,
        Weight: getProp(p, 'waga_netto_kg'),
        Load: getProp(p, 'nośność'),
        ImageUrl: imageUrls[0],
        ImageUrls: imageUrls,
        Source: 'Sursa 4',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/felgeo';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    } catch (error) {
        throw new Error(`Nu s-a putut încărca Sursa 4.`);
    }
};

export const source4: DataSource = {
  name: 'Sursa 4',
  type: 'csv',
  fetcher,
  parserConfig: {
    columnMapping: [
      '', 'internal_code', 'sku', 'producent', 'model', 'średnica', 'szerokość', 'rozstaw', 'rozstaw2', 'et', 'otwór', '', 'kolor', 'stan_magazynowy_producenta', 'stan_magazynowy_własny', '', '', '', 'cena_zakupu_netto_eur', '', '', '', '', 'waga_netto_kg', 'nośność', 'technologia_produkcji', '', 'zdjęcie', '', 'wklęsłość', 'nazwa_produktu'
    ],
    encoding: 'windows-1252',
  },
  map,
};
