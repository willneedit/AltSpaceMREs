/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import Applet from "../Applet";

// tslint:disable:max-classes-per-file
export enum GateStatus {
    idle,
    dialing,
    engaged,
    despawned
}

export abstract class StargateLike extends Applet {
    public abstract startDialing(sequence: number[]): void;
    public abstract get gateStatus(): GateStatus;
}

export abstract class SGDialCompLike extends Applet {
    public abstract updateStatus(message: string): void;
}

export class StargateDespawned extends StargateLike {
    public startDialing(sequence: number[]): void { }
    public get gateStatus(): GateStatus { return GateStatus.despawned; }
}
