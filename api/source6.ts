// This is a server-side file and will not be sent to the browser.
// This configures the function to run on Vercel's Edge Runtime.
export const config = {
  runtime: 'edge',
};

/**
 * Fetches data from Source 6 by directly using a hardcoded, valid session cookie.
 * This approach bypasses the complex, multi-step authentication process that was failing,
 * providing a stable and direct connection to the data endpoint.
 */
export default async function handler(req: Request): Promise<Response> {
  const dataUrl = 'https://statusfalgar.se/api/PriceList';
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

  // This long-lived session cookie was extracted from a successful browser login session.
  // This is the key to bypassing the programmatic login flow.
  const sessionCookie = `session=e59ab029c29c544d0f8c5ea70816948c; _gtmeec=e30%3D; _fbp=fb.1.1762440630195.1035609366; _ga=GA1.1.1695258228.1762440630; FPID=FPID2.2.j6zBRBzIA39pWHBifypoPNLs7%2F8r5Gg%2BD%2BFBkUpPXF0%3D.1762440630; FPLC=rEROYVhYrxBsgRMSdWxkthlMQnJfk4nXnztkXNDI1M96Qi5v6P%2B7bpO2bfwkdMu5jZqZ8zP5kk9FRn zSCejVg6jbgpL52C6OQNTwjr3YapRkpjGHEU5LYo1txVcMA%3D%3D.1762440630; _gcl_au=1.1.2027534866.1762440630; _ga_2N4C9E428V=GS2.1.s1762950358o4$g1$t1762951345$j60$l0$h979324443; .AspNet.ApplicationCookie=6cHek8rs-ZmJYQfcOKlzRFGfBq5hxlsjNCDnAPE0fBwYX4ANG75BLzHBjsCBcL4X6k9jO_mv8WFOjlcirq1PmbRLRLZ6nRYowarJfYsu-cRg9BavCumiCnDZaahV8A7gxao4NTydFLEeJvSjarW03DagzmO2q9I-4WQREo89w26Fiwf0EtqHDpjkhs9FeHimWTzXgWtmuZtzGTjCQjdopPgxxezSSdkYOSEYBz-eNeyrrCAOQ_e1kwvJaD-ZFpgn8hiLvOmkxHgSZ2l9EHP4LJU1-kAAfO0Tb6h59rLHoQp9vwiEdT-0t7kicJg0EOYL75-KI9ZWmczTKXPWV5y8CbtK2S3SU0KhwhU`;

  try {
    const dataResponse = await fetch(dataUrl, {
        headers: {
            'User-Agent': userAgent,
            'Cookie': sessionCookie,
        },
        cache: 'no-store',
    });

    if (!dataResponse.ok) {
        // If the cookie expires, this is where it will fail.
        const errorText = await dataResponse.text();
        let details = `Eroare la descărcarea datelor (status: ${dataResponse.status}).`;
        if (dataResponse.status === 401 || dataResponse.status === 403) {
            details = "Autorizare eșuată. Cookie-ul de sesiune a expirat sau este invalid.";
        } else {
            details += ` Răspuns: ${errorText.substring(0, 200)}`;
        }
        throw new Error(details);
    }
    
    // Stream the data back to the client
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
