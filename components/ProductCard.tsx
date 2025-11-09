
import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onProductClick: (product: Product) => void;
}

const cleanValue = (value: any): string => {
    const strValue = String(value || '');
    return strValue.trim().toUpperCase() === '#N/A' ? '' : strValue;
};


const ProductCard: React.FC<ProductCardProps> = ({ product, onProductClick }) => {
  const formattedPrice = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(product['Price'] || 0);
  
  const placeholderImage = `https://via.placeholder.com/400x300.png?text=Imagine+indisponibila`;
  const imageUrl = product['ImageUrl'];
  const productName = cleanValue(product['PartDescription']);
  const productBrand = cleanValue(product['Brand']);
  const productCode = cleanValue(product['PartNumber']);

  const stock = product['Stock'] || 0;
  const onTheWater = product['OnTheWaterStock'] || 0;
  const hasStock = stock > 0;

  return (
    <button
      onClick={() => onProductClick(product)}
      className="bg-white rounded-lg shadow-lg overflow-hidden flex flex-col transition-transform duration-300 hover:scale-105 hover:shadow-xl text-left w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      aria-label={`Vezi detalii pentru ${productName}`}
    >
      <div className="w-full h-48 bg-gray-200 flex items-center justify-center relative">
        <img 
          src={imageUrl || placeholderImage} 
          alt={productName} 
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => { (e.target as HTMLImageElement).src = placeholderImage; }}
        />
        <div className="absolute top-2 right-2">
            {hasStock ? (
                <span className="text-xs font-bold text-green-800 bg-green-200 px-2 py-1 rounded-full shadow">În Stoc</span>
            ) : onTheWater > 0 ? (
                <span className="text-xs font-bold text-blue-800 bg-blue-200 px-2 py-1 rounded-full shadow">Precomandă</span>
            ) : (
                <span className="text-xs font-bold text-red-800 bg-red-200 px-2 py-1 rounded-full shadow">Stoc Epuizat</span>
            )}
        </div>
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 className="text-sm text-gray-500 mb-1 truncate font-semibold">{productBrand}</h3>
        <h2 className="text-lg font-bold text-gray-800 truncate" title={productName}>
          {productName}
        </h2>
        <div className="text-xs text-gray-400 mb-2">
            <p>Cod: {productCode}</p>
        </div>
        
        <div className="text-sm text-gray-600 mt-2 flex-grow min-h-[40px]">
          <p>Stoc Depozit: <strong className={hasStock ? "text-green-600" : "text-red-600"}>{stock} buc.</strong></p>
          {onTheWater > 0 && <p>Stoc "On the water": <strong className="text-blue-600">{onTheWater} buc.</strong></p>}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200 text-right">
          <span className="text-2xl font-extrabold text-blue-600">{formattedPrice}</span>
          <p className="text-sm text-gray-500">TVA inclus</p>
        </div>
      </div>
    </button>
  );
};

export default React.memo(ProductCard);