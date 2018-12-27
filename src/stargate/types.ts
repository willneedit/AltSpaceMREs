/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import Applet from "../Applet";

// tslint:disable:max-classes-per-file
export enum GateStatus {
    idle,
    dialing,
    engaged
}

export abstract class StargateLike extends Applet {
    public abstract startDialing(sequence: number[]): void;
    public abstract get gateStatus(): GateStatus;
}
