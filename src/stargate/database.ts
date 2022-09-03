/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "../pg_backend";

import { QueryResult } from 'pg';

export interface SGDBLocationEntry {
    lid: number;
    gid: number;
    location: string;
    lastseen: string;
}

export class SGDB {
    private static db: PGBackend = null;

    public static async init() {
        console.debug('Looking for DB backend...');
        this.db = PGBackend.instance;

        console.debug('Creating table known_locations...');

        await this.db.query('CREATE TABLE IF NOT EXISTS known_locations (' +
            'lid BIGINT NOT NULL,' +
            'gid INTEGER NOT NULL,' +
            'location VARCHAR NOT NULL,' +
            'lastseen TIMESTAMP NOT NULL,' +
            'PRIMARY KEY (lid,gid) )').then((res: QueryResult) => {
                console.debug('Database of V2 format created');
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

}
