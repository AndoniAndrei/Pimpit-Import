// This is a server-side file and will not be sent to the browser.
// It can safely access environment variables. 

// This configures the function to run on Vercel's Edge Runtime.
// This can resolve deployment issue s and improve performance.
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const apiKey = process.env.WHEELTRADE_API_KEY;

  if (!apiKey) {
    console.error("WHEELTRADE_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ 
          error: "Cheia API nu este configurată pe server.",
          details: "Variabila de mediu WHEELTRADE_API_KEY lipsește."
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  const targetUrl = `https://b2b.wheeltrade.pl/en/xmlapi/7/2/utf8_withoutbom/${apiKey}?stream=true`;

  try {
    const apiResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Pimpit-B2B-Catalog-Proxy/1.0',
      },
      cache: 'no-store',
    });

    // Get the body text regardless of the initial status code
    const responseBodyText = await apiResponse.text();

    // The API might return valid data with a non-200 status.
    // We check if the response body looks like the expected CSV header.
    const isLikelyCsvData = responseBodyText.trim().toLowerCase().startsWith('brand;name;model');
    
    // If the response is not "ok" AND it doesn't contain the data we expect, it's a real error.
    if (!apiResponse.ok && !isLikelyCsvData) {
      console.error(`Wheeltrade API Error (Status: ${apiResponse.status}): ${responseBodyText}`);
      return new Response(
        JSON.stringify({ 
          error: "Eroare la comunicarea cu Sursa 3.", 
          details: responseBodyText.trim() || `Furnizorul a răspuns cu status ${apiResponse.status}.`
        }),
        {
          status: 502, // Bad Gateway
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // If we are here, it's either a successful response or a "failed" response that contains our data.
    // We treat it as a success and forward the data with a 200 OK status.
    const headers = new Headers();
    headers.set('Content-Type', apiResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(responseBodyText, {
      headers: headers,
      status: 200, // Force a 200 OK status for the client
    });

  } catch (error) {
    console.error('Error in API proxy:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ 
          error: "Eroare internă în proxy-ul serverului.", 
          details: errorMessage 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}