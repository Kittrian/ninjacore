import { surql, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const UpdateAlternateLettersService = async ({ templateData, alternateId }: any): Promise<any> => {
  const rows = await surql(`SELECT * FROM alternate_letters:${Number(alternateId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_ALTERNATE_LETTERS_FOUND', 404);
  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (templateData.name !== undefined) updates.name = templateData.name;
  if (templateData.file_html !== undefined) updates.file_html = templateData.file_html;
  await restPatch('alternate_letters', Number(alternateId), updates);
  const updated = await surql(`SELECT * FROM alternate_letters:${Number(alternateId)} LIMIT 1`);
  const r = normalizeRecord(updated[0] ?? rows[0]);
  return { id: r.id, name: r.name, file_html: r.file_html };
};

export default UpdateAlternateLettersService;
