# Lip Mask Generation Testing

This guide helps you test whether Gemini 2.0 Flash can reliably generate accurate lip masks for the surface-only renderer upgrade.

## Why This Matters

The proposed upgrade uses Gemini to generate a binary mask of lips, then applies color deterministically on the server. This approach **only works if Gemini can produce accurate masks**.

## Quick Test

1. **Find a test selfie** (or use your own):
   - Clear face photo
   - Visible lips
   - Good lighting
   - Save as PNG in this directory

2. **Run the test**:
   ```bash
   npx tsx test-mask-generation.ts your-selfie.png
   ```

3. **Check the results** in `./mask-tests/`:
   - `mask-strict.png` - Binary mask (white=lips, black=everything else)
   - `mask-grayscale.png` - Antialiased mask with soft edges
   - `mask-simple.png` - Minimal prompt approach

## What to Look For

### ✅ Good Mask:
- Lips are cleanly outlined in white
- Teeth and inner mouth are black
- Edges follow vermilion border accurately
- No bleeding into surrounding skin
- Coverage is 2-10% of image (reasonable for lips)

### ❌ Bad Mask:
- Mask is completely black (generation failed)
- Mask is mostly white (wrong interpretation)
- Teeth are white (will color them - disaster!)
- Bleeds into cheeks/chin
- Coverage >30% (including non-lip areas)

## Test Multiple Cases

Try different selfie types:
- **Profile view** (side angle)
- **Smile with teeth** (critical - teeth must be black!)
- **Closed lips** (neutral expression)
- **Dark lighting** (low contrast)
- **Lipstick already on** (can it detect existing makeup?)
- **Different skin tones** (test fairness/accuracy)

## Example Output

```
Testing mask generation for: selfie.png

=== Test 1: Strict Binary Mask ===
✓ Strict mask saved to: ./mask-tests/mask-strict.png
  Size: 1024x1024
  Channels: 3
  Luminance: min=0, max=255, mean=12.45
  Binary? Yes
  Estimated lip coverage: 4.9%
  ✓ Looks reasonable

=== Test 2: Grayscale Mask ===
✓ Grayscale mask saved to: ./mask-tests/mask-grayscale.png
  ...

✓ All tests complete. Masks saved to: ./mask-tests
```

## Interpreting Results

**Coverage percentage**:
- 2-6%: Typical for lips-only (good)
- 10-15%: Might include some surrounding area (check visually)
- <1%: Too restrictive, might miss parts of lips
- >30%: Way too much, likely including face/teeth

**Binary vs Grayscale**:
- Binary: Harder edges, might be aliased
- Grayscale: Smoother blending, more natural

## Next Steps

Based on results:

### If masks look good (>80% success rate):
✅ Proceed with the surface-only renderer upgrade
- The quality improvement will be massive
- Fallback to Gemini edit is still available if mask fails

### If masks are inconsistent (50-80%):
⚠️ Implement with robust validation:
- Check mask coverage before using
- Auto-fallback to Gemini edit on bad masks
- A/B test to compare quality

### If masks fail (<50%):
❌ Stick with current Gemini edit approach for now
- Wait for better mask generation models
- Consider using OpenCV/MediaPipe on server instead
- Or try GPT-4 Vision with segmentation prompts

## Advanced Testing

To test the full pipeline (mask + surface renderer):

```bash
# Coming soon: test-full-pipeline.ts
npx tsx test-full-pipeline.ts selfie.png lipstick.png output.png
```

This will:
1. Extract color from lipstick
2. Generate mask from selfie
3. Apply surface-only renderer
4. Save comparison (original vs result)

## Technical Notes

**Gemini 2.0 Flash Limitations**:
- Not specifically trained for segmentation
- May interpret "mask" as "edit + show mask overlay"
- Binary output might have compression artifacts
- Success rate varies by face angle/lighting

**Why not use FaceMesh/MediaPipe?**:
- Adds significant complexity (ML models on server)
- Larger dependencies (TensorFlow.js ~30MB)
- Longer cold starts on Vercel
- Gemini mask is simpler if it works

---

**Questions? Issues?**
If mask generation consistently fails, report:
- Selfie type that failed
- Which prompt worked best
- Coverage percentages
- Visual inspection notes
