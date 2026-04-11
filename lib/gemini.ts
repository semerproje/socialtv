import { GoogleGenerativeAI } from '@google/generative-ai';

const globalForGemini = globalThis as unknown as {
  gemini: GoogleGenerativeAI | undefined;
};

export const gemini =
  globalForGemini.gemini ??
  new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

if (process.env.NODE_ENV !== 'production') {
  globalForGemini.gemini = gemini;
}

// Primary: Gemini 2.5 Pro — maximum intelligence for AI Director
export const GEMINI_MODEL = 'gemini-2.5-pro';

// Flash model for fast, lightweight operations (moderation, short analysis)
export const GEMINI_FLASH_MODEL = 'gemini-2.0-flash';

export default gemini;
