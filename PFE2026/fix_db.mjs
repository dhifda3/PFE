import pg from "pg";
const client = new pg.Client("postgresql://postgres:admin@localhost:5432/cosmetica_db");
await client.connect();
const r = await client.query('UPDATE "user" SET skin_type=\'dry\', skin_concerns=\'aging\' WHERE id=\'b846v9MPkNYedGgoKBjpBzdK4qlQJY5Q\'');
console.log("Updated rows:", r.rowCount);
await client.end();
