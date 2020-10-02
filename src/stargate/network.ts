/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { SGDialCompLike, StargateDespawned, StargateLike } from "./types";

import QueryString from 'query-string';

import { SGDB, SGDBLocationEntry } from './database';

import { ParameterSet } from '@microsoft/mixed-reality-extension-sdk';

interface TargetReg {
    gate: StargateLike;
    comp: SGDialCompLike;
}

export default class SGNetwork {
    private static targets: { [id: string]: TargetReg } = { };

    public static loadNetwork() {
        SGDB.init();
    }

    private static createDBEntry(id: string): boolean {
        if (!this.targets[id]) {
            this.targets[id] = { gate: null, comp: null };
            return true;
        }

        return false;
    }

    public static registerGate(gate: StargateLike) {
        const id = gate.fqlid;

        this.createDBEntry(id);
        this.targets[id].gate = gate;
        console.info(`Announcing gate for FQLID ${id}`);
    }

    public static deregisterGate(id: string) {
        if (!this.targets[id]) return;

        this.targets[id].gate = new StargateDespawned();

        console.info(`Removing gate for FQLID ${id}`);
    }

    public static registerDialComp(dial: SGDialCompLike) {
        const id = dial.fqlid;

        this.createDBEntry(id);
        this.targets[id].comp = dial;
        console.info(`Announcing dial computer for ID ${id}`);
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
            if (okAdmin) SGDB.deleteLocation(data.id as string);
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
}
