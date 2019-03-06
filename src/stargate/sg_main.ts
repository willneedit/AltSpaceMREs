/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationKeyframe,
    Context,
    DegreesToRadians,
    ParameterSet,
    Quaternion,
    SoundInstance,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateOperation,
    GateStatus,
    InitStatus,
    StargateLike,
} from "./sg_types";

import { delay, initSound } from "../helpers";
import SGNetwork from "./sg_network";

import QueryString from 'query-string';
import WebSocket from 'ws';
import DoorGuard from "../DoorGuard";

export default class Stargate extends StargateLike {

    private whTimeout = 120; // 120 seconds until the wormhole shuts off. Cut it off by hitting 'a'.

    private initstatus = InitStatus.uninitialized;

    // tslint:disable:variable-name
    private _gateStatus: GateStatus = GateStatus.idle;
    private _gateID: string;
    private _currentTarget: string;
    private _currentDirection: boolean;
    private _connectionTimeStamp: number;
    // tslint:enable:variable-name

    private gateRing: Actor = null;
    private gateRingAngle = 0;
    private gateHorizon: Actor = null;
    private gateHorizonTeleporter: Actor = null;
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronAngles: number[] = [ 240, 280, 320, 0, 40, 80, 120, 160, 200 ];

    private gateFrameId = 'artifact:1144171771746845684';
    private gateRingId = 'artifact:1144171766839510003';
    private gateChevronLitId = 'artifact:1144171760086680562';
    private gateChevronUnlitId = 'artifact:1144171776629015542';

    private gateHorizonOpening = 'artifact:1144997990889422905';
    private gateHorizonClosing = 'artifact:1144997995519934522';

    private externBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/stargate';
    private soundChevronLockURL = `${this.externBaseURL}/SG_Chevron_lock.wav`;
    private soundGateTurningURL = `${this.externBaseURL}/SG_Turn_Grind.wav`;

    private soundChevronLock: SoundInstance = null;
    private soundGateTurning: SoundInstance = null;

    public get gateStatus() { return this._gateStatus; }
    public get id() { return this._gateID; }
    public get sessID() { return this.context.sessionId; }
    public get currentTarget() { return this._currentTarget; }
    public get currentDirection() { return this._currentDirection; }
    public get currentTimeStamp() { return this._connectionTimeStamp; }

    private abortRequested = false;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
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
    private reportStatus(message: string) {
        const dial = SGNetwork.getDialComp(this.id);
        if (dial) dial.updateStatus(message);
    }

    /**
     * Light up or switch off the given chevron
     * @param index No. of chevron (0-8)
     * @param state lit state
     */
    private async replaceChevron(index: number, state: boolean): Promise<void> {

        const oldChevron = this.gateChevrons[index];

        this.gateChevrons[index] = Actor.CreateEmpty(
            this.context,
            {
                actor: {
                    name: 'Gate Chevron ' + index,
                    transform: { rotation: Quaternion.RotationAxis(
                        Vector3.Forward(), this.chevronAngles[index] * DegreesToRadians) }
                }
            }).value;

        const chevronModel = Actor.CreateFromLibrary(this.context,
            {
                resourceId: (state ? this.gateChevronLitId : this.gateChevronUnlitId),
                actor: {
                    parentId: this.gateChevrons[index].id
                }
            });

        await chevronModel;

        if (oldChevron != null) oldChevron.destroy();
    }

    /**
     * Reset the gate to its idle state
     */
    private async resetGate(): Promise<void> {
        for (let i = 0; i < 9; ++i) {
            this.replaceChevron(i, false);
        }

        this._gateStatus = GateStatus.idle;
        this.abortRequested = false;
    }

