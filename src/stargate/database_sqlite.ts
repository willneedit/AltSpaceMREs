/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { SGDBLike, SGDBLocationEntry } from "./database";

import sqlite3 from 'sqlite3';
import { resolve } from "url";

export class SGDBlite implements SGDBLike {
    private db : sqlite3.Database = null;

    public async init() {
        const result = new Promise<void>((res, rej) => {
        // tslint:disable-next-line:no-bitwise
        this.db = new sqlite3.Database('./db/stargate.db', sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE, (err) => {
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

    public async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
        const loc : SGDBLocationEntry = null;
        return loc;
    }

    public async updateTimestamp(lid: number | string, gid: number): Promise<void> {

    }

    private getWhereClause(lid: string | number, gid: number) {

    }

    public async registerLocation(lid: number, gid: number, location: string) {

    }

    public deleteLocation(gid: number, location: string) {

    }
}

