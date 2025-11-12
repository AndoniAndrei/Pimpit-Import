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

// Formats a potentially long, comma-separated list of consecutive numbers into a range for display.
const formatDisplayOffset = (offset: any): string => {
    const offsetStr = String(offset || '').trim();
    if (!offsetStr) return '';

    // If the value is already a standard range (e.g., "20-51"), return it directly.
    if (/^-?\d+-\d+$/.test(offsetStr)) {
        return offsetStr;
    }

    // If it's not a comma-separated list, it's a single value. Return it.
    if (!offsetStr.includes(',')) {
        return offsetStr;
    }
    
    // It's a list. Try to format it as a range if consecutive.
    const parts = offsetStr.split(',').map(s => s.trim());
    const numbers = parts.map(p => parseInt(p, 10));

    // If any part is not a valid number, it's a complex string; return as is.
    if (numbers.some(n => isNaN(n))) {
        return offsetStr;
    }

    // If it's a list of 3 or more consecutive numbers, format as a range.
    if (numbers.length >= 3) {
        numbers.sort((a, b) => a - b);
        let isConsecutive = true;
        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] !== numbers[i - 1] + 1) {
                isConsecutive = false;
                break;
            }
        }
        if (isConsecutive) {
            return `${numbers[0]}-${numbers[numbers.length - 1]}`;
        }
    }
    
    // It's a non-consecutive list, so just return the original (cleaned) string.
    return numbers.join(', ');
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
  const isWinterApproved = product.IsWinterApproved && String(product.IsWinterApproved).toLowerCase() === 'yes';

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
        <div className="absolute top-2 right-2 flex items-center gap-2">
            {isWinterApproved && (
                <span className="text-xs font-bold text-blue-800 bg-blue-200 px-2 py-1 rounded-full shadow" title="Potrivit pentru iarnă">❄️ Iarnă</span>
            )}
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
        
        {(product.Size || product.Width || product.PCD || product.Offset) && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 my-2 py-2 border-y">
                {product.Size && <p><strong className="font-normal text-gray-500">R:</strong> {product.Size}</p>}
                {product.Width && <p><strong className="font-normal text-gray-500">J:</strong> {product.Width}</p>}
                {product.PCD && <p><strong className="font-normal text-gray-500">PCD:</strong> {product.PCD}</p>}
                {product.Offset && <p><strong className="font-normal text-gray-500">ET:</strong> {formatDisplayOffset(product.Offset)}</p>}
            </div>
        )}
        
        <div className="text-sm text-gray-600 flex-grow">
          <p>Stoc Depozit: <strong className={hasStock ? "text-green-600" : "text-red-600"}>{stock} buc.</strong></p>
          {onTheWater > 0 && <p>Stoc "On the water": <strong className="text-blue-600">{onTheWater} buc.</strong></p>}
          {!hasStock && product.Source === 'Sursa 3' && product.next_delivery && (
            <p className="text-purple-600 text-xs mt-1">Livrare: <strong className="font-semibold">{product.next_delivery}</strong></p>
          )}
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