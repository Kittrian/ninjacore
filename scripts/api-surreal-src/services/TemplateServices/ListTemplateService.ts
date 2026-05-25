import { surql, normalizeRecords } from '../../lib/surreal';

const ListTemplateService = async (): Promise<any[]> => {
  const rows = await surql(`SELECT * FROM templates ORDER BY name ASC`);
  return normalizeRecords(rows).map((r: any) => ({
    id: r.id, name: r.name, file_name: r.file_name, file_html: r.file_html,
    tu: safeJson(r.tu_json, {}), ex: safeJson(r.ex_json, {}),
    eq: safeJson(r.eq_json, {}), paraghraphs: safeJson(r.paragraphs_json, []),
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
};

function safeJson(v: any, fb: any) {
  if (!v) return fb;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fb; }
}

export default ListTemplateService;
