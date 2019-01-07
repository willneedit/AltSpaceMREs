/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "../pg_backend";

import { QueryResult } from 'pg';

export default class SGDB {
    private static db = PGBackend.instance;

    public static async init() {
        await this.db.query('CREATE TABLE IF NOT EXISTS gate_locations (' +
            'id varchar(10) PRIMARY KEY NOT NULL,' +
            'location varchar NOT NULL)');
    }

    public static async getLocation(id: string): Promise<string> {
        const str = pgescape('SELECT location FROM gate_locations WHERE id=%L', id);
        const res: QueryResult = await this.db.query(str);

        if (res.rowCount === 0) return Promise.reject('Empty result');

        return res.rows[0].location as string;
    }

    public static async updateLocation(id: string, location: string) {
        return this.db.query(pgescape('DELETE FROM gate_locations WHERE id=%L', id)).then(() => {
            return this.db.query(pgescape('INSERT INTO gate_locations (id,location) VALUES (%L,%L)', id, location));
        });
    }

    public static registerLocationList(callback: (id: string, location: string) => void) {
        this.db.query('SELECT id,location from gate_locations').then(
            (res: QueryResult) => {
                for (const row of res.rows) {
                    callback(row.id as string, row.location as string);
                }
        });
    }
}
