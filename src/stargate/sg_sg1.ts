/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    Keyframe,
    DegreesToRadians,
    MediaInstance,
    Quaternion,
    Vector3,
    ActorPath,
    AnimationEaseCurves,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateStatus,
} from "./types";

import { delay, initSound, restartSound } from "../helpers";

import Stargate from "./sg__main";

export default class StargateSG1 extends Stargate {

    private gateRing: Actor = null;
    private gateRingAngle = 0;
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronAngles: number[] = [ 240, 280, 320, 0, 40, 80, 120, 160, 200 ];

    private gateFrameId = 'artifact:1422743170000618191';
    private gateRingId = 'artifact:1422743156369130168';
    private gateChevronLitId = 'artifact:1422743149029098129';
    private gateChevronUnlitId = 'artifact:1422743183497888468';

    private externBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/stargate';

    private soundChevronLockURL = `${this.externBaseURL}/SG_Chevron_lock.wav`;
    private soundGateTurningURL = `${this.externBaseURL}/SG_Turn_Grind.wav`;
    private soundChevronLock: MediaInstance = null;
    private soundGateTurning: MediaInstance = null;

    public get gateNumberBase(): number { return 38; }

    /**
     * Light up or switch off the given chevron
     * @param index No. of chevron (0-8)
     * @param state lit state
     */
    private async replaceChevron(index: number, state: boolean): Promise<void> {

        const oldChevron = this.gateChevrons[index];

        this.gateChevrons[index] = this.context.CreateEmpty({
                actor: {
                    name: 'Gate Chevron ' + index,
                    transform: { local: { rotation: Quaternion.RotationAxis(
                        Vector3.Forward(), this.chevronAngles[index] * DegreesToRadians) } }
                }
            });

        const chevronModel = this.context.CreateFromLibrary({
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
    protected async resetGate(): Promise<void> {
        await super.resetGate();
        for (let i = 0; i < 9; ++i) {
            this.replaceChevron(i, false);
        }
    }

    /**
     * Initialize the gate and set up the models.
     */
    protected async initGate(): Promise<void> {
        this.context.CreateFromLibrary({
                resourceId: this.gateFrameId,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        this.gateRing = this.context.CreateFromLibrary({
                resourceId: this.gateRingId,
                actor: {
                    name: 'Gate Ring'
                }
            }
        );

        this.soundGateTurning = initSound(this.context.assets,
            this.gateRing,
            this.soundGateTurningURL,
            { looping: true });

        this.soundChevronLock = initSound(this.context.assets, this.gateRing, this.soundChevronLockURL);

        this.resetGate();

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
        srcAngle: number, tgtAngle: number, direction: boolean): Array<Keyframe<Quaternion> > {

        tgtAngle = tgtAngle % 360;
        srcAngle = srcAngle % 360;

        // Sort the angles in a linear fashion, according to the intended movement direction
        if (direction && tgtAngle < srcAngle) tgtAngle = tgtAngle + 360;

        if (!direction && tgtAngle > srcAngle) tgtAngle = tgtAngle - 360;
        const kf: Array<Keyframe<Quaternion> > = [];

        // Take six seconds for a full revolution at full speed, calculate the time needed to travel the
        // given distance.
        const timescale = 3;
        const angularMaxSpeed = 360 / (6 * timescale); // Angular max speed in degrees/timescale of seconds
        const accelStep = angularMaxSpeed / timescale; // Number of timescale steps (one second) to get to top speed
        let currentAngularSpeed = 0;
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

            const rAngle = srcAngle + angle * (direction ? 1 : -1);
            kf.push({
                    time: t / timescale,
                    value: Quaternion.RotationAxis(Vector3.Forward(), rAngle * DegreesToRadians)
            });
            t++;

        }

        kf.push(
            {
                time: (t++) / timescale,
                value: Quaternion.RotationAxis(Vector3.Forward(), tgtAngle * DegreesToRadians)
            });

        return kf;
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
        restartSound(this.soundChevronLock);
        await delay(1000);

        if (!silent) this.reportStatus(`${this.currentDirection ? 'Incoming! ' : ''} Chevron ${index + 1} locked in.`);
    }

    /**
     * Dials to one chevron.
     * @param chevron Chevron which needs to be locked in
     * @param symbol Symbol the chevron needs to be locked to
     * @param dialDirection Direction of the rotation
     */
    protected async dialChevron(chevron: number, symbol: number, dialDirection: boolean) {

        // target angle for the ring to show a specific symbol at a given chevron
        const tgtAngle = (this.chevronAngles[chevron] + (symbol * 360 / 39)) % 360;
        const srcAngle = this.gateRingAngle;

        const rotAnimData = this.context.assets.createAnimationData('rotation',{
            tracks: [{
                target: ActorPath('ring').transform.local.rotation,
                keyframes: this.generateRotationKeyFrames(srcAngle, tgtAngle, dialDirection),
                easing: AnimationEaseCurves.Linear
            }]
        });

        const rotAnim = await rotAnimData.bind({ ring: this.gateRing });
        rotAnim.play();
        this.soundGateTurning.resume();
        await rotAnim.finished();
        // await delay(rotAnimFrames[rotAnimFrames.length - 1].time * 1000 + 200);
        this.soundGateTurning.pause();

        rotAnim.delete();

        this.gateRingAngle = tgtAngle;
    }

}
