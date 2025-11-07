
import { source1 } from './source1';
import { source2 } from './source2';
import { DataSource } from '../types';

// To add a new source, create a new file in this directory,
// import it here, and add it to the array.
// To disable a source, simply remove it from this array or comment it out.

const sources: DataSource[] = [
    source1,
    source2, // Sursa 2 este acum activă.
];

// Filter out any sources that might not have a URL defined, for safety.
export const allSources = sources.filter(s => s && s.url);
