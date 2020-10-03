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
    private static rungList: { [ip: string]: number } = { };

    public static async init() {
        await this.db.query('CREATE TABLE IF NOT EXISTS banned (' +
            'ip varchar PRIMARY KEY NOT NULL)');
    }

    /**
     * We got a user handshake from a given IP, reset the counter.
     * @param ip IP we got a user handshake from
     */
    public static greeted(ip: string) {
        this.rungList[ip] = 0;
    }

    /**
     * Notify down the IP which just rung and we opened the door with.
     * Start a timeout for actual traffic to come, and if the counter reaches its threshold, ban.
     * @param ip IP about to connect
     */
    public static rung(ip: string) {
        this.rungList[ip] = (this.rungList[ip] || 0) + 1;
        setTimeout(() => {
            if (this.rungList[ip] > 50) {
                console.warn(`Excessive connection attempts without handshakes from ${ip} - banning.`);
                this.ban(ip);
                this.rungList[ip] = undefined;
            }
        }, 30 * 1000);
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
            console.debug(`BanCheck Update: ${ip} is ${this.banList[ip].state ? '' : 'not'} banned`);
        }

        if (this.banList[ip].state) {
            // If the one who pinged us is blacklisted and tries again, extend the ban time.
            if (this.banList[ip].until < currentTime + 70) this.banList[ip].until = currentTime + 70;
            return Promise.reject();
        }

        return Promise.resolve();
    }
}
