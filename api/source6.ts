// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

// --- Target URLs ---
const BASE_URL = 'https://statusfalgar.se';
const LOGIN_PAGE_URL = `${BASE_URL}/loggain`;
const CSRF_API_URL = `${BASE_URL}/api/auth/csrf`;
const CREDENTIALS_API_URL = `${BASE_URL}/api/auth/callback/credentials`;
const DATA_URL = `${BASE_URL}/api/PriceList`;

// --- Credentials ---
const USERNAME = 'office@pimpit.ro';
const PASSWORD = '40785733102';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';


/**
 * Implements a robust, multi-step authentication process to fetch data from Source 6.
 * This process mimics a real browser login on a modern Next.js/NextAuth application.
 */
export default async function handler(req: Request): Promise<Response> {
  try {
    // --- STEP 1: Get the CSRF token and initial cookies ---
    // We need to fetch the CSRF token from a dedicated API endpoint.
    // This also provides us with the necessary CSRF cookie.
    const csrfResponse = await fetch(CSRF_API_URL, {
      headers: { 'User-Agent': USER_AGENT },
      cache: 'no-store',
    });

    if (!csrfResponse.ok) {
        throw new Error(`Nu s-a putut obține token-ul de securitate (CSRF). Status: ${csrfResponse.status}`);
    }

    const { csrfToken } = await csrfResponse.json();
    const csrfCookies = csrfResponse.headers.get('Set-Cookie');

    if (!csrfToken || !csrfCookies) {
        throw new Error("Token-ul de securitate (CSRF) sau cookie-urile inițiale nu au fost primite.");
    }
    
    // --- STEP 2: Perform the login via API callback ---
    // We POST the credentials along with the CSRF token to the credentials API.
    const form = new URLSearchParams();
    form.append('email', USERNAME);
    form.append('password', PASSWORD);
    form.append('csrfToken', csrfToken);
    form.append('json', 'true'); // Required by NextAuth for API responses

    const loginResponse = await fetch(CREDENTIALS_API_URL, {
        method: 'POST',
        headers: {
            'User-Agent': USER_AGENT,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': csrfCookies,
            'Referer': LOGIN_PAGE_URL,
        },
        body: form.toString(),
        cache: 'no-store',
    });

    if (!loginResponse.ok) {
        throw new Error(`Autentificarea la API a eșuat. Status: ${loginResponse.status}. Verificați credențialele.`);
    }

    // --- STEP 3: Extract the session cookie ---
    // A successful login returns the session token in the Set-Cookie header.
    const sessionCookie = loginResponse.headers.get('Set-Cookie');
    if (!sessionCookie) {
        throw new Error("Autentificare reușită, dar nu s-a primit cookie-ul de sesiune.");
    }

    // --- STEP 4: Fetch the actual data using the session cookie ---
    const dataResponse = await fetch(DATA_URL, {
        headers: {
            'User-Agent': USER_AGENT,
            'Cookie': sessionCookie, // Use the final session cookie
            'Referer': BASE_URL,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        throw new Error(`Autorizare eșuată la accesarea datelor. Status: ${dataResponse.status}. Cookie-ul de sesiune ar putea fi invalid.`);
    }

    // --- STEP 5: Stream the data back to the client ---
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', dataResponse.headers.get('Content-Type') || 'text/csv; charset=utf-8');
    responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new Response(dataResponse.body, {
      headers: responseHeaders,
      status: 200,
    });

  } catch (error) {
    console.error('Eroare în proxy-ul pentru Sursa 6:', error);
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
