/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ParameterSet,
    Quaternion,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateStatus,
    InitStatus,
    StargateLike,
} from "./types";

import { delay } from "../helpers";
import SGNetwork from "./network";

import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";
import SGAddressing, { SGLocationData } from "./addressing";
import { SGDB } from "./database";
import SGLocator from "./locator";
import Applet from "../Applet";

export default abstract class Stargate extends Applet implements StargateLike {

    private whTimeout = 120; // 120 seconds until the wormhole shuts off. Cut it off by hitting 'a'.

    private initstatus = InitStatus.uninitialized;

    // tslint:disable:variable-name
    private _gateStatus: GateStatus = GateStatus.idle;
    private _gateFQLID: string;
    private _currentTargetFQLID: string;
    private _currentTargetSequence: string;
    private _currentDirection: boolean;
    private _connectionTimeStamp: number;
    // tslint:enable:variable-name

    private gateHorizon: Actor = null;
    private gateHorizonTeleporter: Actor = null;

    private gateHorizonOpening = 'artifact:1422743190183609048';
    private gateHorizonClosing = 'artifact:1422743203949314783';

    public get gateStatus() { return this._gateStatus; }
    public get fqlid() { return this._gateFQLID; }
    public get currentTargetFqlid() { return this._currentTargetFQLID; }
    public get currentTargetSequence() { return this._currentTargetSequence; }
    public get currentDirection() { return this._currentDirection; }
    public get currentTimeStamp() { return this._connectionTimeStamp; }
    public abstract get gateNumberBase(): number;

    private abortRequested = false;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
        this.context.onStarted(this.started);
        this.context.onStopped(this.stopped);
    }

    public registerGate(id: string) {
        this._gateFQLID = id;
        SGNetwork.announceGate(this);
    }

    /**
     * Report a status message back to the dialing computer
     * @param message status message
     */
    protected reportStatus(message: string) {
        const dial = SGNetwork.getDialComp(this.fqlid);
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
        console.debug(`Connection request by ${user.id} (${user.name}) from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        if (this.initstatus === InitStatus.initializing) {
            this.initstatus = InitStatus.initialized;

            SGLocator.lookupMeInAltspace(user, this.gateNumberBase).then(val => {
                this.registerGate(SGAddressing.fqlid(val.location, val.galaxy));
                if (val.lastseen !== 'unknown') {
                    SGDB.updateTimestamp(val.lid, val.gid);
                }
            });
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
        SGNetwork.deannounceGate(this.fqlid);
    }

    /**
     * Start the dialing up/incoming sequence
     * @param tgtFqlid Where to connect to
     */
    public async startSequence(tgtFqlid: string, tgtSequence: string, ts: number) {

        // Reject request if we're not in idle state
        if (this.gateStatus !== GateStatus.idle) return;

        this._gateStatus = GateStatus.dialing;
        this._connectionTimeStamp = ts;
        this._currentTargetFQLID = tgtFqlid;
        this._currentTargetSequence = tgtSequence;

        // true for incoming direction, they don't allow for reverse travel
        this._currentDirection = (tgtSequence === null);
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

        if (this.gateHorizon != null) this.gateHorizon.destroy();

        this.gateHorizon = this.context.CreateFromLibrary({
            resourceId: this.gateHorizonOpening,
            actor: {
                transform: {
                    local: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2) }
                }
            }
        });

        this.reportStatus(`${this.currentDirection ? 'Incoming w' : 'W'}ormhole active`);

        if (!this.currentDirection) {
            // Variables are evaluated when the closure is evaluated. Using this.currentTimeStamp
            // within the closure reads the *latest* timestamp at evaluation time, not the current one.
            const ts = this.currentTimeStamp;
            delay(this.whTimeout * 1000).then(() => this.timeOutGate(ts));

            SGAddressing.lookupDialedTarget(
                this.currentTargetSequence, this.gateNumberBase, 'altspace'
            ).then((result: SGLocationData) => {
                this.constructWormhole(result);
            }).catch((err) => {
                // Should never happen since the target location is checked before starting to dial.
                this.reportStatus('Error: Cannot establish wormhole - no endpoint');
                this.resetGate();
            });
        }
    }

    private constructWormhole(result: SGLocationData) {
        if (result.gid !== SGAddressing.getGalaxyDigit('altspace')) {
            console.debug('Cross realm transfer not yet supported');
        } else {
            this.gateHorizonTeleporter = this.context.CreateFromLibrary({
                resourceId: `Teleporter:${result.location}`,
                actor: {
                    parentId: this.gateHorizon.id,
                    transform: {
                        local: {
                            // Teleporter is a bit bugged and need an explicit PRS setting,
                            // else it spawns at (0,0,0), regardless of parenting.
                            position: { x: 0, y: 0.1, z: 0 },
                            rotation: Quaternion.RotationAxis(Vector3.Right(), 0),
                            scale: { x: 5.4, y: 0.01, z: 5.4 }
                        }
                    }
                }
            });
        }
    }

    /**
     * Time out a wormhole, only if it's not manually disconnected.
     */
    private timeOutGate(oldTs: number) {
        return SGNetwork.gatesDisconnect(
            this.fqlid, this.currentTargetFqlid, oldTs);
    }

    public async disconnect(oldTs: number) {

        // Stale request, discard
        if (this.currentTimeStamp !== oldTs) return;

        if (this.gateStatus === GateStatus.engaged) {
            if (this.gateHorizonTeleporter) {
                this.gateHorizonTeleporter.destroy();
                this.gateHorizonTeleporter = null;
            }

            if (this.gateHorizon != null) this.gateHorizon.destroy();

            this.gateHorizon = this.context.CreateFromLibrary({
                resourceId: this.gateHorizonClosing,
                actor: {
                    transform: {
                        local: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2) }
                    }
                }
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
            await SGNetwork.gatesLightChevron(
                this.fqlid,
                this.currentTargetFqlid,
                chevron++,
                false);
            direction = !direction;

            if (this.abortRequested) {
                return Promise.reject("Dialing sequence aborted");
            }
        }

        // And light up the remaining chevrons.
        for (chevron; chevron < 9; chevron++) {
            await SGNetwork.gatesLightChevron(
                this.fqlid, this.currentTargetFqlid, chevron, true);
        }
    }

    /**
     * Initiate dialing sequence and portal establishment.
     * @param sequence Number sequence to dial
     */
    public async startDialing(sequence: number[], timestamp: number) {
        SGAddressing.lookupDialedTarget(sequence, this.gateNumberBase, 'altspace').then(tgtLid => {
            const tgtFqlid = SGAddressing.fqlid(tgtLid.location, tgtLid.galaxy);

            SGNetwork.gatesStartSequence(
                this.fqlid,
                tgtFqlid,
                SGAddressing.toLetters(sequence),
                timestamp);

            this._gateStatus = GateStatus.dialing;
            this.dialSequence(sequence)
                .then(
                    () => SGNetwork.gatesConnect(this.fqlid, this.currentTargetFqlid)
                ).catch(
                    (reason) => {
                        SGNetwork.gatesDisconnect(
                            this.fqlid, this.currentTargetFqlid, this.currentTimeStamp);
                        this.reportStatus(reason);
                        this.resetGate();
                    }
                );
            this.reportStatus('Dialing...');
        }).catch((err: SGLocationData) => {
            this.reportStatus("Cannot dial target\nSequence doesn't match any known location.");
        });
    }

}
