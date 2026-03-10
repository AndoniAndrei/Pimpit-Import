export default function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, status: "error", message: "Method Not Allowed" });
  }

  return res.status(200).json({ 
    ok: true, 
    status: "success", 
    message: "API is healthy and running on Vercel Serverless Functions" 
  });
}
