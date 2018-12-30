/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { SGDialCompLike, StargateDespawned, StargateLike } from "./sg_types";

import SHA1 from 'sha1';

import bigInt from 'big-integer';

interface ControlSockets {
    [id: string]: WebSocket;
}

interface TargetReg {
    location: string;
    lastid: 0;
    control: ControlSockets;
}

export default class SGNetwork {
    private static gates: { [id: string]: StargateLike } = { };
    private static targets: { [id: string]: TargetReg } = { };
    private static dialcomps: {  [id: string]: SGDialCompLike } = { };

    public static registerGate(id: string, gate: StargateLike) {
        this.gates[id] = gate;
        console.info(`Registering gate for ID ${id}`);
    }

    public static deregisterGate(id: string) {
        this.gates[id] = new StargateDespawned();

        if (this.targets[id] && this.targets[id].control) {
            // Close and deregister the control connections.
            Object.keys(this.targets[id].control).forEach(
                (key) => {
                    const ws = this.targets[id].control[key];
                    if (ws) ws.close();
                }
            );
            this.targets[id].control = { };
            this.targets[id].lastid = 0;
        }

        console.info(`Unregistering gate for ID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.gates[id];
    }

    public static registerTarget(id: string, loc: string, ws: WebSocket) {
        if (!id) id = this.getLocationId(loc);
        if (!this.targets[id]) this.targets[id] = { location: loc, lastid: 0, control: { } };

        const cid = this.targets[id].lastid++;

        this.targets[id].control[cid] = ws;
        console.info(`Registering portal endpoint for ID ${id} at location ${loc}, endpoint number ${cid}`);
    }

    public static getTarget(id: string): string {
        return this.targets[id] && this.targets[id].location;
    }

    public static getControlSockets(id: string): ControlSockets {
        return this.targets[id] && this.targets[id].control;
    }

    public static registerDialComp(id: string, dial: SGDialCompLike) {
        this.dialcomps[id] = dial;
        console.info(`Registering dial computer for ID ${id}`);
    }

    public static getDialComp(id: string) {
        return this.dialcomps[id];
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
}
