import { surql, sEsc, normalizeRecords } from '../../lib/surreal';

interface Request {
  searchParam?: string;
  pageNumber?: string;
  descending?: boolean;
  sortBy?: string;
}

interface Response {
  clients: any[];
  count: number;
  hasMore: boolean;
}

const ListClientsService = async ({
  searchParam = '', pageNumber = '1', descending = true, sortBy = 'name'
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (Number(pageNumber) - 1);
  const dir = descending ? 'DESC' : 'ASC';

  const terms = String(searchParam).toLowerCase().trim().split(/\s+/).filter(Boolean);

  let whereClause = '';
  if (terms.length > 0) {
    const termConditions = terms.map(term => {
      const t = sEsc(term);
      return `(string::contains(string::lowercase(first_name), "${t}")
            OR string::contains(string::lowercase(last_name), "${t}")
            OR string::contains(string::lowercase(phone), "${t}")
            OR string::contains(string::lowercase(email), "${t}"))`;
    }).join(' AND ');
    whereClause = `WHERE ${termConditions}`;
  }

  const orderMap: Record<string, string> = {
    name: `first_name ${dir}, last_name ${dir}`,
    nextReminder: `next_reminder ${dir}`,
    hasFile: `has_file ${dir}`,
    id: `id ASC`,
  };
  const orderClause = `ORDER BY ${orderMap[sortBy] ?? `id ASC`}`;

  const [countRows, rows] = await Promise.all([
    surql(`SELECT count() as n FROM api_clients ${whereClause} GROUP ALL`),
    surql(`SELECT id, first_name, last_name, address, ssn, dob,
             next_reminder, dl_id, ssn_id, poa_id, poa2_id, cover_sheet, user_id, poa3_id
           FROM api_clients ${whereClause}
           ${orderClause} LIMIT ${limit} START ${offset}`),
  ]);

  const count = countRows[0]?.n ?? 0;

  // Fetch report new_version flag for each client
  const clients = normalizeRecords(rows);
  const clientIds = clients.map((c: any) => c.id);

  let reportMap: Record<number, boolean> = {};
  if (clientIds.length > 0) {
    const reportRows = await surql(
      `SELECT client_id, new_version FROM api_reports WHERE client_id IN [${clientIds.join(',')}]`
    );
    for (const r of reportRows) {
      reportMap[r.client_id] = r.new_version;
    }
  }

  const result = clients.map((c: any) => ({
    ...c,
    UserId: c.user_id,
    nextReminder: c.next_reminder,
    hasFile: c.has_file,
    createPdf: c.create_pdf,
    json: { newVersion: reportMap[c.id] ?? true },
  }));

  const hasMore = count > offset + result.length;
  return { clients: result, count, hasMore };
};

export default ListClientsService;
