import { surql, restPut, sEsc, normalizeRecord } from '../../lib/surreal';

interface Request { key: string; owner?: string; }

const AddGemini = async ({ key, owner }: Request): Promise<any> => {
  const existing = await surql(`SELECT id FROM gemini_keys WHERE key = "${sEsc(key)}" LIMIT 1`);
  if (existing.length) throw new Error('Gemini key already exists');
  const now = new Date().toISOString();
  const lastRows = await surql(`SELECT id FROM gemini_keys ORDER BY id DESC LIMIT 1`);
  const newId = (normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1;
  await restPut('gemini_keys', newId, {
    key, owner: owner ?? null, is_active: true,
    last_used_at: null, cooldown_until: null,
    created_at: now, updated_at: now,
  });
  return { id: newId, key, owner, isActive: true };
};

export default AddGemini;
