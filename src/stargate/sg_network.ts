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

export default class SGNetwork {
    private static targets: { [id: string]: TargetReg } = { };
    private static userMeetup: { [id: string]: TargetReg } = { };

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

    public static registerGateForUser(user: string, gate: StargateLike) {
        if (!this.userMeetup[user]) this.userMeetup[user] = { gate: null, comp: null };

        this.userMeetup[user].gate = gate;
        console.info(`Deferred registration: Stargate found by ${user}`);
    }

    public static registerDCForUser(user: string, comp: SGDialCompLike) {
        if (!this.userMeetup[user]) this.userMeetup[user] = { gate: null, comp: null };

        this.userMeetup[user].comp = comp;
        console.info(`Deferred registration: Dialing computer found by ${user}`);
    }

    public static removeUser(user: string) {
        // Unhook old data when user leaves to avoid stale data messing things up when he transitions
        // to a new space with a stargate
        this.userMeetup[user] = { gate: null, comp: null };
    }

    public static getInfoForUser(user: string): TargetReg {
        return this.userMeetup[user];
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

    public static async sgRegisterInitResponse(
        ws: WebSocket,
        myuser: string,
        mysgid: string,
        mylocation: string,
        mystatus: string) {
        const userInfo = this.getInfoForUser(myuser);

        const getReg = async (sid: string): Promise<string> => {
            return this.getIdBySessId(sid).then((id: string) => id ).catch((err) => 'unregistered');
        };

        const sids = [ ];
        if (userInfo) {
            if (userInfo.gate) {
                const reg = await getReg(userInfo.gate.sessID);
                sids.push(`Gate: ${userInfo.gate.sessID} - ${reg}`);
            }
            if (userInfo.comp) {
                const reg = await getReg(userInfo.comp.sessID);
                sids.push(`Dial Computer: ${userInfo.comp.sessID} - ${reg}`);
            }
        }

        ws.send(JSON.stringify({
            objlist: sids,
            sgid: mysgid,
            location: mylocation,
            status: mystatus
        }));
    }

    public static async sgRegisterInit(ws: WebSocket, data: ParameterSet) {
        const mysgid = await SGDB.getLocationDataLoc(data.location as string)
            .then((value) => value.id)
            .catch(() => this.getLocationId(data.location as string));
        const okAdmin = await SGNetwork.isAdminLevelReq(data);

        SGNetwork.sgRegisterDisplayStatus(mysgid, ws, data);

        ws.send(JSON.stringify({
            response: 'init_response',
            isAdmin: okAdmin
        }));
    }

    private static sgRegisterDisplayStatus(mysgid: string, ws: WebSocket, data: ParameterSet) {
        SGDB.getLocationDataId(mysgid).then(
            (locdata) => this.sgRegisterInitResponse(
                ws, data.userName as string, locdata.id,
                locdata.location, locdata.locked ? 'locked' : 'unlocked')
        ).catch(
            (err) => this.sgRegisterInitResponse(
                ws, data.userName as string, mysgid, data.location as string, 'unregistered')
        );
    }

    public static async sgRegister(ws: WebSocket, data: ParameterSet) {
        const okAdmin = await SGNetwork.isAdminLevelReq(data);

        let mylocation = data.location && data.location as string;
        let mysgid = data.sgid as string;
        const customSgid = (data.custom_sgid as string) || '';
        if (okAdmin && customSgid !== '') mysgid = customSgid;

        const userInfo = this.getInfoForUser(data.userName as string);

        await SGDB.registerLocation(mysgid, mylocation);

        // Either read back the new entry or get the old one if the update was rejected
        const locdata = await SGDB.getLocationDataId(mysgid);
        mylocation = locdata.location;
        mysgid = locdata.id;

        if (userInfo && userInfo.gate) {
            SGDB.registerIdForSid(userInfo.gate.sessID, mylocation && mysgid);
            userInfo.gate.registerGate(mysgid);
        }

        if (userInfo && userInfo.comp) {
            SGDB.registerIdForSid(userInfo.comp.sessID, mylocation && mysgid);
            userInfo.comp.registerDC(mysgid);
        }

        this.sgRegisterDisplayStatus(mysgid, ws, data);

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
