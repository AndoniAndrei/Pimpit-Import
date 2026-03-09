
import { PricingRule } from './utils/pricing/calculateFinalPrice';

export interface Product {
  id?: string; // Database ID (UUID)
  [key: string]: any;
  OldPrice?: number; // Optional field for RRP/List Price
  source_file?: string;
}

export type FilterMode = 'standard' | 'staggered';

export interface Filters {
    searchTerm: string;
    Brand: string;
    Finish: string;
    Size: string;
    PCD: string;
    ProductType: string;
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
    ProductType: string[];
    Width: string[];
    Offset: string[];
    Width_Front: string[];
    Offset_Front: string[];
    Width_Rear: string[];
    Offset_Rear: string[];
}

export interface ParserConfig {
  requiredHeaders?: string[];
  columnMapping?: string[];
  delimiter?: string;
  encoding?: string;
}

export interface DataSource {
  name: string;
  url?: string; // Made optional to support fetcher
  type?: 'csv' | 'xml' | 'json';
  parserConfig?: ParserConfig;
  map: (data: any[], pricingRule?: PricingRule) => Promise<Product[]>; // Added custom fetcher for resilient sources
  fetcher?: () => Promise<Response>;
}

export interface SourceError {
  name: string;
  message: string;
}