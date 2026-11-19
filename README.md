# BriefBot — Simple AI Assistant & Summarizer

A minimalist, easy-to-use React AI chatbot designed for quick Q&A, note summarization, and customer support reply drafting using the **Google Gemini REST API**.

## Features

- **3 Clear Task Modes**: Switch effortlessly between **Quick Chat**, **Summarize Text**, and **Support Reply**.
- **One-Click Examples & Text/File Attachment**: Test immediately with sample prompts or attach `.txt` / `.md` notes for summarization and reply drafting.
- **Resilient Streaming & Clean Output**: Streams responses from `gemini-3-flash-preview` with automatic failover to `gemini-3.1-flash-lite` on `503`/`429` spikes, and strips raw markdown asterisks (`*`) for clean reading.
- **Zero-Exposure Key Security**: Reads `.env.local` for local development (`npm run dev`). No API key is ever bundled into the public GitHub Pages frontend; static deployments run out of the box using a built-in client-side demo engine.

## Local Setup

```bash
npm install
cp .env.example .env.local
# Add VITE_GEMINI_API_KEY=... inside .env.local
npm run dev
```

## GitHub Pages Deployment

Configured with `base: './'` in `vite.config.ts` and `.github/workflows/deploy.yml`. Push to `main` and set **Settings → Pages → Source** to **GitHub Actions**.
