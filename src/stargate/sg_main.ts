/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    Context,
    ParameterSet,
    Quaternion,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateOperation,
    GateStatus,
    InitStatus,
    StargateLike,
} from "./sg_types";

import { delay } from "../helpers";
import SGNetwork from "./sg_network";

import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

export default abstract class Stargate extends StargateLike {

    private whTimeout = 120; // 120 seconds until the wormhole shuts off. Cut it off by hitting 'a'.

    private initstatus = InitStatus.uninitialized;

    // tslint:disable:variable-name
    private _gateStatus: GateStatus = GateStatus.idle;
    private _gateID: string;
    private _currentTarget: string;
    private _currentDirection: boolean;
    private _connectionTimeStamp: number;
    // tslint:enable:variable-name

    private gateHorizon: Actor = null;
    private gateHorizonTeleporter: Actor = null;

    private gateHorizonOpening = 'artifact:1144997990889422905';
    private gateHorizonClosing = 'artifact:1144997995519934522';

    public get gateStatus() { return this._gateStatus; }
    public get id() { return this._gateID; }
    public get sessID() { return this.context.sessionId; }
    public get currentTarget() { return this._currentTarget; }
    public get currentDirection() { return this._currentDirection; }
    public get currentTimeStamp() { return this._connectionTimeStamp; }

    private abortRequested = false;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
        this.context.onStarted(this.started);
        this.context.onUserLeft((user: User) => SGNetwork.removeUser(user.name));
        this.context.onStopped(this.stopped);

