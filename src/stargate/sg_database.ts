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
            'location varchar NOT NULL,' +
            'locked boolean DEFAULT false)');

        await this.db.query('CREATE TABLE IF NOT EXISTS object_sids (' +
            'sid varchar(20) PRIMARY KEY NOT NULL,' +
            'location varchar NOT NULL)');

        await this.db.query('CREATE TABLE IF NOT EXISTS admin_access (' +
            'id SERIAL PRIMARY KEY,' +
            'password TEXT NOT NULL)');

        await this.db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    }

    public static async forEachLocation(f: (val: SGDBLocationEntry) => void) {
        const str = 'SELECT id,location,locked FROM gate_locations';
        const res = await this.db.query(str);

        for (const line of res.rows) {
            f({ id: line.id, location: line.location, locked: line.locked });
        }
    }

    public static async getLocationDataId(idstr: string): Promise<SGDBLocationEntry> {
        const str = pgescape('SELECT id,location,locked FROM gate_locations WHERE id=%L', idstr);
        return this.db.query(str).then((res: QueryResult) => {
            if (res.rowCount === 0) return Promise.reject('Empty result');

            return Promise.resolve({
                id: idstr,
                location: res.rows[0].location as string,
                locked: res.rows[0].locked as boolean
            });
        });
    }

    public static async getLocationDataLoc(location: string): Promise<SGDBLocationEntry> {
        const str = pgescape('SELECT id,location,locked FROM gate_locations WHERE location=%L', location);
        return this.db.query(str).then((res: QueryResult) => {
            if (res.rowCount === 0) return Promise.reject('Empty result');

            if (res.rowCount > 1) return Promise.reject('Location has more than one ID');

            return Promise.resolve({
                id: res.rows[0].id as string,
                location: res.rows[0].location as string,
                locked: res.rows[0].locked as boolean
            });

        });
    }

    public static async getIdForSid(sid: string): Promise<string> {
        const res = await this.db.query(pgescape('SELECT location FROM object_sids WHERE sid=%L', sid));

        if (res.rowCount === 0) return Promise.reject('Object not registered');

        return res.rows[0].location;
    }

    public static async registerIdForSid(sid: string, id: string) {
        return id
            ? this.db.query(
                pgescape('INSERT INTO object_sids (sid,location) VALUES (%L,%L) ON CONFLICT DO NOTHING',
                    sid, id))
            : this.db.query('SELECT 0');
    }

    public static async registerLocation(id: string, location: string) {
            return location
                ? this.db.query(
                    pgescape('INSERT INTO gate_locations (id,location) VALUES (%L,%L) ON CONFLICT DO NOTHING',
                        id, location))
                : this.db.query('SELECT 0');
    }

    public static deleteLocation(id: string) {
        this.db.query(pgescape('DELETE FROM gate_locations WHERE id=%L', id));
        this.db.query(pgescape('DELETE FROM object_sids WHERE location=%L', id));
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

    // Passwords are entered using
    // insert into admin_access (password) values(crypt('password',gen_salt('bf')));
    public static async isAdmin(pw: string): Promise<void> {
        const str = pgescape('SELECT id FROM admin_access where password = crypt(%L, password)', pw);
        const res: QueryResult = await this.db.query(str);

        if (res.rowCount === 0) return Promise.reject('Empty result');

        return Promise.resolve();

    }

}
