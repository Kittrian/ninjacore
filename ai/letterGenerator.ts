import 'dotenv/config';
import { replaceTags } from './replaceTags';
import { generateWithGroq } from './groq';

interface GenerateLetterOptions {
  template?: string;
  clientData: any;
  customPrompt?: string;
}

export async function generateDisputeLetter(options: GenerateLetterOptions): Promise<string> {
  const { template = '', clientData, customPrompt } = options;

  const filledTemplate = replaceTags(template, clientData);

  const prompt = `
You are an expert credit repair specialist.

Here is the user's draft with real data filled in:
${filledTemplate}

${customPrompt ? `Additional instructions: ${customPrompt}` : 'Make this into a strong, professional, and legally sound dispute letter.'}
`;

  let letter = '';

  for await (const chunk of await generateWithGroq(prompt)) {
    letter += chunk;
  }

  return letter;
}
