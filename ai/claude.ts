import 'dotenv/config';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function refineWithClaude(draft: string, customPrompt?: string) {
  const result = await streamText({
    model: anthropic('claude-3-haiku-20240307'),   // ← Changed to a model that usually works
    system: "You are an expert at writing strong, professional credit dispute letters.",
    prompt: `
Current draft:
${draft}

${customPrompt ? `Additional instructions: ${customPrompt}` : ''}
    `,
  });

  return result.textStream;
}
