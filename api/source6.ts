// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

// Helper function to extract the value of the __RequestVerificationToken from HTML.
const getVerificationToken = (html: string): string | null => {
  // Use a more robust regex that is not sensitive to attribute order or the exact closing tag syntax.
  const match = html.match(/<input[^>]+name="__RequestVerificationToken"[^>]+value="([^"]+)"/);
  return match ? match[1] : null;
};


export default async function handler(req: Request): Promise<Response> {
  const loginUrl = 'https://statusfalgar.se/loggain';
  const dataUrl = 'https://statusfalgar.se/api/PriceList';
  
  const username = "office@pimpit.ro";
  const password = "40785733102";

  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  try {
    // --- Step 1: Visit the login page to get the initial cookie and the anti-forgery token ---
    const initialPageResponse = await fetch(loginUrl, {
      headers: {
        'User-Agent': userAgent,
      },
    });

    if (!initialPageResponse.ok) {
        throw new Error(`Failed to load login page (status: ${initialPageResponse.status})`);
    }

    const initialCookie = initialPageResponse.headers.get('set-cookie');
    const loginPageHtml = await initialPageResponse.text();
    const verificationToken = getVerificationToken(loginPageHtml);
    
    if (!initialCookie || !verificationToken) {
       return new Response(
        JSON.stringify({
          error: "Autentificare eșuată pentru Sursa 6.",
          details: "Nu s-a putut obține token-ul de securitate de pe pagina de login. Procesul de login s-a schimbat."
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // --- Step 2: Send the login POST request with the token and initial cookie ---
    const loginBody = new URLSearchParams();
    loginBody.append('Username', username);
    loginBody.append('Password', password);
    loginBody.append('__RequestVerificationToken', verificationToken);

    const loginResponse = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        'Cookie': initialCookie.split(';')[0], // Use only the relevant part of the cookie
      },
      body: loginBody.toString(),
      redirect: 'manual', // We need to capture the auth cookie from the redirect
    });

    // --- Step 3: Check for successful login and extract the auth cookie ---
    const setCookieHeader = loginResponse.headers.get('set-cookie');

    // A successful login should result in a redirect (status 302) and a new cookie
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
    console.error('Error in API proxy for Source 6 (3-step auth):', error);
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