/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { SGDBLike, SGDBLocationEntry } from "./database";

import sqlite3 from 'sqlite3';
import pgescape from 'pg-escape';

export class SGDBlite implements SGDBLike {
    private db : sqlite3.Database = null;

    public async init() {
        let result = new Promise<void>((res, rej) => {
        // tslint:disable-next-line:no-bitwise
        this.db = new sqlite3.Database('../db/stargate.db', sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
                if (err) {
                    this.db = null;
                    console.error(err.message);
                    rej(err.message);
                } else {
                    res();
                }
            });
        });

        await result.then(() => {
            console.debug('Creating table known_locations...');

            result = this.simpleDBRun(
                'CREATE TABLE IF NOT EXISTS known_locations (' +
                'lid TEXT NOT NULL,' +
                'gid INTEGER NOT NULL,' +
                'location TEXT NOT NULL,' +
                'lastseen TEXT NOT NULL,' +
                'PRIMARY KEY (lid,gid) )'
            );
        }).catch((err) => {

        });

        return result;
    }

    public async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
        const result : Promise<SGDBLocationEntry> = new Promise<SGDBLocationEntry>((res, rej) => {
            const str = this.getWhereClause(lid, gid);

            this.db.get('SELECT lid, gid, location, lastseen FROM known_locations' + str, (err, row) => {
                if (err) {
                    console.error(err.message);
                    return rej(err.message);
                } else if (!row) {
                    return rej("Empty result");
                }
                return res({
                    lid: +row.lid,
                    gid: +row.gid,
                    location: row.location,
                    lastseen: row.lastseen
                });
            });

        });
        return result;
    }

    public async updateTimestamp(lid: number | string, gid: number): Promise<void> {
        const str = this.getWhereClause(lid, gid);

        return this.simpleDBRun("UPDATE known_locations SET lastseen = datetime('now')" + str);
    }

    private getWhereClause(lid: string | number, gid: number) {
        if (typeof lid === 'number') {
            return pgescape(' WHERE (lid=%L AND gid=%L)', lid.toString(), gid.toString());
        } else {
            return pgescape(' WHERE (location=%L AND gid=%L)', lid, gid.toString());
        }
    }

    public async registerLocation(lid: number, gid: number, location: string) {
        const str = pgescape('INSERT INTO known_locations (lid,gid,location,lastseen) VALUES (%L, %L, %L, datetime("now"))',
        lid.toString(),
        gid.toString(),
        location,
        "datetime('now')");

        return this.simpleDBRun(str);
    }

    public deleteLocation(gid: number, location: string) {
        const str = pgescape('DELETE FROM known_locations WHERE (gid=%L AND location=%L)',
        gid.toString(),
        location);

        return this.simpleDBRun(str);
    }

    private async simpleDBRun(query: string) : Promise<void> {
        const result = new Promise<void>((res, rej) => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error(err.message);
                    rej(err.message);
                } else {
                    res();
                }
            });
        });

        return result;

    }
}