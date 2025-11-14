// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

// --- New Target URL based on API documentation ---
const DATA_URL = 'https://api.statusfalgar.se/api/PriceList'; 
const USER_AGENT = 'Pimpit-B2B-Catalog-Proxy/1.2'; // Version bump

/**
 * Fetches data from Source 6 using Basic Authentication.
 */
export default async function handler(req: Request): Promise<Response> {
  // Credentials provided by the user.
  const customerId = '5432';
  const token = 'BSzMrDxAzojUYyGVvXZL3G3Bci0d0PsxRXWq';

  // For Basic Auth, credentials must be in the format "username:password" and Base64 encoded.
  // In this API's case, it's "customerId:token".
  const authString = `${customerId}:${token}`;
  const encodedAuth = btoa(authString); // btoa is available in Edge Runtime

  try {
    // Fetch the data using the new Basic Authentication header.
    const dataResponse = await fetch(DATA_URL, {
        headers: {
            'User-Agent': USER_AGENT,
            'Authorization': `Basic ${encodedAuth}`,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        const errorBodyText = await dataResponse.text();
        console.error(`Source 6 API Error (Status: ${dataResponse.status}): ${errorBodyText}`);
        throw new Error(`Autorizare eșuată la Sursa 6 (Status: ${dataResponse.status}). Verificați Customer ID și Token.`);
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
