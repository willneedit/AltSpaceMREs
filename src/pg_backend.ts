/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Client as PG, QueryResult } from 'pg';
import { inherits } from 'util';

export default class PGBackend {
    // tslint:disable-next-line:variable-name
    private static _instance: PGBackend = null;

    private dbConn: PG = null;

    // Late constructed singleton.
    public static get instance() {
        console.debug('PGBackend.instance called...');
        if (!this._instance) {
            console.debug('Creating PGBackend...');
            this._instance = new PGBackend();
            this._instance.init()
            .then(() => {
                console.debug('Creating PGBackend done.');
            }).catch((err) => {
                this._instance = null;
            });

        }
        return this._instance;
    }

    public async init() {
        if (!!process.env.DATABASE_URL) {
            // Running in Heroku, using provided information
            console.debug('Starting with provided database parameters');
            this.dbConn = new PG({
                connectionString: process.env.DATABASE_URL,
                ssl: { rejectUnauthorized: false }, // New with pg8: Trouble with Heroku's self-signed cert
            });
        } else {
            console.debug('No database parameters passed, using local config');
            // Running locally, for testing purposes
            // DATABASE MOVED, to ease use of Heroku's pg:push and pg:pull
            // Used with:
            //  PGHOST=localhost PGUSER=postgres PGPASSWORD=postgresql \
            //  heroku pg:pull DATABASE_URL stargate -a willneedit-mre
            // Use 'CREATE DATABASE stargate;' to initialize
            this.dbConn = new PG({
                host: 'localhost',
                database: 'stargate',
                user: 'postgres',
                password: 'postgresql'
            });
        }

        await this.dbConn.connect().catch(err => {
            console.error(`DATABASE CONNECTION FAILED, err=${err}`);
            throw err;
            // return Promise.reject(err);
        });

        // Test the connection, throw an error if it fails.
        await this.dbConn.query('SELECT table_schema,table_name FROM information_schema.tables', (err, res) => {
            if (err) {
                console.error(`ERROR WITH DATABASE CONNECTION, err=${err}`);
                return Promise.reject(err);
            }
        });
    }

    public async query(queryText: string): Promise<QueryResult> {
        return this.dbConn.query(queryText);
    }
}
