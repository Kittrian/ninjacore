import { surql, restPut, sEsc, normalizeRecord } from '../../lib/surreal';

interface Request { key: string; value: string; id?: number; }

const CreateParaghraphService = async ({ key, value, id }: Request): Promise<any> => {
  const existing = await surql(`SELECT id FROM paragraphs WHERE key_name = "${sEsc(key)}" LIMIT 1`);
  if (existing.length) throw new Error('DUPLICATE KEY PARAGHRAPH');

  const now = new Date().toISOString();
  const lastRows = await surql(`SELECT id FROM paragraphs ORDER BY id DESC LIMIT 1`);
  const newId = id ?? ((normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1);

  await restPut('paragraphs', newId, { key_name: key, value, created_at: now, updated_at: now });
  return { id: newId, key, value };
};

export default CreateParaghraphService;
