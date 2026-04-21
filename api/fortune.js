const REQUIRED_FIELDS = ['summary', 'detail', 'friend', 'family', 'work', 'quote'];

function sanitizeFortune(payload) {
  const result = {};
  for (const field of REQUIRED_FIELDS) {
    result[field] = typeof payload?.[field] === 'string' ? payload[field].trim() : '';
  }
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini API key is not configured' });
  }

  const prompt = req.body?.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.95, maxOutputTokens: 1000 }
        })
      }
    );

    if (!response.ok) {
      const detail = await response.text();
      return res.status(502).json({ error: 'Gemini request failed', detail });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const fortune = sanitizeFortune(JSON.parse(clean));

    if (REQUIRED_FIELDS.some((field) => !fortune[field])) {
      return res.status(502).json({ error: 'Gemini response was incomplete' });
    }

    return res.status(200).json(fortune);
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to generate fortune',
      detail: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
