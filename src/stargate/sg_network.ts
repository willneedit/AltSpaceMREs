/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { SGDialCompLike, StargateDespawned, StargateLike } from "./sg_types";

import SHA1 from 'sha1';

import bigInt from 'big-integer';

interface TargetReg {
    location: string;
    control: WebSocket;
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
        console.info(`Unregistering gate for ID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.gates[id];
    }

    public static registerTarget(id: string, loc: string, ws: WebSocket) {
        // Explicitely close an old socket if we reload the space to free up resources
        const oldws = this.getControlSocket(id);
        if (oldws) {
            oldws.close();
        }

        if (!id) id = this.getLocationId(loc);

        this.targets[id] = { location: loc, control: ws };
        console.info(`Registering portal endpoint for ID ${id} at location ${loc}`);
    }

    public static getTarget(id: string): string {
        return this.targets[id] && this.targets[id].location;
    }

    public static getControlSocket(id: string): WebSocket {
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

        let lid = bigInt(sha1, 16);
        for (let i = 0; i < 6; i++) {
            const res = lid.divmod(38);
            seq.push(res.remainder.toJSNumber());
            lid = res.quotient;
        }

        // Point of Origin is always 0.
        seq.push(0);
        return seq;
    }

    public static getLocationId(location: string): string {
        const seq = this.getLocationIdSequence(location);
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

        let str = "";
        for (const key of seq) {
            if (key < 26) str = str + String.fromCharCode(key + lowerA);
            else str = str + String.fromCharCode(key - 26 + upperA);
        }

        return str;
    }
}
