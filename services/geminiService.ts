/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";

/**
 * Helper to strip the data URL prefix (e.g. "data:image/png;base64,")
 */
const getBase64Data = (dataUrl: string): string => {
  return dataUrl.split(',')[1];
};

/**
 * Applies makeup (lipstick) from a product image onto a selfie.
 */
export const generateTryOn = async (
  lipstickImage: string,
  selfieImage: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-image-preview';

    const parts = [
      {
        inlineData: {
          mimeType: 'image/png', // Assumption for base64 data
          data: getBase64Data(lipstickImage),
        },
      },
      {
        inlineData: {
          mimeType: 'image/png',
          data: getBase64Data(selfieImage),
        },
      },
      {
        text: `Reference image: First image (Lipstick Product/Swatch).
Target image: Second image (Person/Selfie).

Task: Apply ONLY lipstick to the lips of the person in the target image, using the exact color, texture, and finish from the reference image.

Strict rules: 
- Change ABSOLUTELY NOTHING ELSE: Keep face shape, eyes, eyebrows, skin texture, pores, hair, teeth, expression, lighting, background, and aspect ratio 100% identical to the original selfie. 
- Perfect seamless blending: No edges, bleeding, or artifacts—lips look naturally enhanced, photorealistic, high-resolution. 
- Match skin tone and natural contours exactly. 
- Output: Photorealistic portrait, same resolution as input. Do not add blush, eyeshadow, filters, or any other makeup.`,
      },
    ];

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    const candidates = response.candidates;
    if (candidates && candidates[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                 return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Try-on generation failed:", error);
    throw error;
  }
};