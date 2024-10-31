import {
    IndexedDBInterface,
} from 'lib/sys/idb';


const uuid = 'e9e4f36a-02fb-42b3-918a-c846df4a1b51';

export const db_key_settings = 'settings';
export const db_key_themes   = 'themes';

// database_name and database_store_name use UUIDs, but these must be constant,
// not generated each time the system is loaded.
export const database_name       = `settings-database-${uuid}`;
export const database_store_name = `settings-database-store-${uuid}`;

export const storage_db = new IndexedDBInterface(database_name, database_store_name);
