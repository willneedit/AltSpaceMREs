/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Client as PG, QueryResult } from 'pg';

export default class PGBackend {
    // tslint:disable-next-line:variable-name
    private static _instance: PGBackend = null;

    private dbConn: PG = null;

    // Late constructed singleton.
    public static get instance() {
        if (!this._instance) this._instance = new PGBackend();
        return this._instance;
    }

    constructor() {
        if (!!process.env.DATABASE_URL) {
            // Running in Heroku, using provided information
            this.dbConn = new PG({
                connectionString: process.env.DATABASE_URL,
                ssl: true,
            });
        } else {
            // Running locally, for testing purposes
            this.dbConn = new PG({
                host: 'localhost',
                database: 'postgres',
                user: 'postgres',
                password: 'postgresql'
            });
        }

        this.dbConn.connect();

        // Test the connection, throw an error if it fails.
        this.dbConn.query('SELECT table_schema,table_name FROM information_schema.tables', (err, res) => {
            if (err) throw err;
        });
    }

    public async query(queryText: string): Promise<QueryResult> {
        return this.dbConn.query(queryText);
    }
}
