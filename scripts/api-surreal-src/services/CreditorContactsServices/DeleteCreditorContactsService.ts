import { surql, restDelete } from '../../lib/surreal';
import AppError from '../../errors/AppError';

const DeleteCreditorContactsService = async ({ id }: { id: string }): Promise<void> => {
  const rows = await surql(`SELECT id FROM creditor_contacts:${Number(id)} LIMIT 1`);
  if (!rows.length) throw new AppError('ERR_NO_CREDITOR_CONTACTS_FOUND', 404);
  await restDelete('creditor_contacts', Number(id));
};

export default DeleteCreditorContactsService;
