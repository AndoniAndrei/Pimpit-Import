export interface Product {
  [key: string]: any;
}

export type FilterMode = 'standard' | 'staggered';

export interface Filters {
    searchTerm: string;
    Brand: string;
    Finish: string;
    Size: string;
    PCD: string;
    // Standard filters
    Width: string;
    Offset: string;
    // Staggered filters
    Width_Front: string;
    Offset_Front: string;
    Width_Rear: string;
    Offset_Rear: string;
}

export interface AvailableOptions {
    Brand: string[];
    Finish: string[];
    Size: string[];
    PCD: string[];
    Width: string[];
    Offset: string[];
    Width_Front: string[];
    Offset_Front: string[];
    Width_Rear: string[];
    Offset_Rear: string[];
}
