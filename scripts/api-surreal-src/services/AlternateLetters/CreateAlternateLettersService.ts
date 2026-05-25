import { surql, restPut, normalizeRecord } from '../../lib/surreal';

interface Request { name: string; file_html: string; id?: number; }

const CreateAlternateLettersService = async ({ name, file_html, id }: Request): Promise<any> => {
  const now = new Date().toISOString();
  const lastRows = await surql(`SELECT id FROM alternate_letters ORDER BY id DESC LIMIT 1`);
  const newId = id ?? ((normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1);
  await restPut('alternate_letters', newId, { name, file_html, created_at: now, updated_at: now });
  return { id: newId, name, file_html };
};

export default CreateAlternateLettersService;
