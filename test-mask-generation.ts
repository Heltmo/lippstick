/**
 * Test script to evaluate Gemini's lip mask generation quality
 * Run with: npx tsx test-mask-generation.ts
 */
import 'dotenv/config';
import { GoogleGenAI, Modality } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';

async function testMaskGeneration(selfiePath: string, outputDir: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not set');
  }

  const ai = new GoogleGenAI({ apiKey });

  // Read selfie image
  const selfieBuffer = fs.readFileSync(selfiePath);
  const selfieBase64 = selfieBuffer.toString('base64');

  console.log(`Testing mask generation for: ${selfiePath}`);

  // Test 1: Strict binary mask (original prompt)
  console.log('\n=== Test 1: Strict Binary Mask ===');
  const strictPrompt = `Generate a STRICT binary mask of the LIPS for the provided selfie.

OUTPUT REQUIREMENT:
- Return a single MASK IMAGE (PNG).
- White pixels (#FFFFFF) = outer lips ONLY (vermilion area).
- Black pixels (#000000) = everything else.
- Teeth and inner mouth MUST be black.
- No blur, no gray, no gradients. Hard binary mask.
- Do not change identity. Do not retouch. Do not beautify.

If lips are not visible or uncertain, return a FULL BLACK mask.`;

  const strictResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: selfieBase64,
          },
        },
        { text: strictPrompt },
      ],
    },
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });

  let strictMask: string | null = null;
  const strictParts = strictResponse.candidates?.[0]?.content?.parts || [];
  for (const p of strictParts) {
    if (p.inlineData?.data) {
      strictMask = p.inlineData.data;
      break;
    }
  }

  if (strictMask) {
    const outPath = path.join(outputDir, 'mask-strict.png');
    fs.writeFileSync(outPath, Buffer.from(strictMask, 'base64'));
    console.log(`✓ Strict mask saved to: ${outPath}`);
    await analyzeMask(strictMask, 'Strict');
  } else {
    console.log('✗ Strict mask generation failed - no image returned');
  }

  // Test 2: Grayscale mask (more flexible)
  console.log('\n=== Test 2: Grayscale Mask ===');
  const grayPrompt = `Generate a GRAYSCALE mask of the LIPS for the provided selfie.

OUTPUT:
- Return a MASK IMAGE (PNG).
- White (255) = definitely lips (outer vermilion).
- Black (0) = definitely NOT lips (skin, teeth, background).
- Gray values (1-254) = edge/boundary areas (use for smooth antialiasing).
- Inner mouth and teeth should be BLACK.
- Do not modify the person's appearance. Pure segmentation only.`;

  const grayResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: selfieBase64,
          },
        },
        { text: grayPrompt },
      ],
    },
    config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
  });

  let grayMask: string | null = null;
  const grayParts = grayResponse.candidates?.[0]?.content?.parts || [];
  for (const p of grayParts) {
    if (p.inlineData?.data) {
      grayMask = p.inlineData.data;
      break;
    }
  }

  if (grayMask) {
    const outPath = path.join(outputDir, 'mask-grayscale.png');
    fs.writeFileSync(outPath, Buffer.from(grayMask, 'base64'));
    console.log(`✓ Grayscale mask saved to: ${outPath}`);
    await analyzeMask(grayMask, 'Grayscale');
  } else {
    console.log('✗ Grayscale mask generation failed - no image returned');
  }

  // Test 3: Simplified prompt
  console.log('\n=== Test 3: Simplified Prompt ===');
  const simplePrompt = `Create a mask showing only the lips.
White = lips. Black = everything else.
Return only the mask image.`;

  const simpleResponse = await ai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/png',
            data: selfieBase64,
          },
        },
        { text: simplePrompt },
      ],
    },
    config: { responseModalities: [Modality.IMAGE] },
  });

  let simpleMask: string | null = null;
  const simpleParts = simpleResponse.candidates?.[0]?.content?.parts || [];
  for (const p of simpleParts) {
    if (p.inlineData?.data) {
      simpleMask = p.inlineData.data;
      break;
    }
  }

  if (simpleMask) {
    const outPath = path.join(outputDir, 'mask-simple.png');
    fs.writeFileSync(outPath, Buffer.from(simpleMask, 'base64'));
    console.log(`✓ Simple mask saved to: ${outPath}`);
    await analyzeMask(simpleMask, 'Simple');
  } else {
    console.log('✗ Simple mask generation failed - no image returned');
  }
}

async function analyzeMask(maskBase64: string, label: string) {
  // Lazy import sharp for analysis
  const sharp = (await import('sharp')).default;

  const maskBuf = Buffer.from(maskBase64, 'base64');
  const maskImage = sharp(maskBuf);
  const metadata = await maskImage.metadata();
  const stats = await maskImage.stats();

  console.log(`  Size: ${metadata.width}x${metadata.height}`);
  console.log(`  Channels: ${stats.channels.length}`);

  // Analyze luminance distribution
  const lum = stats.channels[0]; // First channel (R in RGB, or L in grayscale)
  console.log(`  Luminance: min=${lum.min}, max=${lum.max}, mean=${lum.mean.toFixed(2)}`);

  // Check if it's truly binary
  const isBinary = lum.min < 10 && lum.max > 245;
  console.log(`  Binary? ${isBinary ? 'Yes' : 'No (has grayscale)'}`);

  // Estimate coverage (what % is white/lips)
  const coverage = (lum.mean / 255) * 100;
  console.log(`  Estimated lip coverage: ${coverage.toFixed(1)}%`);

  // Quality checks
  const issues: string[] = [];
  if (lum.mean < 5) issues.push('Mask is mostly black (likely failed)');
  if (lum.mean > 250) issues.push('Mask is mostly white (likely wrong)');
  if (coverage < 1) issues.push('Coverage too low (<1%)');
  if (coverage > 30) issues.push('Coverage too high (>30%, might include non-lips)');

  if (issues.length > 0) {
    console.log(`  ⚠ Issues: ${issues.join(', ')}`);
  } else {
    console.log(`  ✓ Looks reasonable`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`Usage: npx tsx test-mask-generation.ts <selfie.png> [output-dir]

This script tests 3 different prompting strategies for lip mask generation:
1. Strict binary mask (original approach)
2. Grayscale mask (antialiased edges)
3. Simplified prompt (minimal instructions)

It will save the generated masks and analyze their quality.
`);
    process.exit(1);
  }

  const selfiePath = args[0];
  const outputDir = args[1] || './mask-tests';

  if (!fs.existsSync(selfiePath)) {
    console.error(`Error: File not found: ${selfiePath}`);
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await testMaskGeneration(selfiePath, outputDir);

  console.log(`\n✓ All tests complete. Masks saved to: ${outputDir}`);
  console.log('\nNext steps:');
  console.log('1. Visually inspect the generated masks');
  console.log('2. Check if lips are accurately outlined');
  console.log('3. Verify teeth/inner mouth are black');
  console.log('4. Test with different selfie types (angles, lighting, expressions)');
}

main().catch(console.error);
