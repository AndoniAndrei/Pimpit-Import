// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const targetUrl = 'https://statusfalgar.se/api/PriceList';
  // Hardcoded credentials as requested by the user.
  const username = "office@pimpit.ro";
  const password = "40785733102";

  // Prepare Basic Authentication header
  const credentials = btoa(`${username}:${password}`);
  const requestHeaders = new Headers();
  requestHeaders.set('Authorization', `Basic ${credentials}`);
  requestHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

  try {
    const apiResponse = await fetch(targetUrl, {
      headers: requestHeaders,
      cache: 'no-store',
    });

    if (!apiResponse.ok) {
      const errorBodyText = await apiResponse.text();
      // Check for specific authorization error text from the API response
      if (apiResponse.status === 401 || errorBodyText.includes('Authorization has been denied')) {
          console.error(`Source 6 Authorization Failed (Status: ${apiResponse.status}): ${errorBodyText}`);
           return new Response(
            JSON.stringify({
              error: "Autorizare eșuată pentru Sursa 6.",
              details: "Autentificarea a eșuat. Acest lucru se poate datora unor credențiale incorecte sau faptului că serverul furnizorului necesită o metodă de autentificare mai complexă (ex: cookie de sesiune), care nu este compatibilă cu accesul direct la API. Vă rugăm să verificați credențialele și, dacă problema persistă, să contactați furnizorul pentru a confirma metoda corectă de autentificare pentru scripturi."
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' }
            }
          );
      }
      
      // Check if the body is HTML, which indicates the server blocked the request for other reasons.
      if (errorBodyText.trim().toLowerCase().startsWith('<!doctype html')) {
          console.error(`Source 6 returned an HTML page instead of CSV. (Status: ${apiResponse.status})`);
          return new Response(
            JSON.stringify({
              error: "Eroare la comunicarea cu Sursa 6.",
              details: "Furnizorul a blocat cererea și a returnat o pagină web în loc de fișierul cu produse."
            }),
            {
              status: 502,
              headers: { 'Content-Type': 'application/json' }
            }
          );
      }
      
      console.error(`Source 6 API Error (Status: ${apiResponse.status}): ${errorBodyText}`);
      return new Response(
        JSON.stringify({
          error: "Eroare la comunicarea cu Sursa 6.",
          details: errorBodyText.trim() || `Furnizorul a răspuns cu status ${apiResponse.status}.`
        }),
        {
          status: 502, // Bad Gateway
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', apiResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(apiResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Error in API proxy for Source 6:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({
          error: "Eroare internă în proxy-ul serverului pentru Sursa 6.",
          details: errorMessage
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}