// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const targetUrl = 'http://gl-traders1.nazwa.pl/felgeostocks/felgeo.csv';

  try {
    const apiResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Pimpit-B2B-Catalog-Proxy/1.0',
      },
      cache: 'no-store',
    });

    if (!apiResponse.ok) {
      const errorBodyText = await apiResponse.text();
      console.error(`Felgeo API Error (Status: ${apiResponse.status}): ${errorBodyText}`);
      return new Response(
        JSON.stringify({
          error: "Eroare la comunicarea cu Sursa 4.",
          details: errorBodyText.trim() || `Furnizorul a răspuns cu status ${apiResponse.status}.`
        }),
        {
          status: 502, // Bad Gateway
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const headers = new Headers();
    headers.set('Content-Type', apiResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(apiResponse.body, {
      headers: headers,
      status: 200,
    });

  } catch (error) {
    console.error('Error in API proxy for Felgeo:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
          error: "Eroare internă în proxy-ul serverului pentru Sursa 4.",
          details: errorMessage
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}