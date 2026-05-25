// src/lib/geminiDb.ts
// SurrealDB-backed replacements for GeminiKey and GeminiUsage Sequelize models

import { surql, restPatch, restPut, sEsc, normalizeRecord, normalizeRecords } from './surreal';

// ─── GeminiKey ────────────────────────────────────────────────────────────────

export const GeminiKey = {
  async findAll(options: {
    where?: { isActive?: boolean; cooldownUntil?: any; id?: number },
    order?: [string, string][],
    include?: any[],
  } = {}): Promise<any[]> {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
    let where = 'WHERE true';
    if (options.where?.isActive !== undefined) {
      where += ` AND is_active = ${options.where.isActive}`;
    }
    // Handle cooldownUntil: lte now (find keys not in cooldown)
    // We want keys where cooldown_until <= now OR cooldown_until is NONE
    where += ` AND (cooldown_until IS NONE OR cooldown_until <= time::now())`;

    const order = options.order
      ? `ORDER BY ${options.order.map(([f, d]) => `${camelToSnake(f)} ${d}`).join(', ')}`
      : 'ORDER BY last_used_at ASC';

    const rows = await surql(`SELECT * FROM gemini_keys ${where} ${order}`);
    const keys = normalizeRecords(rows).map(toKeyObj);

    if (options.include && options.include.length > 0) {
      // Fetch usages for today for each key
      const keyIds = keys.map((k: any) => k.id);
      if (keyIds.length > 0) {
        const usageRows = await surql(
          `SELECT * FROM gemini_usages WHERE api_key_id IN [${keyIds.join(',')}] AND usage_date = "${today}"`
        );
        const usagesByKeyId: Record<number, any[]> = {};
        for (const u of normalizeRecords(usageRows)) {
          const kid = u.api_key_id;
          if (!usagesByKeyId[kid]) usagesByKeyId[kid] = [];
          usagesByKeyId[kid].push(toUsageObj(u));
        }
        for (const key of keys) {
          (key as any).usages = usagesByKeyId[key.id] ?? [];
        }
      }
    }

    return keys;
  },

  async findOrCreate(options: { where: any; defaults?: any }): Promise<[any, boolean]> {
    const { where, defaults = {} } = options;
    const key = sEsc(where.key ?? defaults.key ?? '');
    const existing = await surql(`SELECT * FROM gemini_keys WHERE key = "${key}" LIMIT 1`);
    if (existing.length) {
      return [toKeyObj(normalizeRecord(existing[0])), false];
    }
    // Create new
    const now = new Date().toISOString();
    const lastRows = await surql(`SELECT id FROM gemini_keys ORDER BY id DESC LIMIT 1`);
    const newId = (normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1;
    const data = {
      key: defaults.key ?? where.key ?? '',
      owner: defaults.owner ?? null,
      is_active: defaults.isActive ?? true,
      last_used_at: defaults.lastUsedAt ? new Date(defaults.lastUsedAt).toISOString() : now,
      cooldown_until: defaults.cooldownUntil ?? null,
      created_at: now, updated_at: now,
    };
    await restPut('gemini_keys', newId, data);
    return [toKeyObj({ id: newId, ...data }), true];
  },

  async update(data: Record<string, any>, options: { where: { id?: number | number[] } }): Promise<void> {
    const ids = Array.isArray(options.where.id) ? options.where.id : [options.where.id];
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (data.cooldownUntil !== undefined) {
      updates.cooldown_until = data.cooldownUntil ? new Date(data.cooldownUntil).toISOString() : null;
    }
    if (data.lastUsedAt !== undefined) {
      updates.last_used_at = data.lastUsedAt ? new Date(data.lastUsedAt).toISOString() : null;
    }
    if (data.isActive !== undefined) updates.is_active = data.isActive;
    for (const id of ids) {
      if (id != null) await restPatch('gemini_keys', id, updates);
    }
  },
};

// ─── GeminiUsage ──────────────────────────────────────────────────────────────

export const GeminiUsage = {
  async findOrCreate(options: {
    where: { apiKeyId: number; modelName: string; usageDate: string };
    defaults?: any;
    transaction?: any;
    lock?: any;
  }): Promise<[any, boolean]> {
    const { where, defaults = {} } = options;
    const existing = await surql(
      `SELECT * FROM gemini_usages WHERE api_key_id = ${where.apiKeyId}
       AND model_name = "${sEsc(where.modelName)}" AND usage_date = "${sEsc(where.usageDate)}" LIMIT 1`
    );
    if (existing.length) {
      const u = normalizeRecord(existing[0]);
      return [toUsageMutable(u), false];
    }
    // Create new
    const now = new Date().toISOString();
    const lastRows = await surql(`SELECT id FROM gemini_usages ORDER BY id DESC LIMIT 1`);
    const newId = (normalizeRecord(lastRows[0] ?? {}).id ?? 0) + 1;
    const data = {
      api_key_id: where.apiKeyId,
      model_name: where.modelName,
      usage_date: where.usageDate,
      request_count: defaults.requestCount ?? 0,
      created_at: now, updated_at: now,
    };
    await restPut('gemini_usages', newId, data);
    return [toUsageMutable({ id: newId, ...data }), true];
  },

  async decrement(field: string, options: { where: { id: number } }): Promise<void> {
    if (field === 'requestCount') {
      await surql(`UPDATE gemini_usages:${options.where.id} SET
        request_count = IF request_count > 0 THEN request_count - 1 ELSE 0 END,
        updated_at = time::now()`);
    }
  },
};

// ─── Stub transaction (SurrealDB auto-commits single statements) ──────────────

export const sequelizeStub = {
  transaction: async () => ({
    commit: async () => {},
    rollback: async () => {},
    LOCK: { UPDATE: 'UPDATE' },
    finished: false,
  }),
  authenticate: async () => {},
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
}

function toKeyObj(r: any): any {
  return {
    id: r.id,
    key: r.key,
    owner: r.owner,
    isActive: r.is_active ?? true,
    lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : new Date(),
    cooldownUntil: r.cooldown_until ? new Date(r.cooldown_until) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    usages: r.usages ?? [],
    // Instance methods for save()
    save: async function(opts?: any) {
      const updates: Record<string, any> = { updated_at: new Date().toISOString() };
      if (this.lastUsedAt) updates.last_used_at = new Date(this.lastUsedAt).toISOString();
      if (this.cooldownUntil !== undefined) {
        updates.cooldown_until = this.cooldownUntil ? new Date(this.cooldownUntil).toISOString() : null;
      }
      updates.is_active = this.isActive;
      await restPatch('gemini_keys', this.id, updates);
    },
  };
}

function toUsageObj(r: any): any {
  return {
    id: r.id,
    apiKeyId: r.api_key_id,
    modelName: r.model_name,
    usageDate: r.usage_date,
    requestCount: r.request_count ?? 0,
  };
}

function toUsageMutable(r: any): any {
  const u: any = {
    id: r.id,
    apiKeyId: r.api_key_id ?? r.apiKeyId,
    modelName: r.model_name ?? r.modelName,
    usageDate: r.usage_date ?? r.usageDate,
    requestCount: r.request_count ?? r.requestCount ?? 0,
    save: async function(opts?: any) {
      await restPatch('gemini_usages', this.id, {
        request_count: this.requestCount,
        updated_at: new Date().toISOString(),
      });
    },
  };
  return u;
}
