import { generateDisputeLetter } from './letterGenerator.js';

const letter = await generateDisputeLetter({
  template: `Dear Sir/Madam,

I am writing to dispute the following information on my credit report:

Name: {{first-name}} {{last-name}}
SSN: {{ssn}}

Please investigate and correct this information.

Thank you,
{{first-name}} {{last-name}}`,
  clientData: {
    firstName: "Deborah",
    lastName: "Council",
    ssn: "123-45-6789"
  },
  customPrompt: "Make the letter more formal and focus on the incorrect reporting date."
});

console.log(letter);
