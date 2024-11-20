import {
    IndexedDBInterface,
} from 'lib/sys/idb';


const uuid = 'aed2419a-d23e-48b0-ae31-4f378729bf9b';

export const db_key_settings = 'settings';
export const db_key_themes   = 'themes';

// database_name and database_store_name use UUIDs, but these must be constant,
// not generated each time the system is loaded.
export const database_name       = `settings-database-${uuid}`;
export const database_store_name = `settings-database-store-${uuid}`;

export const storage_db = new IndexedDBInterface(database_name, database_store_name);
