import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  throw new Error("OPENAI_API_KEY missing");
}

export const openai = new OpenAI({ apiKey, timeout: 20_000 }); // 20s — within Vercel 30s function timeout
