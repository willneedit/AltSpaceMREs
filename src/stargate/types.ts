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

export enum InitStatus {
    uninitialized,
    initializing,
    initialized
}

export abstract class StargateLike extends Applet {
    public abstract get gateStatus(): GateStatus;
    public abstract get gateNumberBase(): number;
    public abstract registerGate(id: string): void;

    public abstract startDialing(sequence: number[], timestamp: number): void;
    public abstract get fqlid(): string;
    public abstract get currentTargetFqlid(): string;
    public abstract get currentTargetSequence(): string;
    public abstract get currentDirection(): boolean;

    public abstract startSequence(tgtFqlid: string, tgtSequence: string, timestamp: number): void;
    public abstract lightChevron(index: number, silent: boolean): void;
    public abstract connect(): void;
    public abstract disconnect(oldTs: number): void;
}

export abstract class SGDialCompLike extends Applet {
    public abstract get DCNumberBase(): number;
    public abstract updateStatus(message: string): void;
    public abstract registerDC(fqlid: string, seq: string): void;
    public abstract get fqlid(): string;
}

export class StargateDespawned extends StargateLike {

    public get gateStatus(): GateStatus { return GateStatus.despawned; }
    public get gateNumberBase(): number { return 38; }
    public registerGate(id: string): void { }

    public startDialing(sequence: number[], timestamp: number): void { }
    public get fqlid(): string { return undefined; }
    public get sessID(): string { return undefined; }
    public get currentTargetFqlid() { return 'invalid-target'; }
    public get currentTargetSequence(): string { return 'invalid-target'; }
    public get currentDirection() { return false; }

    public startSequence(tgtFqlid: string, tgtSequence: string, timestamp: number) { }
    public lightChevron(index: number) { }
    public connect() { }
    public disconnect() { }
}
