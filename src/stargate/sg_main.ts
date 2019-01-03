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
    GateStatus,
    StargateLike,
} from "./sg_types";

import { delay } from "../helpers";
import SGNetwork from "./sg_network";

import QueryString from 'query-string';
import WebSocket from 'ws';

export default class Stargate extends StargateLike {

    private resourceBaseURL = 'https://willneedit.github.io/MRE/stargate';
    private whTimeout = 20; // 20 seconds until the wormhole shuts off

    private initialized = false;
    private whCount = 0;

    // tslint:disable:variable-name
    private _gateStatus: GateStatus = GateStatus.idle;
    private _gateID: string;
    // tslint:enable:variable-name

    private gateRing: Actor = null;
    private gateRingAngle = 0;
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronAngles: number[] = [ 240, 280, 320, 0, 40, 80, 120, 160, 200 ];

    public get gateStatus() { return this._gateStatus; }
    public get id() { return this._gateID; }

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
        this.context.onStopped(this.stopped);

        if (params.id) this._gateID = params.id as string;
            else if (params.location) this._gateID = SGNetwork.getLocationId(params.location as string);
            else console.info('Neither ID nor Location given - deferring Stargate registration');

        if (this.id) SGNetwork.registerGate(this.id, this);
    }

    public registerGate(id: string) {
        if (!this.id) {
            this._gateID = id;
            SGNetwork.registerGate(this.id, this);
        } else if (this.id !== id) console.info(`Gate alread registered with ID ${id}`);
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
        if (!this.initialized) SGNetwork.registerGateForUser(user.name, this);
        this.started();
    }

    private started = () => {
        if (this.initialized) return;

        this.initialized = true;

        // this.loadAssets().then(() => this.initGate());
        this.initGate();
    }

    private stopped = () => {
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
            if (lastAngularSpeed !== currentAngularSpeed) {
                const rAngle = srcAngle + angle * (direction ? 1 : -1);
                const rot =  Quaternion.RotationAxis(Vector3.Forward(), rAngle * DegreesToRadians);
                kf.push({
                        time: t / timescale,
                        value: { transform: { rotation: rot } }
                });
            }
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
     * Dials to one chevron and locks it in.
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    private async dialChevron(chevron: number, symbol: number, dialDirection: boolean) {

        // target angle for the ring to show a specific symbol at a given chevron
        const tgtAngle = (this.chevronAngles[chevron] + (symbol * 360 / 39));
        const srcAngle = this.gateRingAngle;

        const rotAnim = this.generateRotationKeyFrames(srcAngle, tgtAngle, dialDirection);

        await this.gateRing.stopAnimation('rotation');
        await this.gateRing.createAnimation({animationName: 'rotation', keyframes: rotAnim, events: []});
        this.gateRing.startAnimation('rotation');
        await delay(rotAnim[rotAnim.length - 1].time * 1000);

        this.gateRingAngle = tgtAngle;
        await this.replaceChevron(chevron, true);
        await delay(1000);
    }

    /**
     * Run the dialing sequence
     * @param {number[]} sequence Sequence to dial.
     */
    private async dialSequence(sequence: number[]): Promise<void> {
        let chevron = 0;
        let direction = true;
        const tgtId = SGNetwork.stringifySequence(sequence);

        // Dial up the sequence, alternating directions
        for (const symbol of sequence) {
            await this.dialChevron(chevron, symbol, direction);
            direction = !direction;
            chevron++;
            this.reportStatus(`Chevron ${chevron} locked in`);

            const tgtGate = SGNetwork.getGate(tgtId);
            if (tgtGate) tgtGate.lightIncoming(chevron);
        }

        // And light up the remaining chevrons.
        for (chevron; chevron < 9; chevron++) {
            this.replaceChevron(chevron, true);

            const tgtGate = SGNetwork.getGate(tgtId);
            if (tgtGate) tgtGate.lightIncoming(chevron);
        }
    }

    /**
     * Disengage the wormhole connection and reset the gate to its idle state
     */
    private disengaging = async (disengageWh: number) => {
        // If we come here because of an outdated timeout, disregard this request.
        if (disengageWh !== 0 && disengageWh !== this.whCount) return;
        if (this.gateStatus !== GateStatus.engaged) return;

        if (SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'disengage' }))) {
            this.reportStatus('Wormhole disengaged');
        }
        this.resetGate();
    }

    /**
     * Dial sequence finished, try to establish connection.
     * Report errors to the dialing device if it failed.
     * @param tgtId ID to connect to
     * @param direction true for outgoing connections, false otherwise
     */
    private engaging = async (tgtId: string, direction: boolean) => {
        const loc = SGNetwork.getTarget(tgtId);
        if (loc) {
            if (SGNetwork.emitPortalControlMsg(this.id, JSON.stringify({ command: 'engage', location: loc }))) {
                // Ignore the error code (this one and the other 180 :) ) from the target gate
                // saying it is already engaged with another connection
                if (direction) {
                    this.reportStatus('Wormhole active');

                    const tgtGate = SGNetwork.getGate(tgtId);
                    if (tgtGate) tgtGate.engageIncoming(this.id);
                } else this.reportStatus('Incoming wormhole active');

                this.whCount++;
                this._gateStatus = GateStatus.engaged;
                delay(this.whTimeout * 1000).then(() => this.disengaging(this.whCount));
                return;
            } else this.reportStatus('Error: Cannot establish wormhole - gate unpowered');
        } else this.reportStatus('Error: Cannot establish wormhole - no endpoint');
        this.resetGate();
    }

    /**
     * Initiate dialing sequence and portal establishment.
     * @param sequence Number sequence to dial
     */
    public async startDialing(sequence: number[]) {
        this._gateStatus = GateStatus.dialing;
        this.dialSequence(sequence).then(
            () => this.engaging(SGNetwork.stringifySequence(sequence), true)
        );
        this.reportStatus('Dialing...');
    }

    /**
     * Incoming connection: Light up the given chevron, place a status message
     * @param {number} chevron Chevron to light up
     */
    public async lightIncoming(chevron: number) {
        if (this.gateStatus === GateStatus.idle) this._gateStatus = GateStatus.incoming;

        if (this.gateStatus !== GateStatus.incoming) return;
        this.replaceChevron(chevron, true);
        this.reportStatus(`Incoming! Chevron ${chevron} locked in`);
    }

    /**
     * Incoming connection: Establish the portal
     * @param {string} srcId Where the connection comes from
     */
    public async engageIncoming(srcId: string) {
        if (this.gateStatus !== GateStatus.incoming) return;

        this.engaging(srcId, false);
    }

    /**
     * Outside call (from Dial Device) to disengage the wormhole.
     */
    public async disengage() {
        this.disengaging(0);
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
        SGNetwork.registerTarget(id, loc, ws);

        const mreUserName = `Player [${data.userName as string}]`;
        Stargate.doDeferredRegistration(mreUserName, id);
    }

    private static async doDeferredRegistration(mreUserName: string, id: string, retry?: number) {
        if (!retry) retry = 1;

        // Server restarted, and maybe some stale connections from users who are already gone, give up.
        if (retry > 10) return;

        const userMeetup = SGNetwork.getInfoForUser(mreUserName);
        let again = false;
        if (userMeetup) {
            const gate = userMeetup.gate;
            if (!gate) {
                again = true;
                console.debug(`Data yet incomplete: Gate should already be pre-registered for ${mreUserName}`);
            } else gate.registerGate(id);
            const dcomp = userMeetup.comp;
            if (!dcomp) {
                again = true;
                console.debug(`Data yet incomplete: Dial Computer should already be pre-registered for ${mreUserName}`);
            } else dcomp.registerDC(id);
        } else {
            again = true;
            console.debug(`Data yet incomplete: No info retrievable for ${mreUserName}`);
        }

        if (again) delay(1000).then(() => this.doDeferredRegistration(mreUserName, id, retry + 1 ));
    }
}