        // Try by ID, then look up in database
        if (params.id) this.registerGate(params.id as string);
        else {
            SGNetwork.getIdBySessId(this.sessID).then((id: string) => {
                this.registerGate(id);
            }).catch(() => {
                console.info('No ID given, and Gate unregistered.');
            });
        }
    }

    public registerGate(id: string) {
        this._gateID = id;
        SGNetwork.registerGate(this);
    }

    /**
     * Report a status message back to the dialing computer
     * @param message status message
     */
    protected reportStatus(message: string) {
        const dial = SGNetwork.getDialComp(this.id);
        if (dial) dial.updateStatus(message);
    }

    /**
     * Reset the gate to its idle state. Overload with model reset
     */
    protected async resetGate(): Promise<void> {
        this._gateStatus = GateStatus.idle;
        this.abortRequested = false;
    }

    /**
     * Initialize the gate and set up the models.
     */
    protected abstract async initGate(): Promise<void>;

    private userjoined = (user: User) => {
        console.log(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        if (this.initstatus === InitStatus.initializing) {
            this.initstatus = InitStatus.initialized;

            SGNetwork.registerGateForUser(user.name, this);
        }
    }

    private started = () => {
        this.initstatus = InitStatus.initializing;

        this.initGate();
    }

    private stopped = () => {
        if (this.gateStatus !== GateStatus.idle) {
            // Hack: Set GateStatus to idle, so that we just deregister ourselves and fiddle with the
            // remote gate rather than trying to modify the gate status here and having hung requests.
            this._gateStatus = GateStatus.idle;

            if (!this.currentDirection) {
                console.debug(`World with active gate falls empty, stopping gate operation`);
                this.timeOutGate(this.currentTimeStamp);
            } else {
                console.debug("World with incoming gate falls empty. Deregistering gate, leaving operations untouched");
            }
        }
        SGNetwork.deregisterGate(this.id);
    }

    /**
     * Start the dialing up/incoming sequence
     * @param to Where to connect to
     */
    public async startSequence(to: string, ts: number, direction: boolean) {

        // Reject request if we're not in idle state
        if (this.gateStatus !== GateStatus.idle) return;

        this._gateStatus = GateStatus.dialing;
        this._connectionTimeStamp = ts;
        this._currentTarget = to;
        this._currentDirection = direction;
    }

    /**
     * Locks in the given chevron
     * @param index Number of Chevron (0-8)
     * @param direction true for incoming
     */
    public async lightChevron(index: number, silent: boolean) {

        // Reject request if we're not dialing
        if (this.gateStatus !== GateStatus.dialing) return;

        if (!silent) this.reportStatus(`${this.currentDirection ? 'Incoming! ' : ''} Chevron ${index + 1} locked in.`);
    }

    /**
     * Establishes a connection to the other side
     */
    public async connect() {
        if (this.gateStatus !== GateStatus.dialing) return;

        this._gateStatus = GateStatus.engaged;

        SGNetwork.getTarget(this.currentTarget).then((loc: string) => {
            this.context.CreateFromLibrary({
                resourceId: this.gateHorizonOpening,
                actor: {
                    transform: {
                        local: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2) }
                    }
                }
            }).then((gateHorizon) => {
                if (this.gateHorizon != null) this.gateHorizon.destroy();
                this.gateHorizon = gateHorizon;

                this.gateHorizonTeleporter = this.context.CreateFromLibrary({
                    resourceId: `Teleporter:${loc}`,
                    actor: {
                        parentId: gateHorizon.id,
                        transform: {
                            local: {
                                // Teleporter is a bit bugged and need an explicit PRS setting,
                                // else it spawns at (0,0,0), regardless of parenting.
                                position: { x: 0, y: 0, z: 0 },
                                rotation: Quaternion.RotationAxis(Vector3.Right(), 0),
                                scale: { x: 5.4, y: 0.01, z: 5.4 }
                            }
                        }
                    }
                }).value;
            });

            this.reportStatus(`${this.currentDirection ? 'Incoming w' : 'W'}ormhole active`);
            if (!this.currentDirection) {
                delay(this.whTimeout * 1000).then(
                    () => this.timeOutGate(this.currentTimeStamp));
            }
        }).catch((err) => {
            this.reportStatus('Error: Cannot establish wormhole - no endpoint');
            this.resetGate();
        });
    }

    /**
     * Time out a wormhole, only if it's not manually disconnected.
     */
    private timeOutGate(oldTs: number) {
        return SGNetwork.controlGateOperation(
            this.id, this.currentTarget, GateOperation.disconnect, oldTs);
    }

    public async disconnect(oldTs: number) {

        // Stale request, discard
        if (this.currentTimeStamp !== oldTs) return;

        if (this.gateStatus === GateStatus.engaged) {
            if (this.gateHorizonTeleporter) {
                this.gateHorizonTeleporter.destroy();
                this.gateHorizonTeleporter = null;
            }

            this.context.CreateFromLibrary({
                resourceId: this.gateHorizonClosing,
                actor: {
                    transform: {
                        local: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2) }
                    }
                }
            }).then((gateHorizon) => {
                if (this.gateHorizon != null) this.gateHorizon.destroy();
                this.gateHorizon = gateHorizon;
            });
        }

        if (this.gateStatus === GateStatus.dialing) {
            // If it's incoming, reset. If it's outgoing, request to abort the dialing sequence.
            if (this.currentDirection) this.resetGate();
            else this.abortRequested = true;
        }

        if (this.gateStatus === GateStatus.engaged) {
            this.reportStatus('Wormhole disengaged');
            this.resetGate();
        }
    }

    /**
     * Dials to one chevron. Overload with specific animation
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    protected abstract async dialChevron(chevron: number, symbol: number, dialDirection: boolean): Promise<void>;

    /**
     * Run the dialing sequence
     * @param {number[]} sequence Sequence to dial.
     */
    private async dialSequence(sequence: number[]): Promise<void> {
        let chevron = 0;
        let direction = true;

        // Dial up the sequence, alternating directions
        for (const symbol of sequence) {
            await this.dialChevron(chevron, symbol, direction);
            await SGNetwork.controlGateOperation(this.id, this.currentTarget, GateOperation.lightChevron, chevron++);
            direction = !direction;

            if (this.abortRequested) {
                return Promise.reject("Dialing sequence aborted");
            }
        }

        // And light up the remaining chevrons.
        for (chevron; chevron < 9; chevron++) {
            await SGNetwork.controlGateOperation(
                this.id, this.currentTarget, GateOperation.lightChevron, chevron, true);
        }
    }

    /**
     * Initiate dialing sequence and portal establishment.
     * @param sequence Number sequence to dial
     */
    public async startDialing(sequence: number[]) {
        SGNetwork.controlGateOperation(
            this.id,
            SGNetwork.stringifySequence(sequence),
            GateOperation.startSequence,
            (new Date().getTime() / 1000));

        this._gateStatus = GateStatus.dialing;
        this.dialSequence(sequence)
            .then(
                () => SGNetwork.controlGateOperation(this.id, this.currentTarget, GateOperation.connect, 0)
            ).catch(
                (reason) => {
                    SGNetwork.controlGateOperation(
                        this.id, this.currentTarget, GateOperation.disconnect, this.currentTimeStamp);
                    this.reportStatus(reason);
                    this.resetGate();
                }
            );
        this.reportStatus('Dialing...');
    }

}
