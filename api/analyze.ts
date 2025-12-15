// api/analyze.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { productBase64 } = req.body ?? {};
  if (!productBase64) {
    return res.status(400).json({ error: "Missing productBase64" });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const schema = {
    name: "LipColor",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
        finish: {
          type: "string",
          enum: ["matte", "satin", "cream", "gloss", "shimmer", "metallic", "sheer"],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: ["hex", "finish", "confidence"],
    },
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Extract the dominant lipstick color from the product image. " +
                "Return hex + finish. Ignore background/packaging.",
            },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${productBase64}` },
            },
          ],
        },
      ],
      response_format: { type: "json_schema", json_schema: schema },
      max_tokens: 200,
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    return res.status(500).json({ error: "OpenAI request failed", detail });
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  return res.status(200).json(JSON.parse(content));
}
