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

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  try {
    // --- Step 1: Visit the login page to establish an initial session cookie ---
    // This step is often necessary to get a session cookie that the server expects
    // to see in the subsequent POST request.
    const initialPageResponse = await fetch(loginUrl, {
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!initialPageResponse.ok) {
        throw new Error(`Failed to load login page (status: ${initialPageResponse.status})`);
    }

    const initialCookie = initialPageResponse.headers.get('set-cookie');

    if (!initialCookie) {
       return new Response(
        JSON.stringify({
          error: "Autentificare eșuată pentru Sursa 6.",
          details: "Nu s-a putut stabili sesiunea inițială pe pagina de login."
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // --- Step 2: Send the login POST request with credentials and the initial cookie ---
    const loginBody = new URLSearchParams();
    loginBody.append('Username', username);
    loginBody.append('Password', password);
    // No anti-forgery token is sent in this simplified, direct approach.

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        'Cookie': initialCookie.split(';')[0], // Use the session cookie from step 1
      },
      body: loginBody.toString(),
      redirect: 'manual', // We need to capture the auth cookie from the redirect
    });

    // --- Step 3: Check for successful login and extract the auth cookie ---
    const setCookieHeader = loginResponse.headers.get('set-cookie');

    // A successful login should result in a redirect (status 302) and a new, more powerful auth cookie.
    if (loginResponse.status !== 302 || !setCookieHeader) {
      console.error(`Source 6 Login Failed (Status: ${loginResponse.status})`);
       return new Response(
        JSON.stringify({
          error: "Autentificare eșuată pentru Sursa 6.",
          details: "Nu s-a putut obține cookie-ul de sesiune. Verificați credențialele sau este posibil ca procesul de login al furnizorului să se fi schimbat."
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const authCookie = setCookieHeader.split(';')[0];
    
    // --- Step 4: Fetch the data using the final auth cookie ---
    const dataResponse = await fetch(dataUrl, {
        headers: {
            'Cookie': authCookie, // Use the new authentication cookie
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
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // --- Step 5: Stream the data back to the client ---
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
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
