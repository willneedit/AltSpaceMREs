/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { SGDialCompLike, StargateDespawned, StargateLike } from "./types";

import QueryString from 'query-string';

import { SGDB, SGDBLocationEntry } from './database';

import { ParameterSet } from '@microsoft/mixed-reality-extension-sdk';
import { eventNames } from 'cluster';

interface TargetReg {
    gate: StargateLike;
    comp: SGDialCompLike;
}

interface EventData {
    payload: any[];
    resolve: () => void;
    reject: (err: any) => void;
    latch: Promise<void>;
}

export default class SGNetwork {
    private static targets: { [id: string]: TargetReg } = { };

    private static pendingEvents: { [fqlid: string]: EventData } = { };

    private static createDBEntry(id: string): boolean {
        if (!this.targets[id]) {
            this.targets[id] = { gate: null, comp: null };
            return true;
        }

        return false;
    }

    public static announceGate(gate: StargateLike) {
        const id = gate.fqlid;

        this.createDBEntry(id);
        this.targets[id].gate = gate;
        console.info(`Announcing gate for FQLID ${id}`);
    }

    public static deannounceGate(id: string) {
        if (!this.targets[id]) return;

        this.targets[id].gate = new StargateDespawned();

        console.info(`Removing gate for FQLID ${id}`);
    }

    public static registerDialComp(dial: SGDialCompLike) {
        const id = dial.fqlid;

        this.createDBEntry(id);
        this.targets[id].comp = dial;
        console.info(`Announcing dial computer for FQLID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.targets[id] && this.targets[id].gate;
    }

    public static getDialComp(id: string) {
        return this.targets[id] && this.targets[id].comp;
    }

    public static async sgAdmin(ws: WebSocket, data: ParameterSet) {
        const okAdmin = await SGNetwork.isAdminLevelReq(data);

        if (data.command === 'delete') {
            // FIXME: Rework web admin panel?
            // if (okAdmin) SGDB.deleteLocation(data.id as string);
            data.command = 'getlist';
        }

        if (data.command === 'getlist') {
            const result: SGDBLocationEntry[] = [ ];

            await SGDB.forEachLocation((val) => {
                result.push(val);
            });

            ws.send(JSON.stringify({ isAdmin: okAdmin, response: 'getlist', lines: result }));
        }
    }

    private static async isAdminLevelReq(data: ParameterSet) {
        const query = QueryString.parseUrl(data.url as string);
        const okAdmin = query.query.pw &&
            await SGDB.isAdmin(query.query.pw as string).then(() => true).catch(() => false);
        return okAdmin;
    }

    /*
     * Common entry points to sync the operations of source and target gates, irrespective of their target platform
     */

    public static async gatesLightChevron(srcFqlid: string, tgtFqlid: string, chevron: number, silent: boolean) {
        const srcGate = this.getGate(srcFqlid) || new StargateDespawned();
        const tgtGate = this.getGate(tgtFqlid) || new StargateDespawned();
        await srcGate.lightChevron(chevron, silent);
        tgtGate.lightChevron(chevron, silent);
    }

    public static async gatesConnect(srcFqlid: string, tgtFqlid: string) {
        const srcGate = this.getGate(srcFqlid) || new StargateDespawned();
        const tgtGate = this.getGate(tgtFqlid) || new StargateDespawned();
        srcGate.connect();
        tgtGate.connect();
    }

    public static async gatesDisconnect(srcFqlid: string, tgtFqlid: string, timestamp: number) {
        const srcGate = this.getGate(srcFqlid) || new StargateDespawned();
        const tgtGate = this.getGate(tgtFqlid) || new StargateDespawned();
        srcGate.disconnect(timestamp);
        tgtGate.disconnect(timestamp);
    }

    public static async gatesStartSequence(srcFqlid: string, tgtFqlid: string,
                                           tgtSequence: string, timestamp: number) {
        const srcGate = this.getGate(srcFqlid) || new StargateDespawned();
        const tgtGate = this.getGate(tgtFqlid) || new StargateDespawned();
        srcGate.startSequence(tgtFqlid, tgtSequence, timestamp);
        tgtGate.startSequence(srcFqlid, null, timestamp);
    }

    /**
     * Networked event handling
     */

    private static createEvent(fqlid: string) {
        if (!this.pendingEvents[fqlid]) {
            const evt: EventData = {
                payload: [ ],
                latch: null,
                resolve: null,
                reject: null
            };
            evt.latch = new Promise<void>((resolve, reject) => {
                evt.resolve = resolve;
                evt.reject = reject;
            });

            this.pendingEvents[fqlid] = evt;
        }
    }

    public static postEvent(fqlid: string, payload: any) {
        this.createEvent(fqlid);
        this.pendingEvents[fqlid].payload.push(payload);
        this.pendingEvents[fqlid].resolve();
    }

    public static waitEvent(fqlid: string, timeout: number): Promise<any[]> {
        this.createEvent(fqlid);
        const evt = this.pendingEvents[fqlid];

        if (evt.payload.length === 0) setTimeout(() => { if(evt.resolve) evt.resolve(); }, timeout);
        return evt.latch.then(() => {
            this.pendingEvents[fqlid] = undefined;
            return evt.payload;
        });
    }
}
