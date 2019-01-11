/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import pgescape from 'pg-escape';
import PGBackend from "./pg_backend";

import { QueryResult } from 'pg';

interface BanState {
    until: number;
    state: boolean;
}

export default class DoorGuard {
    private static db = PGBackend.instance;

    private static banList: { [ip: string]: BanState } = { };
    private static sessIDPrefix: { [sessid: string]: number } = { };

    public static async init() {
        await this.db.query('CREATE TABLE IF NOT EXISTS banned (' +
            'ip varchar PRIMARY KEY NOT NULL)');
    }

    /**
     * Blacklist an IP for 120 seconds.
     * @param ip IP to ban
     */
    public static ban(ip: string) {
        const currentTime = new Date().getTime() / 1000;
        this.banList[ip] = { until: currentTime + 120, state: true };
    }

    /**
     * Checks whether the IP is in good graces. Returned promise is self-explanatory.
     * @param ip IP to check for
     */
    public static async isAdmitted(ip: string) {
        const entry = this.banList[ip];
        const currentTime = new Date().getTime() / 1000;

        if (!entry || (entry.until < currentTime)) {
            const str = pgescape('SELECT ip FROM banned WHERE ip=%L', ip);
            const res: QueryResult = await this.db.query(str);
            this.banList[ip] = { until: currentTime + 3600, state: res.rowCount !== 0 };
            console.log(`BanCheck Update: ${ip} is ${this.banList[ip].state ? '' : 'not'} banned`);
        }

        if (this.banList[ip].state) {
            // If the one who pinged us is blacklisted and tries again, extend the ban time.
            if (this.banList[ip].until < currentTime + 70) this.banList[ip].until = currentTime + 70;
            return Promise.reject();
        }

        return Promise.resolve();
    }

    public static addSessIdPrefix(origId: string): string {
        return (this.sessIDPrefix[origId] || 0) + "@" + origId;
    }

    public static bumpSessId(managedId: string) {
        const origId = managedId.split("@", 2)[1];
        this.sessIDPrefix[origId] = (this.sessIDPrefix[origId] || 0) + 1;
    }
}
