export const maxDuration = 60; // Extend timeout to 60 seconds (requires Pro) or 30 for Hobby

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY environment variable not set' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000); // 55s to stay under limit

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Check if response is actually JSON before parsing
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response from Anthropic:', text.slice(0, 500));
      return res.status(502).json({ error: 'Unexpected response from Anthropic API', detail: text.slice(0, 200) });
    }

    const data = await response.json();
    return res.status(response.status).json(data);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Request timed out');
      return res.status(504).json({ error: 'Request timed out — try again' });
    }
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
