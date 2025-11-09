// This is a server-side file and will not be sent to the browser.
// It can safely access environment variables.

// This configures the function to run on Vercel's Edge Runtime.
// This can resolve deployment issues and improve performance.
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

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error(`Wheeltrade API Error (Status: ${apiResponse.status}): ${errorBody}`);
      return new Response(
        JSON.stringify({ 
          error: "Eroare la comunicarea cu Sursa 3.", 
          details: errorBody.trim() || `Furnizorul a răspuns cu status ${apiResponse.status}.`
        }),
        {
          status: 502, // Bad Gateway
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const contentType = apiResponse.headers.get('content-type');
    if (!contentType || !contentType.includes('xml')) {
        const responseBody = await apiResponse.text();
        console.error(`Wheeltrade API did not return XML. Content-Type: ${contentType}. Body: ${responseBody.slice(0, 500)}`);
        return new Response(
          JSON.stringify({
            error: "Sursa 3 nu a returnat un răspuns XML valid.",
            details: `Tipul de conținut primit: ${contentType}. Începutul răspunsului: ${responseBody.slice(0, 200)}...`
          }),
          {
            status: 502,
            headers: { 'Content-Type': 'application/json' }
          }
        );
    }

    return new Response(apiResponse.body, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
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