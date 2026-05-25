import { surql, normalizeRecords } from '../../lib/surreal';

const ListCreditorContactsService = async (): Promise<any[]> => {
  const rows = await surql(`SELECT * FROM creditor_contacts ORDER BY name ASC`);
  return normalizeRecords(rows).map((r: any) => ({
    id: r.id, name: r.name, value: r.value,
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
};

export default ListCreditorContactsService;
