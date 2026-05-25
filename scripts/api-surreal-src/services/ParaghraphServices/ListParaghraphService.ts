import { surql, normalizeRecords } from '../../lib/surreal';

const ListParaghraphService = async (): Promise<any[]> => {
  const rows = await surql(`SELECT * FROM paragraphs ORDER BY key_name ASC`);
  return normalizeRecords(rows).map((r: any) => ({
    id: r.id, key: r.key_name, value: r.value,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
};

export default ListParaghraphService;
