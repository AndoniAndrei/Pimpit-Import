
import { GoogleGenAI } from "@google/genai";

// Cache to store translations and avoid redundant API calls.
const translationCache = new Map<string, string>();
let ai: GoogleGenAI | null = null;

// Lazy initialization of the Gemini client.
const getAi = () => {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return ai;
};

/**
 * Translates a given text to Romanian using the Gemini API, with caching.
 * It attempts to intelligently skip translation for technical terms, brand names,
 * and simple numeric values to preserve data integrity and save costs.
 *
 * @param text The text to be translated. Can be a string, null, or undefined.
 * @returns A promise that resolves to the translated string, or the original text if translation is not needed or fails.
 */
export const translateText = async (text: string | null | undefined): Promise<string> => {
  if (!text || typeof text !== 'string' || !text.trim()) {
    return text || '';
  }

  const trimmedText = text.trim();

  // Return from cache if available.
  if (translationCache.has(trimmedText)) {
    return translationCache.get(trimmedText)!;
  }

  // Avoid translating text that is purely numeric or technical-looking,
  // as these are likely identifiers, measurements, or codes.
  if (/^[\d\s.,\-/"'&x#]+$/i.test(trimmedText)) {
    return trimmedText;
  }

  try {
    const aiClient = getAi();
    const model = 'gemini-2.5-flash';

    const prompt = `Translate the following English text to Romanian.
- Only return the translated text.
- Do not add any introductory phrases like "Here is the translation:".
- If the text is a proper noun, a brand name, a model number, or technical jargon that should not be translated, return it unchanged.
Text to translate: "${trimmedText}"`;

    const response = await aiClient.models.generateContent({
      model,
      contents: prompt,
    });
    
    // The Gemini API can sometimes wrap the response in quotes, so we remove them.
    const translated = response.text.trim().replace(/^"|"$/g, '');

    // Cache the successful translation.
    translationCache.set(trimmedText, translated);
    return translated;

  } catch (error) {
    console.error(`Failed to translate text: "${trimmedText}"`, error);
    // On failure, return the original text to prevent breaking the UI.
    return trimmedText;
  }
};
