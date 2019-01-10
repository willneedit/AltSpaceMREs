/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "./pg_backend";

import { QueryResult } from 'pg';

interface BanState {
    lastCheck: number;
    state: boolean;
}

export default class DoorGuard {
    private static db = PGBackend.instance;

    private static banList: { [id: string]: BanState } = { };

    public static async init() {
        await this.db.query('CREATE TABLE IF NOT EXISTS banned (' +
            'ip varchar PRIMARY KEY NOT NULL)');
    }

    public static async isAdmitted(ip: string) {
        const entry = this.banList[ip];
        const currentTime = new Date().getTime() / 1000;

        if (!entry || (entry.lastCheck + 3600 < currentTime)) {
            const str = pgescape('SELECT ip FROM banned WHERE ip=%L', ip);
            const res: QueryResult = await this.db.query(str);
            this.banList[ip] = { lastCheck: currentTime, state: res.rowCount !== 0 };
            console.log(`BanCheck Update: ${ip} is ${this.banList[ip].state ? '' : 'not'} banned`);
        }

        return this.banList[ip].state ? Promise.reject() : Promise.resolve();
    }
}
