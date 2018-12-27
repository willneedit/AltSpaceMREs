/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { StargateLike } from "./types";

export default class SGNetwork {
    private static gates: { [id: string]: StargateLike } = { };

    public static registerGate(id: string, gate: StargateLike) {
        this.gates[id] = gate;
        console.log(`Registering gate for ID ${id}`);
    }

    public static deregisterGate(id: string) {
        this.gates[id] = null;
        console.log(`Unregistering gate for ID ${id}`);
    }

    public static getGate(id: string): StargateLike {
        return this.gates[id];
    }
}
