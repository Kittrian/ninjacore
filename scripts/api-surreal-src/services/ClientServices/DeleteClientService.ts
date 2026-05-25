import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';
import socketEmit from '../../helpers/socketEmit';

interface Request {
  id: string | number;
}

const DeleteClientService = async ({ id }: Request): Promise<void> => {
  const clientId = Number(id);
  const rows = await surql(`SELECT id FROM api_clients:${clientId} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CLIENT_FOUND', 404);

  await restDelete('api_clients', clientId);
  // Cascade delete related records
  const extraRows = await surql(`SELECT id FROM extra_infos WHERE client_id = ${clientId}`);
  for (const r of extraRows) {
    const suffix = String(r.id).split(':')[1] ?? r.id;
    await surql(`DELETE extra_infos:${suffix}`);
  }
  await surql(`DELETE api_reports WHERE client_id = ${clientId}`);
  const rdRows = await surql(`SELECT id FROM report_data_entries WHERE client_id = ${clientId}`);
  for (const r of rdRows) {
    const suffix = String(r.id).split(':')[1] ?? r.id;
    await surql(`DELETE report_data_entries:${suffix}`);
  }

  socketEmit({ tenantId: 'abay', type: 'contact:delete', payload: { id: clientId } });
};

export default DeleteClientService;
