
import React from 'react';

interface SpinnerProps {
  message?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ message }) => {
  return (
    <div className="flex flex-col justify-center items-center py-20 text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      {message && <p className="mt-4 text-lg text-gray-600 font-semibold">{message}</p>}
    </div>
  );
};

export default Spinner;