/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import WebSocket from 'ws';
import { SGDialCompLike, StargateDespawned, StargateLike } from "./types";

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
}
