// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request): Promise<Response> {
  const loginUrl = 'https://statusfalgar.se/loggain';
  const dataUrl = 'https://statusfalgar.se/api/PriceList';
  
  const username = "office@pimpit.ro";
  const password = "40785733102";

  // Use a common User-Agent for all requests to mimic a real browser
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  try {
    // --- Step 1: Log in to get the session cookie ---
    const loginBody = new URLSearchParams();
    loginBody.append('Username', username);
    loginBody.append('Password', password);

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: loginBody.toString(),
      redirect: 'manual', // We need to capture the cookie from the redirect response
    });
    
    // A successful login should result in a redirect (status 302)
    // and a 'Set-Cookie' header.
    const setCookieHeader = loginResponse.headers.get('set-cookie');
    if (loginResponse.status !== 302 || !setCookieHeader) {
      console.error(`Source 6 Login Failed (Status: ${loginResponse.status})`);
       return new Response(
        JSON.stringify({
          error: "Autentificare eșuată pentru Sursa 6.",
          details: "Nu s-a putut obține cookie-ul de sesiune. Verificați credențialele sau este posibil ca procesul de login al furnizorului să se fi schimbat."
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Extract the relevant part of the cookie string (e.g., '.ASPXAUTH=...')
    const sessionCookie = setCookieHeader.split(';')[0];
    
    // --- Step 2: Fetch the data using the session cookie ---
    const dataResponse = await fetch(dataUrl, {
        headers: {
            'Cookie': sessionCookie,
            'User-Agent': userAgent,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        const errorBodyText = await dataResponse.text();
        console.error(`Source 6 Data Fetch Error (Status: ${dataResponse.status}): ${errorBodyText}`);
        return new Response(
            JSON.stringify({
                error: "Eroare la descărcarea datelor de la Sursa 6 (după autentificare).",
                details: errorBodyText.trim() || `Furnizorul a răspuns cu status ${dataResponse.status}.`
            }),
            {
                status: 502, // Bad Gateway
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }

    // --- Step 3: Stream the data back to the client ---
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', dataResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(dataResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Error in API proxy for Source 6 (2-step auth):', error);
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