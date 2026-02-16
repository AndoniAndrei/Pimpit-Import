
// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

// URL construction based on provided API Docs
// We explicitly request Alloy and Steel Rims.
// We exclude CarTyres and Accessories to reduce payload size and focus on wheels.
const BASE_URL = 'https://api.statusfalgar.se/api/Articles';
const PARAMS = new URLSearchParams({
    OnlyLocalStockItems: 'false', // Fetch full stock, not just local
    IncludeCarTyres: 'false',     // Exclude tyres
    IncludeAlloyRims: 'true',     // Include Alloys (Status, Boost, Dirt usually fall here)
    IncludeSteelRims: 'true',     // Include Steel (Just in case)
    IncludeAccessories: 'false'   // Exclude nuts/bolts/etc
});

const DATA_URL = `${BASE_URL}?${PARAMS.toString()}`;
const USER_AGENT = 'Pimpit-B2B-Catalog-Proxy/2.0';

export default async function handler(req: Request): Promise<Response> {
  // Credentials
  const customerId = '5432';
  const token = 'BSzMrDxAzojUYyGVvXZL3G3Bci0d0PsxRXWq';

  // Basic Auth: Base64 encode "CustomerId:Token"
  const authString = `${customerId}:${token}`;
  const encodedAuth = btoa(authString); 

  try {
    const dataResponse = await fetch(DATA_URL, {
        headers: {
            'User-Agent': USER_AGENT,
            'Authorization': `Basic ${encodedAuth}`,
            'Accept': 'application/json' // Explicitly request JSON
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        const errorBodyText = await dataResponse.text();
        console.error(`Source 6 API Error (Status: ${dataResponse.status}): ${errorBodyText}`);
        throw new Error(`Eroare Statusfälgar API (Status: ${dataResponse.status})`);
    }

    // Pass the response headers and body through
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(dataResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Eroare critică Sursa 6:', error);
    const errorMessage = error instanceof Error ? error.message : 'Eroare necunoscută.';
    return new Response(
      JSON.stringify({
          error: "Eroare la sincronizarea Sursei 6.",
          details: errorMessage
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
