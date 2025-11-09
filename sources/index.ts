import { source1 } from './source1';
import { source2 } from './source2';
import { source3 } from './source3';
import { source4 } from './source4';
import { DataSource } from '../types';

// To add a new source, create a new file in this directory,
// import it here, and add it to the array.
// To disable a source, simply remove it from this array or comment it out.

const sources: (DataSource | undefined)[] = [
    source1,
    source2,
    source3,
    source4,
];

// Filter out any sources that might not have a URL or a custom fetcher defined.
export const allSources = sources.filter((s): s is DataSource => s && (!!s.url || !!s.fetcher));