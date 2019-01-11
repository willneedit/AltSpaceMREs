/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "../pg_backend";

import { QueryResult } from 'pg';

export interface SGDBLocationEntry {
    id: string;
    location: string;
    locked: boolean;
}

export class SGDB {
    private static db = PGBackend.instance;

    public static async init() {
        await this.db.query('CREATE TABLE IF NOT EXISTS gate_locations (' +
            'id varchar(10) PRIMARY KEY NOT NULL,' +
            'location varchar NOT NULL)');
        await this.db.query('ALTER TABLE gate_locations ' +
            'ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false');
    }

    public static async getLocation(idstr: string): Promise<SGDBLocationEntry> {
        const str = pgescape('SELECT location FROM gate_locations WHERE id=%L', idstr);
        const res: QueryResult = await this.db.query(str);

        if (res.rowCount === 0) return Promise.reject('Empty result');

        return {
            id: idstr,
            location: res.rows[0].location as string,
            locked: res.rows[0].locked as boolean
        };

    }

    public static async updateLocation(id: string, location: string) {
        return this.db.query(pgescape('DELETE FROM gate_locations WHERE id=%L', id)).then(() => {
            return this.db.query(pgescape('INSERT INTO gate_locations (id,location) VALUES (%L,%L)', id, location));
        });
    }

    public static registerLocationList(callback: (id: string, location: string, locked: boolean) => void) {
        this.db.query('SELECT id,location,locked from gate_locations').then(
            (res: QueryResult) => {
                for (const row of res.rows) {
                    callback(
                        row.id as string,
                        row.location as string,
                        row.locked as boolean);
                }
        });
    }
}
