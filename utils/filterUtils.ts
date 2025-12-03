
// Helper function to expand multi-value PCD strings
export const expandPcdValues = (values: (string | number)[]): string[] => {
  const allPcds = new Set<string>();
  values.forEach(pcd => {
    if (!pcd) return;
    String(pcd).split(/[,/\s]+/).filter(Boolean).forEach(part => allPcds.add(part.trim()));
  });
  return Array.from(allPcds);
};

// Helper function to expand ET/Offset ranges and comma-separated lists
export const expandOffsetValues = (values: (string | number)[]): string[] => {
  const allOffsets = new Set<string>();
  values.forEach(offset => {
    if (offset === null || offset === undefined) return;
    const offsetStr = String(offset).trim();
    if (offsetStr === '') return;

    // Split by comma/space to handle lists like "20, 21, 22" or ranges like "20-40"
    const parts = offsetStr.split(/[,/\s]+/).filter(Boolean);

    parts.forEach(part => {
      const trimmedPart = part.trim();
      const rangeMatch = trimmedPart.match(/^(-?\d+)-(-?\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            allOffsets.add(String(i));
          }
        } else {
          allOffsets.add(trimmedPart); // Add invalid range as is
        }
      } else if (!isNaN(parseInt(trimmedPart, 10))) {
        // Add if it's a valid number
        allOffsets.add(trimmedPart);
      }
    });
  });
  return Array.from(allOffsets);
};

// Helper to check if a product's value matches the selected filter, accounting for special formats
export const productMatchesFilter = (productValue: any, filterValue: string, key: 'PCD' | 'Offset'): boolean => {
  if (filterValue === 'all') return true;
  if (productValue === null || productValue === undefined) return false;

  const prodValStr = String(productValue).trim();
  const filterValStr = String(filterValue).trim();
  if (prodValStr === filterValStr) return true;

  const valueParts = prodValStr.split(/[,/\s]+/).filter(Boolean);

  if (key === 'PCD') {
    return valueParts.includes(filterValStr);
  }

  if (key === 'Offset') {
    const filterNum = parseInt(filterValStr, 10);
    if (isNaN(filterNum)) return false; // Can't match if filter isn't a number

    // Check each part of the product's offset value
    for (const part of valueParts) {
      // Check if the part is the exact number
      if (part === filterValStr) return true;

      // Check if the part is a range and the filter value falls within it
      const rangeMatch = part.match(/^(-?\d+)-(-?\d+)$/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          if (filterNum >= start && filterNum <= end) {
            return true;
          }
        }
      }
    }
  }

  return false;
};
