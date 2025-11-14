// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

// --- Target URL ---
const DATA_URL = 'https://statusfalgar.se/api/PriceList';
const USER_AGENT = 'Pimpit-B2B-Catalog-Proxy/1.1';

/**
 * Fetches data from Source 6 using a secure API key.
 * This replaces the previous multi-step credential-based login process.
 */
export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.SOURCE6_API_KEY;

  if (!apiKey) {
    console.error("SOURCE6_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ 
          error: "Cheia API pentru Sursa 6 nu este configurată pe server.",
          details: "Variabila de mediu SOURCE6_API_KEY lipsește."
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Fetch the actual data using the API key for authorization.
    const dataResponse = await fetch(DATA_URL, {
        headers: {
            'User-Agent': USER_AGENT,
            // Standard method for API key authorization.
            'Authorization': `Bearer ${apiKey}`,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        const errorBodyText = await dataResponse.text();
        console.error(`Source 6 API Error (Status: ${dataResponse.status}): ${errorBodyText}`);
        throw new Error(`Autorizare eșuată la accesarea datelor (Status: ${dataResponse.status}). Verificați validitatea cheii API.`);
    }

    // Stream the data back to the client.
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', dataResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(dataResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Eroare în proxy-ul pentru Sursa 6:', error);
    const errorMessage = error instanceof Error ? error.message : 'A apărut o eroare necunoscută.';
    return new Response(
      JSON.stringify({
          error: "Eroare la încărcarea Sursei 6.",
          details: errorMessage
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}