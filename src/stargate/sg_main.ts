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

import QueryString from 'query-string';
import WebSocket from 'ws';
import DoorGuard from "../DoorGuard";

export default class Stargate extends StargateLike {

    private resourceBaseURL = `http://willneedit-mre.herokuapp.com/stargate`;
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
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronAngles: number[] = [ 240, 280, 320, 0, 40, 80, 120, 160, 200 ];

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

        // Try by ID and location, in this order
        if (!this.id && params.id) this._gateID = params.id as string;
        if (!this.id && params.location) this._gateID = SGNetwork.getLocationId(params.location as string);

        // Try by gate's session ID
        if (!this.id) this._gateID = SGNetwork.getIdBySessId(this.sessID);

        // Register if found, else wait for the A-Frame component to announce itself.
        if (this.id) SGNetwork.registerGate(this);
        else console.info('Neither ID nor Location given - deferring Stargate registration');
    }

    public registerGate(id: string) {
        if (!this.id) {
            this._gateID = id;
            SGNetwork.registerGate(this);
        } else if (this.id !== id) {
            console.error(`Gate: ID COLLISION: ${this.id} vs. retrieved ID ${id}`);
        }
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

        const chevronModel = Actor.CreateFromGLTF(this.context,
            {
                resourceUrl: (state
                    ? `${this.resourceBaseURL}/Chevron_lit.glb`
                    : `${this.resourceBaseURL}/Chevron_unlit.glb`),
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
        /* this.gateFrame = */
        Actor.CreateFromGLTF(this.context,
            {
                resourceUrl: `${this.resourceBaseURL}/Gate_Frame.glb`,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        this.gateRing = Actor.CreateFromGLTF(this.context,
            {
                resourceUrl: `${this.resourceBaseURL}/Gate_Ring.glb`,
                actor: {
                    name: 'Gate Ring'
                }
            }
        ).value;

        this.resetGate();

    }

    /**
     * Preload the assets.
     */
/*     public async loadAssets(): Promise<void> {

        const msg = new Message(this.context, 'Loading...');

        const gateFramePrefabs =
            this.context.assets.loadGltf('gateFrame', `${this.resourceBaseURL}/Gate_Frame.glb`);
        this.gateFramePrefabs = await gateFramePrefabs;

        const gateRingPrefabs =
            this.context.assets.loadGltf('gateRing', `${this.resourceBaseURL}/Gate_Ring.glb`);
        this.gateRingPrefabs = await gateRingPrefabs;

        const chevronLitPrefabs =
            this.context.assets.loadGltf('chevronlit', `${this.resourceBaseURL}/Chevron_lit.glb`);
        this.chevronLitPrefabs = await chevronLitPrefabs;

        const chevronUnlitPrefabs =
            this.context.assets.loadGltf('chevronunlit', `${this.resourceBaseURL}/Chevron_unlit.glb`);
        this.chevronUnlitPrefabs = await chevronUnlitPrefabs;

        msg.destroy();
    }
*/
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

        if (!SGNetwork.requestSession(this.sessID)) return;
        this.initGate();
    }

    private stopped = () => {
        if (this.gateStatus !== GateStatus.idle) {
            if (!this.currentDirection) {
                console.debug(`World with active gate falls empty, stopping gate operation`);
                this.timeOutGate();
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

        const loc = SGNetwork.getTarget(this.currentTarget);
        if (loc) {
            if (SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'engage', location: loc }))) {
                // Ignore the error code (this one and the other 180 :) ) from the target gate
                // saying it is already engaged with another connection
                this.reportStatus(`${this.currentDirection ? 'Incoming w' : 'W'}ormhole active`);
                if (!this.currentDirection) {
                    delay(this.whTimeout * 1000).then(
                        () => this.timeOutGate());
                }
                return;
            } else this.reportStatus('Error: Cannot establish wormhole - gate unpowered');
        } else this.reportStatus('Error: Cannot establish wormhole - no endpoint');
        this.resetGate();
    }

    /**
     * Time out a wormhole, only if it's not manually disconnected.
     */
    private timeOutGate() {
        return SGNetwork.controlGateOperation(
            this.id, this.currentTarget, GateOperation.disconnect, this.currentTimeStamp);
    }

    public async disconnect(oldTs: number) {

        // Stale request, discard
        if (this.currentTimeStamp !== oldTs) return;

        if (this.gateStatus === GateStatus.dialing) {
            // If it's incoming, reset. If it's outgoing, request to abort the dialing sequence.
            if (this.currentDirection) this.resetGate();
            else this.abortRequested = true;
        }

        if (this.gateStatus === GateStatus.engaged) {
            SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'disengage' }));
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

        await this.gateRing.createAnimation({animationName: 'rotation', keyframes: rotAnim, events: []});
        this.gateRing.startAnimation('rotation');
        await delay(rotAnim[rotAnim.length - 1].time * 1000 + 200);
        await this.gateRing.stopAnimation('rotation');

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
            SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'playsound', sound: 'turnGrind' }));
            await this.dialChevron(chevron, symbol, direction);
            direction = !direction;
            SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'playsound', sound: 'chevronLock' }));
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

    /**
     * Control connection endpoint as registered in dispatch.ts
     * @param {WebSocket} ws Endpoint for the portal in the enclosure
     * @param data Parameter (here: The init message)
     */
    public static control(ws: WebSocket, data: ParameterSet): void {

        const params = QueryString.parseUrl(data.url as string).query;
        const loc = (params.location || data.sid) as string;
        const id = (params.id || SGNetwork.getLocationId(loc)) as string;

        // Configure the size of the newly found portal endpoint: Currently it's echoing back its
        // own one.
        if (params.size) {
            const newSize = params.size as string;
            ws.send(JSON.stringify({
                command: 'size=',
                size: newSize
            }));
        }

        if (SGNetwork.registerTarget(id, loc, ws)) {
            // const mreUserName = `Player [${data.userName as string}]`;
            const mreUserName = data.userName as string;
            Stargate.doDeferredRegistration(mreUserName, id);
        }
    }

    private static async doDeferredRegistration(mreUserName: string, id: string, retry?: number) {
        if (!retry) retry = 1;

        // Server restarted, and maybe some stale connections from users who are already gone, give up.
        if (retry > 5) return;

        const userMeetup = SGNetwork.getInfoForUser(mreUserName);
        let again = false;
        if (userMeetup) {
            const gate = userMeetup.gate;
            if (gate) gate.registerGate(id);
            else again = true;

            const dcomp = userMeetup.comp;
            if (dcomp) dcomp.registerDC(id);
            else again = true;
        } else again = true;

        if (again) delay(1000).then(() => this.doDeferredRegistration(mreUserName, id, retry + 1 ));
    }
}
