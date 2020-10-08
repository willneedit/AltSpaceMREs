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

export interface StargateLike {
    readonly gateStatus: GateStatus;
    readonly gateNumberBase: number;
    readonly fqlid: string;
    readonly currentTargetFqlid: string;
    readonly currentTargetSequence: string;
    readonly currentDirection: boolean;
    readonly currentTimeStamp: number;

    registerGate(id: string): void;
    startDialing(sequence: number[], timestamp: number): Promise<void>;
    startSequence(tgtFqlid: string, tgtSequence: string, timestamp: number): void;
    lightChevron(index: number, silent: boolean): void;
    connect(): void;
    disconnect(oldTs: number): void;
}

export interface SGDialCompLike {
    readonly DCNumberBase: number;
    readonly fqlid: string;

    updateStatus(message: string): void;
    registerDC(fqlid: string): void;
}

export class StargateDespawned implements StargateLike {

    public get gateStatus(): GateStatus { return GateStatus.despawned; }
    public get gateNumberBase(): number { return 38; }
    public registerGate(id: string): void { }

    public async startDialing(sequence: number[], timestamp: number): Promise<void> { }
    public get fqlid(): string { return undefined; }
    public get currentTargetFqlid() { return 'invalid-target'; }
    public get currentTargetSequence(): string { return 'invalid-target'; }
    public get currentDirection() { return false; }
    public get currentTimeStamp() { return 0; }

    public startSequence(tgtFqlid: string, tgtSequence: string, timestamp: number) { }
    public lightChevron(index: number) { }
    public connect() { }
    public disconnect() { }
}
