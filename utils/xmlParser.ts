
import { Product } from '../types';

/**
 * Parses XML text into an array of product-like objects.
 * @param xmlString The XML content as a string.
 * @returns An array of objects, where each object represents a product.
 */
export const parseXMLData = (xmlString: string): Product[] => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");

    const errorNode = xmlDoc.querySelector('parsererror');
    if (errorNode) {
      console.error("XML Parsing Error:", errorNode.textContent);
      throw new Error("Failed to parse XML file. Check format.");
    }

    const productNodes = xmlDoc.getElementsByTagName("product");
    const results: Product[] = [];

    for (const productNode of Array.from(productNodes)) {
      const productObj: Product = {};
      for (const child of Array.from(productNode.children)) {
        if (child.tagName) {
          productObj[child.tagName] = child.textContent;
        }
      }
      results.push(productObj);
    }
    
    return results;

  } catch (error) {
    console.error("Error in parseXMLData:", error);
    throw new Error("Could not process XML data.");
  }
};