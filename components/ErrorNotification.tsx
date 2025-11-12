
import React, { useState, useEffect } from 'react';
import { SourceError } from '../types';

interface ErrorNotificationProps {
  errors: SourceError[];
}

const ErrorNotification: React.FC<ErrorNotificationProps> = ({ errors }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (errors.length > 0) {
      setIsVisible(true);
    }
  }, [errors]);

  if (!isVisible || errors.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-5 right-5 w-full max-w-sm bg-white shadow-lg rounded-lg p-4 z-50 border-l-4 border-red-500 animate-fade-in-down">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium text-gray-900">Problemă la încărcarea datelor</p>
          <div className="mt-2 text-sm text-gray-500">
            <p>Următoarele surse nu au putut fi încărcate și nu sunt afișate:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              {errors.map((error, index) => (
                <li key={index}>
                  <strong className="font-semibold text-gray-700">{error.name}:</strong> {error.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={() => setIsVisible(false)}
            className="bg-white rounded-md inline-flex text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            aria-label="Închide notificare"
          >
            <span className="sr-only">Închide</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorNotification;