export class IndexedDBInterface {
    database_name:       string;
    database_store_name: string;
    _startup_promise:    Promise<IDBDatabase>;

    constructor(database_name: string, database_store_name: string) {
        if (typeof database_name !== 'string' || typeof database_store_name !== 'string') {
            throw new Error('database_name and database_store_name must be strings');
        }

        this.database_name       = database_name;
        this.database_store_name = database_store_name;

        this._startup_promise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(database_name, 1);
            request.onerror   = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = () => {
                // create empty object store (first time upgrade)
                request.result.createObjectStore(database_store_name);
            };
        });
    }

    async with_object_store(mode: IDBTransactionMode, receiver: ((store: IDBObjectStore) => any)): Promise<void> {
        const db = await this._startup_promise;
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(this.database_store_name, mode);
            transaction.oncomplete = () => resolve();
            transaction.onabort = transaction.onerror = () => reject(transaction.error);
            receiver(transaction.objectStore(this.database_store_name));
        });
    }

    async get(key: string) {
        let req: undefined|object = undefined;
        await this.with_object_store('readonly', store => {
            req = store.get(key);
        });
        return (req as any)?.result;
    }

    async put(key: string, value: object) {
        return this.with_object_store('readwrite', store => {
            store.put(value, key);
        });
    }

    async delete(key: string) {
        return this.with_object_store('readwrite', store => {
            store.delete(key);
        });
    }

    async clear() {
        return this.with_object_store('readwrite', store => {
            store.clear();
        });
    }

    async keys(): Promise<object> {
        let req: undefined|object = undefined;
        await this.with_object_store('readonly', store => {
            req = store.getAllKeys();
        });
        return (req as any).result;
    }
}
