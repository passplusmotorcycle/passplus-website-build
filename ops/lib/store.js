import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { seedData } from './domain.js';

function clone(value) {
  return structuredClone(value);
}

export class JsonStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = null;
    this.writeQueue = Promise.resolve();
  }

  async init() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      this.data = JSON.parse(await readFile(this.filePath, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      this.data = seedData();
      await this.persist();
    }
    return this;
  }

  snapshot() {
    if (!this.data) throw new Error('Store is not initialized');
    return clone(this.data);
  }

  collection(name) {
    if (!Array.isArray(this.data?.[name])) throw new Error(`Unknown collection: ${name}`);
    return clone(this.data[name]);
  }

  find(name, id) {
    return clone(this.data?.[name]?.find((item) => item.id === id) ?? null);
  }

  async transact(actor, action, mutation) {
    this.writeQueue = this.writeQueue.catch(() => undefined).then(async () => {
      const draft = clone(this.data);
      const result = await mutation(draft);
      draft.auditLogs.push({
        id: randomUUID(),
        actor,
        action,
        entityType: result?.entityType ?? null,
        entityId: result?.entityId ?? null,
        metadata: result?.metadata ?? {},
        createdAt: new Date().toISOString(),
      });
      this.data = draft;
      await this.persist();
      return clone(result?.value ?? result);
    });
    return this.writeQueue;
  }

  async persist() {
    const temporaryPath = `${this.filePath}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, this.filePath);
  }
}
