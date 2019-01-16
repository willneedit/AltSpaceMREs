/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { GateOperation, SGDialCompLike, StargateDespawned, StargateLike } from "./sg_types";

import SHA1 from 'sha1';

import bigInt from 'big-integer';
import FS from 'fs';
import { SGDB } from './sg_database';

interface ControlSockets {
    [id: string]: WebSocket;
}

interface TargetReg {
    gate: StargateLike;
    comp: SGDialCompLike;
    location: string;
    locked: boolean;
    lastcid: 0;
    control: ControlSockets;
}

interface UserMeetup {
    gate: StargateLike;
    comp: SGDialCompLike;
}

interface SpamEntry {
    timestamp: number;
    count: number;
}
export default class SGNetwork {
    private static targets: { [id: string]: TargetReg } = { };
    private static userMeetup: { [id: string]: UserMeetup } = { };
    private static sessionIDs: { [sessId: string]: string } = { };
    private static sessIDTimeouts: { [sessId: string]: SpamEntry } = { };

    private static nextUpdate = 0;
    private static updateInterval = 60;

    public static requestSession(sessId: string): boolean {
        return true;

        const current = new Date().getTime() / 1000;

        if (!this.sessIDTimeouts[sessId]) {
            this.sessIDTimeouts[sessId] = { timestamp: current, count: 1 };
            return true;
        }

        // Past timeout, remove entry, everything's good
        if (current > this.sessIDTimeouts[sessId].timestamp + 30) {
            this.sessIDTimeouts[sessId] = undefined;
            return true;
        }

        // Flood protection: Deny if 10 or more requests accumulated,
        // reset counter if 30 seconds have passed without incident.
        this.sessIDTimeouts[sessId].timestamp = current;

        if (this.sessIDTimeouts[sessId].count++ < 10) return true;

        return false;
    }

    private static async doUpdate() {
        const list: { [id: string]: string } = { };

        for (const key in this.targets) {
            if (SGNetwork.targets.hasOwnProperty(key)) {
                list[key] = this.targets[key].location;
            }
        }

        FS.writeFile('public/SGNetwork.json',
            JSON.stringify(list), (err) => {
                if (!err) {
                    console.log(`Portal network saved.`);
                }
            }
        );
    }

    private static scheduleUpdate() {
        // Aim for one minute after this trigger.
        const proposed = Math.round((new Date()).getTime() / 1000) + this.updateInterval;

        // Do not schedule an update if it'd be still too soon after the next pending one.
        if (proposed < this.nextUpdate + this.updateInterval) return;

        this.nextUpdate = proposed;
        setTimeout(() => this.doUpdate(), this.updateInterval * 1000);
    }

    public static bootstrapNetwork(data: Buffer) {
        // Try to cope with the file's data....
        try {
            const list = JSON.parse(data.toString());

            for (const key in list) {
                if (list.hasOwnProperty(key)) this.registerTarget(key, list[key]);
            }

        } catch (e) {
            console.error(`Error encountered in SG Bootstrap data, message: ${e.message}`);
        }

        // ... and then add the database data on top of it.
        SGDB.registerLocationList((id: string, location: string, locked: boolean) => {
            const res = SGNetwork.createDBEntry(id);
            if (this.targets[id].location !== location) {
                console.log(`Updating portal endpoint for ID ${id} to location ${location}`);
            }
            this.targets[id].location = location;
            this.targets[id].locked = locked;
        });
    }

    public static loadNetwork() {
        SGDB.init().then(() => {
            FS.readFile('public/SGNetwork.json', (err, data) => {
                if (err) console.log(`Cannot read stargate network bootstrap info.`);
                else this.bootstrapNetwork(data);
            });
        });
    }

    private static createDBEntry(id: string): boolean {
        if (!this.targets[id]) {
            this.targets[id] = { location: null, locked: false, lastcid: 0, control: {}, gate: null, comp: null };
            return true;
        }

        return false;
    }

