import 'dotenv/config';
import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const groq = createOpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
});

export async function generateWithGroq(prompt: string) {
  const result = await streamText({
    model: groq('llama-3.3-70b-versatile'),   // ← Updated working model
    system: "You are a professional credit repair specialist. Write clear and factual dispute letters.",
    prompt,
  });

  return result.textStream;
}
