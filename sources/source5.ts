
import { DataSource, Product } from '../types';
import { normalizeProductAttributes, getProp } from '../utils/productUtils';

const map = async (data: any[]): Promise<Product[]> => {
  const initialProducts = data
    .filter(p => p && getProp(p, 'Articlecode'))
    .map(p => {
      // Price Calculation: ((((pret de achizitie*4)*1.21)*1.4)*5)/4
      const purchasePriceStr = String(getProp(p, 'Nett-price') || '0').replace(',', '.');
      const purchasePrice = parseFloat(purchasePriceStr) || 0;
      const calculatedPrice = Math.round(((((purchasePrice * 4) * 1.21) * 1.4) * 5) / 4);

      const imageUrl = getProp(p, 'URL-to-photo');
      const imageUrls = imageUrl ? [imageUrl] : [];
      
      let brand = String(getProp(p, 'Brand') || '').trim();
      let model = String(getProp(p, 'Model') || '').trim();
      const description = String(getProp(p, 'Description') || '').trim();

      const combinedSearchString = `${brand} ${model} ${description}`.toLowerCase();
      
      if (combinedSearchString.includes('stw')) {
        brand = 'ABS';
        model = 'STW 287';
      } else if (brand === '355') {
        brand = 'ABS';
        model = '355';
      } else if (brand.toLowerCase() === 'aero') {
        brand = 'ABS';
        model = 'AERO';
      } else if (brand === 'ABS F55') {
        brand = 'ABS';
        model = 'F88';
      } else if ((!brand || !model) && description) {
          const descriptionParts = description.split(/\s+/);
          if (descriptionParts.length >= 2) {
              if (!brand) brand = descriptionParts[0];
              if (!model) model = descriptionParts[1];
          }
      }

      const product: Product = {
        PartNumber: getProp(p, 'Articlecode'),
        Brand: brand,
        Model: model,
        PartDescription: description,
        Finish: getProp(p, 'Color'),
        Size: getProp(p, 'Inch'),
        Width: getProp(p, 'Width'),
        PCD: getProp(p, 'PCD'),
        Offset: getProp(p, 'Offset'),
        CB: getProp(p, 'Centerhole'),
        Stock: parseInt(String(getProp(p, 'Stock')), 10) || 0,
        Price: calculatedPrice,
        ImageUrl: imageUrl,
        ImageUrls: imageUrls,
        Source: 'Sursa 5',
        ProductType: 'Jante',
      };
      
      return product;
    });

    return initialProducts.map(product => normalizeProductAttributes(product));
};

const fetcher = async (): Promise<Response> => {
    const proxyUrl = '/api/abswheels';
    try {
        const response = await fetch(proxyUrl, { cache: 'no-store' });
        if (!response.ok) {
            let errorDetails = `Proxy-ul pentru Sursa 5 a eșuat (status: ${response.status}).`;
            try {
                const errorData = await response.json();
                errorDetails = errorData.details || errorData.error || errorDetails;
            } catch (e) {}
            throw new Error(errorDetails);
        }
        return response;
    } catch (error) {
        throw new Error(`Nu s-a putut încărca Sursa 5. Motiv: ${error instanceof Error ? error.message : 'Eroare necunoscută.'}`);
    }
};

export const source5: DataSource = {
  name: 'Sursa 5',
  type: 'csv',
  fetcher,
  parserConfig: {
    requiredHeaders: ['articlecode', 'brand', 'model', 'color', 'nett-price', 'stock'],
    delimiter: ';',
    encoding: 'windows-1252',
  },
  map,
};