    public static registerGate(gate: StargateLike) {
        const id = gate.id;
        const sessid = gate.sessID;

        SGNetwork.createDBEntry(id);

        this.targets[id].gate = gate;
        this.sessionIDs[sessid] = id;
        console.info(`Registering gate for ID ${id}`);
    }

    public static deregisterGate(id: string) {
        if (!this.targets[id]) return;

        this.targets[id].gate = new StargateDespawned();

        if (this.targets[id] && this.targets[id].control) {
            // Close and deregister the control connections.
            Object.keys(this.targets[id].control).forEach(
                (key) => {
                    const ws = this.targets[id].control[key];
                    if (ws) ws.close();
                }
            );
            this.targets[id].control = { };
            this.targets[id].lastcid = 0;
        }

        console.info(`Unregistering gate for ID ${id}`);
    }

    public static registerTarget(id: string, loc: string, ws?: WebSocket): boolean {
        const res = SGNetwork.createDBEntry(id);

        const oldloc = this.targets[id].location;

        if (oldloc !== loc && this.targets[id].locked) {
            console.error(`Registering of new location ${loc} on ${id} DENIED -- location locked to ${oldloc}`);
            return false;
        }

        this.targets[id].location = loc;

        if (ws) {
            const cid = this.targets[id].lastcid++;

            this.targets[id].control[cid] = ws;
            console.info(`Registering portal endpoint for ID ${id} at location ${loc}, endpoint number ${cid}`);

            // This is a new one rather than a reload, schedule an update.
            // this.scheduleUpdate();
            if (loc !== oldloc) SGDB.updateLocation(id, loc);
        } else console.info(`Registering portal endpoint for ID ${id} at location ${loc}`);

        return true;
    }

    public static registerDialComp(dial: SGDialCompLike) {
        const id = dial.id;
        const sessid = dial.sessID;

        SGNetwork.createDBEntry(id);

        this.targets[id].comp = dial;
        this.sessionIDs[sessid] = id;
        console.info(`Registering dial computer for ID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.targets[id] && this.targets[id].gate;
    }

    public static getTarget(id: string): string {
        return this.targets[id] && this.targets[id].location;
    }

    public static getDialComp(id: string) {
        return this.targets[id] && this.targets[id].comp;
    }

    public static getControlSockets(id: string): ControlSockets {
        return this.targets[id] && this.targets[id].control;
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

    public static registerGateForUser(user: string, gate: StargateLike) {
        if (!this.userMeetup[user]) this.userMeetup[user] = { gate: null, comp: null };
        if (!this.userMeetup[user].gate) {
            this.userMeetup[user].gate = gate;
            console.info(`Deferred registration: Stargate found by ${user}`);
        }
    }

    public static registerDCForUser(user: string, comp: SGDialCompLike) {
        if (!this.userMeetup[user]) this.userMeetup[user] = { gate: null, comp: null };
        if (!this.userMeetup[user].comp) {
            this.userMeetup[user].comp = comp;
            console.info(`Deferred registration: Dialing computer found by ${user}`);
        }
    }

    public static removeUser(user: string) {
        // Unhook old data when user leaves to avoid stale data messing things up when he transitions
        // to a new space with a stargate
        this.userMeetup[user] = { gate: null, comp: null };
    }

    public static getInfoForUser(user: string): UserMeetup {
        return this.userMeetup[user];
    }

    public static getIdBySessId(sessid: string) {
        return this.sessionIDs[sessid];
    }

    public static getLocationId(location: string): string {
        const seq = this.getLocationIdSequence(location);
        return this.stringifySequence(seq);
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

    public static emitPortalControlMsg(id: string, msg: string): boolean {
        const css = SGNetwork.getControlSockets(id);

        if (!css) return false;

        // Broadcast the control message, remove stale sockets from list (from clients of users who have left)
        Object.keys(css).forEach(
            (key) => {
                if (css[key]) {
                    css[key].send(msg, (err) => {
                        if (err) {
                            this.targets[id].control[key] = null;
                            console.info(`Removed stale endpoint for ID ${id}, endpoint number ${key}`);
                        }
                    });
                }
            }
        );

        return true;
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
