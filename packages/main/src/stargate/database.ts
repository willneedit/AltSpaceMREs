/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { SGDBpg } from './database_pg';
import { SGDBlite } from './database_sqlite';

export interface SGDBLocationEntry {
    lid: number;
    gid: number;
    location: string;
    lastseen: string;
}

export interface SGDBLike {
    init() : Promise<void>;
    getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry>;
    updateTimestamp(lid: number | string, gid: number): Promise<void>;
    registerLocation(lid: number, gid: number, location: string) : void;
    deleteLocation(gid: number, location: string) : void;
}

const databaseEngines: { [key: string]: () => SGDBLike } = {
    PostgresQL: () => new SGDBpg(),
    SQLite: () => new SGDBlite()
};

export class SGDB {
    private static dbBackend : SGDBLike = null;

    public static async init() : Promise<void> {
        for ( const key in databaseEngines) {
            if (databaseEngines.hasOwnProperty(key)) {
                if (this.dbBackend !== null) {
                    break;
                }
                console.debug (`Initializing ${key}...`);
                const eng = databaseEngines[key]();
                await eng.init()
                .then(() => {
                    console.debug (`Initializing ${key} done.`);
                    this.dbBackend = eng;
                    return;
                })
                .catch((err) => {
                    console.debug (`Initializing ${key} failed, err=${err}.`);
                });
            }

        }
        if (this.dbBackend !== null) {
            return Promise.resolve();
        }
        return Promise.reject("No database found, giving up.");

    }


    public static async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
        return this.dbBackend.getLocationData(lid, gid);
    }

    public static async registerLocation(lid: number, gid: number, location: string) {
        return this.dbBackend.registerLocation(lid, gid, location);
    }

    public static async updateTimestamp(lid: number | string, gid: number): Promise<void> {
        return this.dbBackend.updateTimestamp(lid,gid);
    }

    public static async deleteLocation(gid: number, location: string) {
        return this.dbBackend.deleteLocation(gid, location);
    }
}
