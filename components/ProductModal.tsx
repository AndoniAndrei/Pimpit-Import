
import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
}

const getAllImageUrls = (product: Product): string[] => {
  const urls: string[] = [];
  const imageKeys = ['Image URL', 'Image URL 1', 'Image URL 2', 'Image URL 3', 'Image URL 4'];
  for (const key of imageKeys) {
    const url = product[key];
    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
      urls.push(url.trim());
    }
  }
  return urls;
};

const parseAndFormatPrice = (priceValue: any): string => {
    const formatter = new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' });
    if (typeof priceValue === 'number') return formatter.format(priceValue);
    if (typeof priceValue !== 'string' || !priceValue) return formatter.format(0);
    let cleanValue = priceValue.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
    return formatter.format(parseFloat(cleanValue) || 0);
};

const cleanValue = (value: any): string => {
    const strValue = String(value || '');
    return strValue.trim().toUpperCase() === '#N/A' ? '' : strValue;
};

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const imageUrls = useMemo(() => getAllImageUrls(product), [product]);
  const [mainImage, setMainImage] = useState<string>(imageUrls[0] || `https://via.placeholder.com/600x450.png?text=Imagine+indisponibila`);
  const placeholderImage = `https://via.placeholder.com/600x450.png?text=Imagine+indisponibila`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);
  
  const displayedKeys = new Set(['PartNumber', 'PartDescription', 'Brand', 'Pret client in lei/buc', '7001', 'On the water', 'Image URL', 'Image URL 1', 'Image URL 2', 'Image URL 3', 'Image URL 4', '']);
  const otherDetails = Object.entries(product).filter(([key, value]) => 
    !displayedKeys.has(key) && 
    value && 
    String(value).trim() !== '' && 
    String(value).trim().toUpperCase() !== '#N/A'
  );

  const productBrand = cleanValue(product['Brand']);
  const productDescription = cleanValue(product['PartDescription']);
  const productCode = cleanValue(product['PartNumber']);

  const stock7001 = parseInt(product['7001'], 10) || 0;
  const onTheWater = parseInt(product['On the water'], 10) || 0;
  const hasStock = stock7001 > 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-modal-title"
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image Gallery */}
        <div className="w-full md:w-1/2 p-4 flex flex-col bg-gray-100">
            <div className="flex-grow flex items-center justify-center mb-4">
                 <img
                    src={mainImage}
                    alt={productDescription}
                    className="max-w-full max-h-96 object-contain rounded-md"
                    onError={(e) => { (e.target as HTMLImageElement).src = placeholderImage; }}
                />
            </div>
            {imageUrls.length > 1 && (
                <div className="flex space-x-2 justify-center">
                    {imageUrls.map((url, index) => (
                        <button
                            key={index}
                            onClick={() => setMainImage(url)}
                            className={`w-16 h-16 rounded-md overflow-hidden border-2 ${mainImage === url ? 'border-blue-500' : 'border-transparent'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                        >
                            <img src={url} alt={`Imagine produs ${index + 1}`} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* Product Details */}
        <div className="w-full md:w-1/2 p-6 flex flex-col overflow-y-auto">
           <div className="flex justify-between items-start mb-4">
               <div>
                  <h3 className="text-sm text-gray-500 font-semibold">{productBrand}</h3>
                  <h2 id="product-modal-title" className="text-2xl font-bold text-gray-800">{productDescription}</h2>
                  <p className="text-xs text-gray-400 mt-1">Cod: {productCode}</p>
               </div>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded-full p-1"
                    aria-label="Închide fereastra"
                >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
           </div>
           
           <div className="mb-6 pb-6 border-b border-gray-200">
             <div className="text-right">
                <span className="text-3xl font-extrabold text-blue-600">{parseAndFormatPrice(product['Pret client in lei/buc'])}</span>
                <p className="text-sm text-gray-500">TVA inclus</p>
             </div>
             <div className="text-sm text-gray-600 mt-4 space-y-2">
                <p>Stoc Depozit: <strong className={hasStock ? "text-green-600" : "text-red-600"}>{stock7001} buc.</strong></p>
                {onTheWater > 0 && <p>Stoc "On the water": <strong className="text-blue-600">{onTheWater} buc.</strong></p>}
             </div>
           </div>

           <div className="flex-grow">
               <h4 className="text-lg font-semibold text-gray-800 mb-3">Specificații</h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    {otherDetails.map(([key, value]) => (
                        <div key={key} className="bg-gray-50 p-2 rounded-md">
                            <dt className="font-medium text-gray-500 truncate">{key}</dt>
                            <dd className="text-gray-900 font-semibold truncate">{String(value)}</dd>
                        </div>
                    ))}
                </dl>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;