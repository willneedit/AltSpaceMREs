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
            else this._gateID = SGNetwork.getLocationId(params.location as string);

        SGNetwork.registerGate(this.id, this);
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

    private generateRotationKeyFrames(
        srcAngle: number, tgtAngle: number, direction: boolean): AnimationKeyframe[] {

        // Sort the angles in a linear fashion, according to the intended movement direction
        if (direction && tgtAngle < srcAngle) tgtAngle = tgtAngle + 360;

        if (!direction && tgtAngle > srcAngle) tgtAngle = tgtAngle - 360;

        // Take six seconds for a full revolution, calculate the time needed to travel the
        // given distance.
        let duration = 6 * (tgtAngle - srcAngle) / 360;
        if (duration < 0) duration = -duration;

        const angles = [
            srcAngle * 1.0 + tgtAngle * 0.0,
            srcAngle * 0.8 + tgtAngle * 0.2,
            srcAngle * 0.5 + tgtAngle * 0.5,
            srcAngle * 0.2 + tgtAngle * 0.8,
            srcAngle * 0.0 + tgtAngle * 1.0 ];

        const quats: Quaternion[] = [];

        let angle = 0;
        for (angle of angles) {
            quats.push(Quaternion.RotationAxis(Vector3.Forward(), angle * DegreesToRadians));
        }

        // Limit the spin up to one second from the start
        let spinupt = 0.3 * duration;
        if (spinupt > 1) spinupt = 1;

        // And the spin down to one second from the end
        let spindownt = 0.7 * duration;
        if (spindownt < duration - 1) spindownt = duration - 1;

        return [
            {
                time: 0.0 * duration,
                value: { transform: { rotation: quats[0] } }
            }, {
                time: spinupt,
                value: { transform: { rotation: quats[1] } }
            }, {
                time: 0.5 * duration,
                value: { transform: { rotation: quats[2] } }
            }, {
                time: spindownt,
                value: { transform: { rotation: quats[3] } }
            }, {
                time: 1.0 * duration,
                value: { transform: { rotation: quats[4] } }
            }
        ];
    }

    /**
     * Dials to one chevron and locks it in.
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    private async dialChevron(chevron: number, symbol: number, dialDirection: boolean) {

        // target angle for the ring to show a specific symbol at a given chevron
        const tgtAngle = this.chevronAngles[chevron] + (symbol * 360 / 39);
        const srcAngle = this.gateRingAngle;

        const rotAnim = this.generateRotationKeyFrames(srcAngle, tgtAngle, dialDirection);

        await this.gateRing.stopAnimation('rotation');
        await this.gateRing.createAnimation({animationName: 'rotation', keyframes: rotAnim, events: []});
        this.gateRing.startAnimation('rotation');
        await delay(rotAnim[4].time * 1000);

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
            this.reportStatus(`Chevron ${chevron} encoded`);

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

        const ws = SGNetwork.getControlSocket(this.id);
        if (ws) {
            ws.send(JSON.stringify({ command: 'disengage' }));
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
        const ws = SGNetwork.getControlSocket(this.id);
        const loc = SGNetwork.getTarget(tgtId);
        if (ws) {
            if (loc) {
                // Ignore the error code (this one and the other 180 :) ) from the target gate
                // saying it is already engaged with another connection
                ws.send(JSON.stringify({ command: 'engage', location: loc }));

                if (direction) {
                    this.reportStatus('Wormhole active');

                    const tgtGate = SGNetwork.getGate(tgtId);
                    if (tgtGate) tgtGate.engageIncoming(this.id);
                } else this.reportStatus('Incoming wormhole active');

                this.whCount++;
                this._gateStatus = GateStatus.engaged;
                delay(this.whTimeout * 1000).then(() => this.disengaging(this.whCount));
                return;
            } else this.reportStatus('Error: Cannot establish wormhole - no endpoint');
        } else this.reportStatus('Error: Cannot establish wormhole - gate unpowered');
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
        this.reportStatus(`Incoming! Chevron ${chevron} encoded`);
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
        const id = params.id as string;
        const loc = params.location as string;
        SGNetwork.registerTarget(id, loc, ws);
    }
}
