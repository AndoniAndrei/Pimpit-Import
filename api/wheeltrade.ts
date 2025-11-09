// This is a server-side file and will not be sent to the browser.
// It can safely access environment variables.

// This configures the function to run on Vercel's Edge Runtime.
// This can resolve deployment issues and improve performance.
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  // Retrieve the API key from server-side environment variables.
  const apiKey = process.env.WHEELTRADE_API_KEY;

  // If the key is not set on the server, return an error.
  if (!apiKey) {
    console.error("WHEELTRADE_API_KEY is not configured on the server.");
    return new Response(
      JSON.stringify({ error: "API key is not configured on the server." }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Construct the target URL for the Wheeltrade API.
  const targetUrl = `https://b2b.wheeltrade.pl/en/xmlapi/7/2/utf8_withoutbom/${apiKey}?stream=true`;

  try {
    // Fetch the data from the Wheeltrade API.
    // We add a User-Agent for good practice.
    const apiResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Pimpit-B2B-Catalog-Proxy/1.0',
      },
      cache: 'no-store',
    });

    // Check if the request to the external API was successful.
    if (!apiResponse.ok) {
      console.error(`Failed to fetch from Wheeltrade API. Status: ${apiResponse.status}`);
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        statusText: apiResponse.statusText,
        headers: apiResponse.headers,
      });
    }

    // Stream the response from the Wheeltrade API back to the client.
    // This is efficient as it doesn't require the server to hold the entire file in memory.
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
      JSON.stringify({ error: "An internal server error occurred while fetching data.", details: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
