import { surql, restPatch, normalizeRecord } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request {
  templateData: any;
  templateId: string;
}

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fb; }
}

const UpdateTemplateService = async ({ templateData, templateId }: Request): Promise<any> => {
  const rows = await surql(`SELECT * FROM templates:${Number(templateId)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_TEMPLATE_FOUND', 404);

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (templateData.name !== undefined) updates.name = templateData.name;
  if (templateData.file_name !== undefined) updates.file_name = templateData.file_name;
  if (templateData.file_html !== undefined) updates.file_html = templateData.file_html;
  if (templateData.tu !== undefined) updates.tu_json = JSON.stringify(templateData.tu);
  if (templateData.ex !== undefined) updates.ex_json = JSON.stringify(templateData.ex);
  if (templateData.eq !== undefined) updates.eq_json = JSON.stringify(templateData.eq);
  if (templateData.paraghraphs !== undefined) updates.paragraphs_json = JSON.stringify(templateData.paraghraphs);

  await restPatch('templates', Number(templateId), updates);
  const updated = await surql(`SELECT * FROM templates:${Number(templateId)} LIMIT 1`);
  const r = normalizeRecord(updated[0] ?? rows[0]);
  return {
    id: r.id, name: r.name, file_name: r.file_name, file_html: r.file_html,
    tu: safeJson(r.tu_json, {}), ex: safeJson(r.ex_json, {}),
    eq: safeJson(r.eq_json, {}), paraghraphs: safeJson(r.paragraphs_json, []),
  };
};

export default UpdateTemplateService;
