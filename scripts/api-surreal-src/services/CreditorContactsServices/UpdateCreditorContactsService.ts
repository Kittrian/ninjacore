import { surql, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const UpdateCreditorContactsService = async ({ templateData, creditorId }: any): Promise<any> => {
  const rows = await surql(`SELECT * FROM creditor_contacts:${Number(creditorId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CREDITOR_CONTACTS_FOUND', 404);
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (templateData.name !== undefined) updates.name = templateData.name;
  if (templateData.value !== undefined) updates.value = templateData.value;
  await restPatch('creditor_contacts', Number(creditorId), updates);
  const updated = await surql(`SELECT * FROM creditor_contacts:${Number(creditorId)} LIMIT 1`);
  const r = normalizeRecord(updated[0] ?? rows[0]);
  return { id: r.id, name: r.name, value: r.value };
};

export default UpdateCreditorContactsService;
