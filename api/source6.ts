// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

/**
 * Handles authentication for Source 6, which uses a modern Next.js (NextAuth) flow.
 * This version correctly simulates the multi-step browser login process, including the Referer header.
 */
export default async function handler(req: Request): Promise<Response> {
  const loginPageUrl = 'https://statusfalgar.se/loggain';
  const csrfApiUrl = 'https://statusfalgar.se/api/auth/csrf';
  const loginApiUrl = 'https://statusfalgar.se/api/auth/callback/credentials';
  const dataUrl = 'https://statusfalgar.se/api/PriceList';
  
  const username = "office@pimpit.ro";
  const password = "40785733102";
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36';

  try {
    // --- Step 1: Visit the login page to get the initial CSRF cookie ---
    const pageResponse = await fetch(loginPageUrl, {
      headers: { 'User-Agent': userAgent },
    });

    if (!pageResponse.ok) {
      throw new Error(`Eroare la accesarea paginii de login (status: ${pageResponse.status})`);
    }
    
    // In Vercel Edge, getSetCookie() is available.
    const initialCookiesArray = (pageResponse.headers as any).getSetCookie();
    if (!initialCookiesArray || initialCookiesArray.length === 0) {
        throw new Error("Nu s-a putut obține cookie-ul inițial de pe pagina de login.");
    }

    const initialCookies = initialCookiesArray.map((c: string) => c.split(';')[0]).join('; ');

    // --- Step 2: Get the CSRF token value from the dedicated API, using the initial cookie ---
    const csrfResponse = await fetch(csrfApiUrl, {
      headers: { 
          'User-Agent': userAgent,
          'Cookie': initialCookies,
      },
    });

    if (!csrfResponse.ok) {
       throw new Error(`Eroare la obținerea token-ului CSRF (status: ${csrfResponse.status})`);
    }
    
    const csrfJson = await csrfResponse.json();
    const csrfToken = csrfJson.csrfToken;
    
    if (!csrfToken) {
      throw new Error("Răspunsul de la API-ul CSRF este invalid. Nu s-a putut obține token-ul.");
    }
    
    // --- Step 3: Send the login request to the API with credentials and CSRF info ---
    const loginPayload = new URLSearchParams({
        username: username,
        password: password,
        csrfToken: csrfToken,
        json: 'true',
    });

    const loginResponse = await fetch(loginApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': userAgent,
            'Cookie': initialCookies, // Send the same cookies we received from the login page
            'Referer': loginPageUrl, // This header is crucial for passing security checks
        },
        body: loginPayload.toString(),
    });

    if (!loginResponse.ok) {
       const errorBodyText = await loginResponse.text();
       throw new Error(`API-ul de login a eșuat (status: ${loginResponse.status}). Răspuns: ${errorBodyText}`);
    }

    // --- Step 4: Extract the final session cookie(s) ---
    const finalCookiesArray = (loginResponse.headers as any).getSetCookie();
    if (!finalCookiesArray || finalCookiesArray.length === 0) {
        throw new Error('Autentificare reușită, dar nu s-a primit niciun cookie de sesiune.');
    }
    
    // Combine all cookies (initial CSRF + new session cookie) for the final request
    const combinedCookies = [...initialCookiesArray, ...finalCookiesArray]
      .map((c: string) => c.split(';')[0])
      // Create a unique set of cookies, preferring the last seen value for a given name.
      .reduce((acc: { [key: string]: string }, cookie: string) => {
          const [key, value] = cookie.split('=');
          if (key) acc[key] = value;
          return acc;
       }, {});
    
    const finalCookieString = Object.entries(combinedCookies).map(([key, value]) => `${key}=${value}`).join('; ');
    
    // --- Step 5: Fetch the actual data using the session cookie ---
    const dataResponse = await fetch(dataUrl, {
        headers: {
            'User-Agent': userAgent,
            'Cookie': finalCookieString,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        throw new Error(`Eroare la descărcarea datelor (status: ${dataResponse.status})`);
    }
    
    // --- Step 6: Stream the data back to the client ---
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', dataResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(dataResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Error in API proxy for Source 6:', error);
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