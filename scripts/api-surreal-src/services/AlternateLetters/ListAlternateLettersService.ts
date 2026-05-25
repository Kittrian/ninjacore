import { surql, normalizeRecords } from '../../lib/surreal';

const ListAlternateLettersService = async (): Promise<any[]> => {
  const rows = await surql(`SELECT * FROM alternate_letters ORDER BY name ASC`);
  return normalizeRecords(rows).map((r: any) => ({
    id: r.id, name: r.name, file_html: r.file_html,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
};

export default ListAlternateLettersService;
