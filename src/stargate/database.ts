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
    private static db: PGBackend = null;

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
                console.debug(`Nonstandard location for ${val.location}: Using computed one, ${idloc.seq_string}`);
                usingid = idloc.lid;
            } else if (idres.seq_string !== idloc.seq_string) {
                console.debug(`Location ID mismatch for ${val.location}: ` +
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
        console.debug('Looking for DB backend...');
        this.db = PGBackend.instance;
        console.debug('Creating legacy table gate_locations...');

        // Obsolete, but still needs to be present for migration code
        await this.db.query('CREATE TABLE IF NOT EXISTS gate_locations (' +
            'id varchar(10) PRIMARY KEY NOT NULL,' +
            'location varchar NOT NULL,' +
            'locked boolean DEFAULT false)').catch(err => {
                console.error(`Creation of gate_locations failed, reason=${err}`);
            });

        // Obsolete
        // await this.db.query('create table if not exists object_sids (' +
        //     'sid varchar(20) primary key not null,' +
        //     'location varchar not null)');

        console.debug('Creating table admin_access');

        await this.db.query('CREATE TABLE IF NOT EXISTS admin_access (' +
            'id SERIAL PRIMARY KEY,' +
            'password TEXT NOT NULL)').catch(err => {
                console.error(`Creation of admin_access failed, reason=${err}`);
            });

        console.debug('Creating extension pg_crypto');

        await this.db.query('CREATE EXTENSION IF NOT EXISTS pgcrypto').catch(err => {
            console.error(`Creation of pg_crypto failed, reason=${err}`);
        });

        console.debug('Creating table known_locations...');

        await this.db.query('CREATE TABLE known_locations (' +
            'lid BIGINT NOT NULL,' +
            'gid INTEGER NOT NULL,' +
            'location VARCHAR NOT NULL,' +
            'lastseen TIMESTAMP NOT NULL,' +
            'PRIMARY KEY (lid,gid) )').then((res: QueryResult) => {
                console.debug('Database of V2 format created, migrating contents...');
                this.migrateLocationsDB();
            }).catch(err => {
                console.debug('Database of V2 format already exists');
            });

        console.debug('Database creation finished');
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
        const str = this.getWhereClause(lid, gid);

        return this.db.query('SELECT lid, gid, location, lastseen FROM known_locations' + str
            ).then((res: QueryResult) => {
                if (res.rowCount === 0) return Promise.reject('Empty result');

                res.rows[0].lid = +res.rows[0].lid;
                res.rows[0].gid = +res.rows[0].gid;

                return Promise.resolve(res.rows[0]);
            }
        );
    }

    public static async updateTimestamp(lid: number | string, gid: number): Promise<void> {
        const str = this.getWhereClause(lid, gid);

        this.db.query("UPDATE known_locations SET lastseen = now()" + str);
    }

    private static getWhereClause(lid: string | number, gid: number) {
        if (typeof lid === 'number') {
            return pgescape(' WHERE (lid=%L AND gid=%L)', lid.toString(), gid.toString());
        } else {
            return pgescape(' WHERE (location=%L AND gid=%L)', lid, gid.toString());
        }
    }

    public static async registerLocation(lid: number, gid: number, location: string) {
        const str = pgescape('INSERT INTO known_locations (lid,gid,location,lastseen) VALUES (%L, %L, %L, %L)',
            lid.toString(),
            gid.toString(),
            location,
            "now()");

        return this.db.query(str);
    }

    public static deleteLocation(gid: number, location: string) {
        return this.db.query(pgescape('DELETE FROM known_locations WHERE (gid=%L AND location=%L)',
            gid.toString(),
            location));
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