    /**
     * Initialize the gate and set up the models.
     */
    private async initGate(): Promise<void> {
        Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.gateFrameId,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        this.gateRing = Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.gateRingId,
                actor: {
                    name: 'Gate Ring'
                }
            }
        ).value;

        this.soundGateTurning = initSound(this.gateRing, this.soundGateTurningURL, { looping: true }).value;
        this.soundChevronLock = initSound(this.gateRing, this.soundChevronLockURL).value;

        this.resetGate();

    }

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
     * Generate the rotation animation for the ring. Calculate the keyframes for the uniform
     * acceleration of the angular speed to a given max speed and its slowing down to a stop
     * at the target angle, then integrate over the speed to get the actual angle values
     * for the given time indices.
     *
     * Same as we'd done that on the good old C64 when smoothly moving sprites along a curve.
     * @param srcAngle Angle the ring rotates from
     * @param tgtAngle Angle the ring rotates to
     * @param direction Direction of rotation, true for counter-clockwise
     */
    private generateRotationKeyFrames(

        srcAngle: number, tgtAngle: number, direction: boolean): AnimationKeyframe[] {

        tgtAngle = tgtAngle % 360;
        srcAngle = srcAngle % 360;

        // Sort the angles in a linear fashion, according to the intended movement direction
        if (direction && tgtAngle < srcAngle) tgtAngle = tgtAngle + 360;

        if (!direction && tgtAngle > srcAngle) tgtAngle = tgtAngle - 360;
        const kf: AnimationKeyframe[] = [];

        // Take six seconds for a full revolution at full speed, calculate the time needed to travel the
        // given distance.
        const timescale = 3;
        const angularMaxSpeed = 360 / (6 * timescale); // Angular max speed in degrees/timescale of seconds
        const accelStep = angularMaxSpeed / timescale; // Number of timescale steps (one second) to get to top speed
        let currentAngularSpeed = 0;
        let lastAngularSpeed = 0;
        let accelDist = 0;
        let t = 0;
        const angleDistance = Math.abs(tgtAngle - srcAngle);
        for (let angle = 0; angle <= angleDistance; angle += currentAngularSpeed) {
            // The same distance we covered to accelerate we need to decelerate to a full stop
            if (angle + accelDist >= angleDistance) {
                currentAngularSpeed -= accelStep;
                if (currentAngularSpeed <= accelStep) currentAngularSpeed = accelStep;
            } else if (currentAngularSpeed + accelStep < angularMaxSpeed) {
                currentAngularSpeed += accelStep;
                accelDist = angle;
            }

            // Add a keyframe if the angular speed did change.
//            if (lastAngularSpeed !== currentAngularSpeed) {
            const rAngle = srcAngle + angle * (direction ? 1 : -1);
            const rot =  Quaternion.RotationAxis(Vector3.Forward(), rAngle * DegreesToRadians);
            kf.push({
                    time: t / timescale,
                    value: { transform: { rotation: rot } }
            });
//            }
            t++;

            lastAngularSpeed = currentAngularSpeed;
        }

        kf.push(
            {
                time: (t++) / timescale,
                value: { transform: {
                    rotation: Quaternion.RotationAxis(Vector3.Forward(), tgtAngle * DegreesToRadians)
                } }
            });

        return kf;
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

        await this.replaceChevron(index, true);
        await delay(1000);

        if (!silent) this.reportStatus(`${this.currentDirection ? 'Incoming! ' : ''} Chevron ${index + 1} locked in.`);
    }

    /**
     * Establishes a connection to the other side
     */
    public async connect() {
        if (this.gateStatus !== GateStatus.dialing) return;

        this._gateStatus = GateStatus.engaged;

        SGNetwork.getTarget(this.currentTarget).then((loc: string) => {
            Actor.CreateFromLibrary(this.context, {
                resourceId: this.gateHorizonOpening,
                actor: {
                    transform: {
                        rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2)
                    }
                }
            }).then((gateHorizon) => {
                if (this.gateHorizon != null) this.gateHorizon.destroy();
                this.gateHorizon = gateHorizon;

                this.gateHorizonTeleporter = Actor.CreateFromLibrary(this.context, {
                    resourceId: `Teleporter:${loc}`,
                    actor: {
                        parentId: gateHorizon.id,
                        transform: {
                            // Teleporter is a bit bugged and need an explicit PRS setting,
                            // else it spawns at (0,0,0), regardless of parenting.
                            position: { x: 0, y: 0, z: 0 },
                            rotation: Quaternion.RotationAxis(Vector3.Right(), 0),
                            scale: { x: 5.4, y: 0.01, z: 5.4 }
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

            Actor.CreateFromLibrary(this.context, {
                resourceId: this.gateHorizonClosing,
                actor: {
                    transform: {
                        rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI / 2)
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
     * Dials to one chevron.
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    private async dialChevron(chevron: number, symbol: number, dialDirection: boolean) {

        // target angle for the ring to show a specific symbol at a given chevron
        const tgtAngle = (this.chevronAngles[chevron] + (symbol * 360 / 39)) % 360;
        const srcAngle = this.gateRingAngle;

        const rotAnim = this.generateRotationKeyFrames(srcAngle, tgtAngle, dialDirection);

        await this.gateRing.createAnimation('rotation', {keyframes: rotAnim, events: []});
        this.gateRing.enableAnimation('rotation');
        await delay(rotAnim[rotAnim.length - 1].time * 1000 + 200);
        await this.gateRing.disableAnimation('rotation');

        this.gateRingAngle = tgtAngle;
    }

    /**
     * Run the dialing sequence
     * @param {number[]} sequence Sequence to dial.
     */
    private async dialSequence(sequence: number[]): Promise<void> {
        let chevron = 0;
        let direction = true;

        // Dial up the sequence, alternating directions
        for (const symbol of sequence) {
            this.soundGateTurning.resume();
            await this.dialChevron(chevron, symbol, direction);
            direction = !direction;
            this.soundGateTurning.pause();
            this.soundChevronLock.resume();
            await SGNetwork.controlGateOperation(this.id, this.currentTarget, GateOperation.lightChevron, chevron++);

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
