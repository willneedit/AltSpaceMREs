/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { GateOperation, SGDialCompLike, StargateDespawned, StargateLike } from "./sg_types";

import SHA1 from 'sha1';

import bigInt from 'big-integer';

import QueryString from 'query-string';

import { SGDB, SGDBLocationEntry } from './sg_database';

import { ParameterSet } from '@microsoft/mixed-reality-extension-sdk';

interface TargetReg {
    gate: StargateLike;
    comp: SGDialCompLike;
}

interface MeetupInfo {
    id: string;
    gate?: StargateLike;
    comp?: SGDialCompLike;
}

export default class SGNetwork {
    private static targets: { [id: string]: TargetReg } = { };
    private static meetupInfo: { [id: string]: TargetReg } = { };

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
        const id = gate.id;

        SGNetwork.createDBEntry(id);

        this.targets[id].gate = gate;
        console.info(`Announcing gate for ID ${id}`);
    }

    public static deregisterGate(id: string) {
        if (!this.targets[id]) return;

        this.targets[id].gate = new StargateDespawned();

        console.info(`Removing gate for ID ${id}`);
    }

    public static registerDialComp(dial: SGDialCompLike) {
        const id = dial.id;

        SGNetwork.createDBEntry(id);

        this.targets[id].comp = dial;
        console.info(`Announcing dial computer for ID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.targets[id] && this.targets[id].gate;
    }

    public static getDialComp(id: string) {
        return this.targets[id] && this.targets[id].comp;
    }

    public static async getTarget(id: string): Promise<string> {
        return SGDB.getLocationDataId(id).then((res: SGDBLocationEntry) => {
            return res.location;
        });
    }

    public static meetup({ id, gate, comp }: MeetupInfo) {
        if (!this.meetupInfo[id]) this.meetupInfo[id] = { gate: null, comp: null };

        if (gate) {
            this.meetupInfo[id].gate = gate;
            console.info(`Deferred registration: Stargate found by ${id}`);
        }

        if (comp) {
            this.meetupInfo[id].comp = comp;
            console.info(`Deferred registration: Dialing computer found by ${id}`);
        }
    }

    public static removeMeetup(id: string) {
        // Unhook old data when user leaves to avoid stale data messing things up when he transitions
        // to a new space with a stargate
        this.meetupInfo[id] = { gate: null, comp: null };
    }

    public static getMeetupInfo(id: string): TargetReg {
        return this.meetupInfo[id];
    }

    public static async getIdBySessId(sessid: string) {
        return SGDB.getIdForSid(sessid);
    }

    public static getLocationIdSequence(location: string): number[] {
        const seq: number[] = [];
        const sha1 = SHA1(location) as string;

        // Coordinate sequence is one of the 39 symbols, except the origin symbol at 0
        let lid = bigInt(sha1, 16);
        for (let i = 0; i < 6; i++) {
            const res = lid.divmod(38);
            seq.push(res.remainder.toJSNumber() + 1);
            lid = res.quotient;
        }

        // Point of Origin is always 0.
        seq.push(0);
        return seq;
    }

    public static stringifySequence(sequence: number[]): string {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

        let str = "";
        for (const key of sequence) {
            if (key < 26) str = str + String.fromCharCode(key + lowerA);
            else str = str + String.fromCharCode(key - 26 + upperA);
        }

        return str;
    }

    public static getLocationId(location: string): string {
        const seq = this.getLocationIdSequence(location);
        return this.stringifySequence(seq);
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

    public static async controlGateOperation(
        srcId: string, tgtId: string, command: GateOperation, index: number, silent?: boolean) {
        const srcGate = this.getGate(srcId) || new StargateDespawned();
        const tgtGate = this.getGate(tgtId) || new StargateDespawned();

        if (command === GateOperation.startSequence) {
            srcGate.startSequence(tgtId, index, false);
            tgtGate.startSequence(srcId, index, true);
        } else if (command === GateOperation.lightChevron) {
            await srcGate.lightChevron(index, silent);
            tgtGate.lightChevron(index, silent);
        } else if (command === GateOperation.connect) {
            srcGate.connect();
            tgtGate.connect();
        } else if (command === GateOperation.disconnect) {
            srcGate.disconnect(index);
            tgtGate.disconnect(index);
        }
    }
}
