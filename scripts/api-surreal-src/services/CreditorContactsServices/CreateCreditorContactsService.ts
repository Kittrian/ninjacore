import { surql, restPut, normalizeRecord } from '../../lib/surreal';

interface Request { name: string; value: string; id?: number; }

const CreateCreditorContactsService = async ({ name, value, id }: Request): Promise<any> => {
  const now = new Date().toISOString();
  const lastRows = await surql(`SELECT id FROM creditor_contacts ORDER BY id DESC LIMIT 1`);
  const newId = id ?? ((normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1);
  await restPut('creditor_contacts', newId, { name, value, created_at: now, updated_at: now });
  return { id: newId, name, value };
};

export default CreateCreditorContactsService;
