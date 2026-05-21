function formatAddressForTag(value: string = ''): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const cleaned = raw
    .replace(/\r?\n/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!cleaned) return '';

  if (cleaned.includes('|')) {
    const [streetPart, localityPart] = cleaned.split('|');
    const street = String(streetPart || '').trim().replace(/,$/, '');
    const locality = String(localityPart || '').trim().replace(/\s+/g, ' ');
    const full = locality.match(/^(.*?)[,\s]+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (full) {
      const city = String(full[1] || '').trim().replace(/,$/, '');
      const state = String(full[2] || '').trim().toUpperCase();
      const zip = String(full[3] || '').trim();
      return [street, `${city} ${state} ${zip}`.replace(/\s+/g, ' ').trim()].filter(Boolean).join('\n');
    }
    return [street, locality].filter(Boolean).join('\n');
  }

  const full = cleaned.match(/^(.*?)(?:,\s*|\s+)([A-Za-z][A-Za-z .'-]+?)(?:,\s*|\s+)([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
  if (full) {
    const street = String(full[1] || '').trim();
    const city = String(full[2] || '').trim();
    const state = String(full[3] || '').trim().toUpperCase();
    const zip = String(full[4] || '').trim();
    return [street, `${city} ${state} ${zip}`.replace(/\s+/g, ' ').trim()].filter(Boolean).join('\n');
  }

  return cleaned;
}

export function replaceTags(template: string = '', data: any = {}): string {
  let result = template || '';

  const simpleTags: Record<string, string> = {
    'first-name': data.firstName || '',
    'last-name': data.lastName || '',
    'address': formatAddressForTag(data.address || ''),
    'dob': data.dob || '',
    'ssn': data.ssn || '',
  };

  for (const [tag, value] of Object.entries(simpleTags)) {
    const regex = new RegExp(`{{${tag}}}`, 'g');
    result = result.replace(regex, value);
  }

  if (data.documents) {
    result = result.replace(/{{ID Doc}}/g, data.documents.id || '');
    result = result.replace(/{{SSN Doc}}/g, data.documents.ssn || '');
    result = result.replace(/{{POA1}}/g, data.documents.poa1 || '');
    result = result.replace(/{{POA2}}/g, data.documents.poa2 || '');
    result = result.replace(/{{POA3}}/g, data.documents.poa3 || '');
  }

  return result;
}
