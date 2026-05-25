import { surql, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const UpdateParaghraphService = async ({ templateData, paraghraphId }: any): Promise<any> => {
  const rows = await surql(`SELECT * FROM paragraphs:${Number(paraghraphId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_PARAGHRAPH_FOUND', 404);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (templateData.key !== undefined) updates.key_name = templateData.key;
  if (templateData.value !== undefined) updates.value = templateData.value;

  await restPatch('paragraphs', Number(paraghraphId), updates);
  const updated = await surql(`SELECT * FROM paragraphs:${Number(paraghraphId)} LIMIT 1`);
  const r = normalizeRecord(updated[0] ?? rows[0]);
  return { id: r.id, key: r.key_name, value: r.value };
};

export default UpdateParaghraphService;
