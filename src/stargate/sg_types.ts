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

export enum GateOperation {
    startSequence,
    lightChevron,
    connect,
    disconnect
}

export enum InitStatus {
    uninitialized,
    initializing,
    initialized
}

export abstract class StargateLike extends Applet {
    public abstract startDialing(sequence: number[]): void;
    public abstract get gateStatus(): GateStatus;
    public abstract registerGate(id: string): void;
    public abstract get id(): string;
    public abstract get currentTarget(): string;
    public abstract get currentDirection(): boolean;

    public abstract startSequence(to: string, timestamp: number, direction: boolean): void;
    public abstract lightChevron(index: number, silent: boolean): void;
    public abstract connect(): void;
    public abstract disconnect(oldTs: number): void;
}

export abstract class SGDialCompLike extends Applet {
    public abstract updateStatus(message: string): void;
    public abstract registerDC(id: string): void;
    public abstract get id(): string;
}

export class StargateDespawned extends StargateLike {
    public startDialing(sequence: number[]): void { }

    public get gateStatus(): GateStatus { return GateStatus.despawned; }
    public registerGate(id: string): void { }
    public get id(): string { return undefined; }
    public get sessID(): string { return undefined; }
    public get currentTarget() { return 'invalid-target'; }
    public get currentDirection() { return false; }

    public startSequence(to: string, timestamp: number, direction: boolean) { }
    public lightChevron(index: number) { }
    public connect() { }
    public disconnect() { }
}
