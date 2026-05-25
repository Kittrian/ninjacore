import { surql, restPatch } from '../../lib/surreal';
import AppError from '../../errors/AppError';

interface Request { clientId: number; newProgress: object[]; }

const UpdateProgressReport = async ({ clientId, newProgress }: Request): Promise<any> => {
  const rows = await surql(`SELECT client_id FROM api_reports WHERE client_id = ${clientId} LIMIT 1`);
  if (!rows.length) throw new AppError(`Report not found for ClientId ${clientId}.`, 404);
  const updated = await restPatch('api_reports', clientId, {
    progress: newProgress,
    updated_at: new Date().toISOString(),
  });
  return updated;
};

export default UpdateProgressReport;
