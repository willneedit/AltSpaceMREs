/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "../pg_backend";

import { QueryResult } from 'pg';
import SGAddressing from './addressing';

export interface SGDBLocationEntry {
    lid: number;
    gid: number;
    location: string;
    lastseen: string;
}

export class SGDB {
    private static db = PGBackend.instance;

    private static async forEachLocationOld(f: (val: any) => void) {
        const str = 'SELECT id,location,locked FROM gate_locations';
        const res = await this.db.query(str);

        for (const line of res.rows) {
            f({
                id: line.id,
                location: line.location,
                locked: line.locked
            });
        }
    }

    private static async migrateLocationsDB() {
        this.forEachLocationOld((val: any) => {
            const idres = SGAddressing.analyzeLocationId(val.id, 38, 1);
            const locid = SGAddressing.getLocationId(val.location);
            const idloc = SGAddressing.analyzeLocationId(locid, 38, 1);

            let usingid = idres.lid;

            if (val.id[val.id.length - 1] !== 'a') {
                console.log(`Nonstandard location for ${val.location}: Using computed one, ${idloc.seq_string}`);
                usingid = idloc.lid;
            } else if (idres.seq_string !== idloc.seq_string) {
                console.log(`Location ID mismatch for ${val.location}: ` +
                    `given=${idres.seq_string}, computed=${idloc.seq_string}, using given one`);
            }

            const str = pgescape('INSERT INTO known_locations ' +
                '(lid,gid,location,lastseen) VALUES (%L, 1, %L, %L)',
                usingid.toString(),
                val.location,
                "epoch"
            );

            this.db.query(str);

        });
    }

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

        await this.db.query('CREATE TABLE known_locations (' +
            'lid BIGINT NOT NULL,' +
            'gid INTEGER NOT NULL,' +
            'location VARCHAR NOT NULL,' +
            'lastseen TIMESTAMP NOT NULL,' +
            'PRIMARY KEY (lid,gid) )').then((res: QueryResult) => {
                console.log('Database of V2 format created, migrating contents...');
                this.migrateLocationsDB();
            }).catch(err => {
                console.log('Database of V2 format already exists');
            });

    }

    public static async forEachLocation(f: (val: SGDBLocationEntry) => void) {
        const str = 'SELECT lid, gid, location, lastseen FROM known_locations';
        const res = await this.db.query(str);

        for (const line of res.rows) {
            line.lid = +line.lid;
            line.gid = +line.gid;
            f(line);
        }
    }

    /**
     * Retrieve the location database entry for the given location
     * @param lid numerical location ID or in-galaxy location
     * @param gid Galaxy ID
     */
    public static async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
        let str = '';

        if (typeof lid === 'number') {
            str = pgescape(
                'SELECT lid, gid, location, lastseen FROM known_locations WHERE (lid=%L AND gid=%L)',
                    lid.toString(),
                    gid.toString());
        } else {
            str = pgescape(
                'SELECT lid, gid, location, lastseen FROM known_locations WHERE (location=%L AND gid=%L)',
                lid,
                gid.toString());
        }

        return this.db.query(str).then((res: QueryResult) => {
            if (res.rowCount === 0) return Promise.reject('Empty result');

            res.rows[0].lid = +res.rows[0].lid;
            res.rows[0].gid = +res.rows[0].gid;
            return Promise.resolve(res.rows[0]);
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

    // Passwords are entered using
    // insert into admin_access (password) values(crypt('password',gen_salt('bf')));
    public static async isAdmin(pw: string): Promise<void> {
        const str = pgescape('SELECT id FROM admin_access where password = crypt(%L, password)', pw);
        const res: QueryResult = await this.db.query(str);

        if (res.rowCount === 0) return Promise.reject('Empty result');

        return Promise.resolve();

    }

}
