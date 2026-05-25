import { surql } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const GetProgressReport = async (clientId: number): Promise<any> => {
  const rows = await surql(`SELECT progress FROM api_reports WHERE client_id = ${clientId} LIMIT 1`);
  if (!rows.length) throw new AppError(`Report not found for ClientId ${clientId}.`, 404);
  return rows[0].progress ?? [];
};

export default GetProgressReport;
