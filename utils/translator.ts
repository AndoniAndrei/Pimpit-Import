// Cache to store translations and avoid redundant API calls.
const translationCache = new Map<string, string>();
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Translates a given text to Romanian using the OpenAI GPT API, with caching.
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('OpenAI API key is not configured. Translation will be skipped.');
    return trimmedText; // Skip translation if key is missing
  }

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // A cost-effective and fast model for translation
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the following English text to Romanian.
- Only return the translated text.
- Do not add any introductory phrases like "Here is the translation:".
- If the text is a proper noun, a brand name, a model number, or technical jargon that should not be translated, return it unchanged.
- Do not wrap the response in quotes.`
          },
          {
            role: 'user',
            content: trimmedText,
          },
        ],
        temperature: 0, // Translation should be deterministic
        max_tokens: 256, // Generous limit for short product descriptions
      }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || trimmedText;

    // Cache the successful translation.
    translationCache.set(trimmedText, translated);
    return translated;

  } catch (error) {
    console.error(`Failed to translate text with OpenAI: "${trimmedText}"`, error);
    // On failure, return the original text to prevent breaking the UI.
    return trimmedText;
  }
};
