import { surql, sEsc, normalizeRecords } from '../../lib/surreal';

interface Request {
  searchParam?: string;
  pageNumber?: string | number;
  tenantId: string | number;
}

interface Response {
  users: any[];
  count: number;
  hasMore: boolean;
}

const ListUsersService = async ({
  searchParam = '', pageNumber = '1', tenantId
}: Request): Promise<Response> => {
  const limit = 40;
  const offset = limit * (+pageNumber - 1);
  const search = sEsc(String(searchParam).toLowerCase());

  const whereClause = `WHERE tenant_id = ${Number(tenantId) || 0}
    AND (string::contains(string::lowercase(name), "${search}")
      OR string::contains(string::lowercase(email), "${search}"))`;

  const [countRows, rows] = await Promise.all([
    surql(`SELECT count() as n FROM api_users ${whereClause} GROUP ALL`),
    surql(`SELECT id, name, email, profile FROM api_users ${whereClause}
           ORDER BY name ASC LIMIT ${limit} START ${offset}`),
  ]);

  const count = countRows[0]?.n ?? 0;
  const users = normalizeRecords(rows).map((u: any) => ({
    id: u.id, name: u.name, email: u.email, profile: u.profile
  }));
  const hasMore = count > offset + users.length;

  return { users, count, hasMore };
};

export default ListUsersService;
