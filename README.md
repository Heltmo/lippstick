# Virtual Lipstick Try-On

Experience instant virtual makeup powered by Google's Gemini AI. Upload a lipstick swatch and a selfie to see the magic happen.

## Features

- 🎨 AI-powered lipstick try-on using Gemini image generation
- 📸 Upload any lipstick/swatch image as reference
- 🤳 Apply virtual lipstick to selfie images
- 💾 Download your enhanced photos
- 🔒 Secure server-side API key handling

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **AI**: Google Gemini API (gemini-2.0-flash-exp-image-generation)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A **paid** Google Cloud Project API key with Gemini access
  - Get your API key from: https://aistudio.google.com/apikey
  - Free tier keys will NOT work for image generation

### Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd lippstick
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

4. **Run with Vercel CLI** (recommended for testing serverless functions)
   ```bash
   npm install -g vercel
   vercel dev
   ```
   
   Or for frontend-only development:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/YOUR_REPO)

### Manual Deployment

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Set Environment Variable**
   
   In the Vercel dashboard:
   - Go to your project → Settings → Environment Variables
   - Add `GEMINI_API_KEY` with your API key
   - Redeploy for changes to take effect

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Your Google Gemini API key (paid tier required) |

## Project Structure

```
├── api/
│   └── generate.ts      # Vercel serverless function for Gemini API
├── components/
│   ├── ApiKeyDialog.tsx # Error dialog component
│   ├── Button.tsx       # Reusable button component
│   └── FileUploader.tsx # Image upload component
├── hooks/
│   └── useApiKey.ts     # API key state management
├── services/
│   └── geminiService.ts # Client-side API caller
├── App.tsx              # Main application component
├── index.html           # HTML entry point
├── vercel.json          # Vercel configuration
└── vite.config.ts       # Vite build configuration
```

## License

Apache-2.0
