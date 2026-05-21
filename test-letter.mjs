import { generateDisputeLetter } from './ai/letterGenerator.js';

const letter = await generateDisputeLetter({
  clientData: {
    firstName: "Deborah",
    lastName: "Council",
    email: "deborahcouncil64@gmail.com"
  },
  customPrompt: "Make the letter more formal and focus on the incorrect reporting date.",
  useClaudeRefinement: true
});

console.log(letter);
