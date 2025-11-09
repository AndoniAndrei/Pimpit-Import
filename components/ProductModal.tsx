import React, { useState, useEffect, useMemo } from 'react';
import { Product } from '../types';

interface ProductModalProps {
  product: Product;
  onClose: () => void;
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

const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const imageUrls = useMemo(() => product['ImageUrls'] || [], [product]);
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
  
  const specifications = useMemo(() => {
    const baseSpecs = [
      { key: 'EAN', label: 'EAN' },
      { key: 'Finish', label: 'Finish' },
      { key: 'Size', label: 'Size' },
      { key: 'Width', label: 'Width' },
      { key: 'PCD', label: 'PCD' },
      { key: 'Offset', label: 'Offset' },
      { key: 'CB', label: 'CB' },
      { key: 'Load', label: 'Load' },
      { key: 'Weight', label: 'Weight' },
      { key: 'Model', label: 'Model' },
      { key: 'TuvUrl', label: 'TUV' },
    ];

    return baseSpecs.map(spec => {
        let value = cleanValue(product[spec.key]);
        if (spec.key === 'Offset') {
            value = formatDisplayOffset(value);
        }
        return { ...spec, value };
      }).filter(spec => spec.value);

  }, [product]);

  const productBrand = cleanValue(product['Brand']);
  const productDescription = cleanValue(product['PartDescription']);
  const productCode = cleanValue(product['PartNumber']);

  const stock = product['Stock'] || 0;
  const onTheWater = product['OnTheWaterStock'] || 0;
  const hasStock = stock > 0;

  const getYoutubeEmbedUrl = (url: string) => {
      if (!url) return null;
      try {
          const urlObj = new URL(url);
          const videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop();
          return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      } catch (e) {
          return null;
      }
  }
  const youtubeEmbedUrl = getYoutubeEmbedUrl(product.YoutubeUrl);

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
                    onError={(e) => { 
                      (e.target as HTMLImageElement).src = placeholderImage; 
                      setMainImage(placeholderImage);
                    }}
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
                <span className="text-3xl font-extrabold text-blue-600">{new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(product['Price'] || 0)}</span>
                <p className="text-sm text-gray-500">TVA inclus</p>
             </div>
             <div className="text-sm text-gray-600 mt-4 space-y-2">
                <p>Stoc Depozit: <strong className={hasStock ? "text-green-600" : "text-red-600"}>{stock} buc.</strong></p>
                {onTheWater > 0 && <p>Stoc "On the water": <strong className="text-blue-600">{onTheWater} buc.</strong></p>}
                {product.next_delivery && <p>Următoarea livrare: <strong className="text-purple-600">{product.next_delivery}</strong></p>}
             </div>
              {product.ThreeSixtyImageUrl && (
                  <div className="mt-4 text-right">
                      <a href={product.ThreeSixtyImageUrl} target="_blank" rel="noopener noreferrer" className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-semibold shadow-sm">
                          Vizualizare 3D
                      </a>
                  </div>
              )}
           </div>
           
           <div className="flex-grow space-y-6">
               {youtubeEmbedUrl && (
                   <div>
                       <h4 className="text-lg font-semibold text-gray-800 mb-3">Video Prezentare</h4>
                       <div className="aspect-w-16 aspect-h-9">
                           <iframe src={youtubeEmbedUrl} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Video Produs" className="w-full h-full rounded-lg shadow-md"></iframe>
                       </div>
                   </div>
               )}
               
               {product.Description && (
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-3">Descriere</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{product.Description}</p>
                    </div>
               )}
               
               {specifications.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-3">Specificații</h4>
                     <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 text-sm">
                         {specifications.map(({ key, label, value }) => (
                             <div key={key} className="bg-gray-50 p-2 rounded-md">
                                 <dt className="font-medium text-gray-500 truncate">{label}</dt>
                                 {label === 'TUV' ? (
                                    <dd className="text-gray-900 font-semibold truncate">
                                        <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                        Descarcă Certificat
                                        </a>
                                    </dd>
                                    ) : (
                                    <dd className="text-gray-900 font-semibold truncate">{String(value)}</dd>
                                    )}
                             </div>
                         ))}
                     </dl>
                  </div>
               )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProductModal;