/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationEaseCurves,
    DegreesToRadians,
    Quaternion,
    SoundInstance,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateStatus,
} from "./sg_types";

import { delay, destroyActors, initSound, restartSound } from "../helpers";

import Stargate from "./sg_main";

interface ChevronData {
    x: number;
    y: number;
    pitch: number;
    actor: Actor;
    si: SoundInstance;
}

export default class StargateElven extends Stargate {

    private chevronData: ChevronData[] = [
        { x:  2.8, y:  2.5, pitch:   0, actor: null, si: null }, // a1
        { x: -2.8, y:  2.5, pitch:  12, actor: null, si: null }, // a2
        { x:  2.3, y:  3.0, pitch:   4, actor: null, si: null }, // c#1
        { x: -2.3, y:  3.0, pitch:  16, actor: null, si: null }, // c#2
        { x:  1.7, y:  3.4, pitch:   7, actor: null, si: null }, // e1
        { x: -1.7, y:  3.4, pitch:  19, actor: null, si: null }, // e2
        { x:  2.8, y: -2.5, pitch:  11, actor: null, si: null }, // g#1
        { x: -2.8, y: -2.5, pitch:  23, actor: null, si: null }, // g#2
        { x:  0.0, y:  3.7, pitch: -12, actor: null, si: null }  // a0
    ];

    private externBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/stargate';
    private soundChevronLockURL = `${this.externBaseURL}/SG_Elven_Chevron_Bell.wav`;
    private soundDialChimeURL = `${this.externBaseURL}/SG_Elven_DialChime.wav`;

    private gateFrameId = 'artifact:1159527056246047334';
    private chevronLightId = 'artifact:1160112871800046491';
    private symbolLightId = 'artifact:1160112866473280299';

    private gateFrame: Actor = null;
    private symbolRingLights: Actor[] = [ ];
    private soundDialChime: SoundInstance = null;
    private gateRingAngle = 0;

    /**
     * Light up or switch off the given chevron
     * @param index No. of chevron (0-8)
     * @param state lit state
     */
    private async replaceChevron(index: number, state: boolean): Promise<void> {

        if (!state && this.chevronData[index].actor) {
            this.chevronData[index].actor.destroy();
            this.chevronData[index].actor = null;
        } else if (state && !this.chevronData[index].actor) {
            const chevronActor = await Actor.CreateFromLibrary(this.context, {
                resourceId: this.chevronLightId,
                actor: {
                    transform: {
                        position: {
                            x: this.chevronData[index].x,
                            y: this.chevronData[index].y,
                            z: 0
                        },
                        scale: {
                            x: 0.3,
                            y: 0.3,
                            z: 0.3
                        }
                    }
                }
            });

            this.chevronData[index].actor = chevronActor;
        }
    }

    /**
     * Reset the gate to its idle state
     */
    protected async resetGate(): Promise<void> {
        await super.resetGate();
        for (let i = 0; i < 9; ++i) {
            this.replaceChevron(i, false);
        }

        destroyActors(this.symbolRingLights);
        this.symbolRingLights = [ ];

        this.gateRingAngle = 0;
    }

    /**
     * Initialize the gate and set up the models.
     */
    protected async initGate(): Promise<void> {
        this.gateFrame = await Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.gateFrameId,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        for (let i = 0; i < 9; i++) {
            this.chevronData[i].si = initSound(this.gateFrame, this.soundChevronLockURL, {
                pitch: this.chevronData[i].pitch
            }).value;
        }

        this.soundDialChime = initSound(this.gateFrame, this.soundDialChimeURL, { looping: true }).value;

        this.resetGate();

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
        restartSound(this.chevronData[index].si, {
            pitch: this.chevronData[index].pitch
        });

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
        let tgtAngle = (symbol * 360 / 39) % 360;
        const srcAngle = this.gateRingAngle;

        if (Math.abs(tgtAngle - srcAngle) < 20) {
            tgtAngle = tgtAngle + 360;
        }

        const symbolLightRoot = Actor.CreateEmpty(this.context, {
            actor: {
                transform: {
                    rotation: Quaternion.RotationAxis(Vector3.Forward(), srcAngle * DegreesToRadians)
                }
            }
        }).value;

        await Actor.CreateFromLibrary(this.context, {
            resourceId: this.symbolLightId,
            actor: {
                parentId: symbolLightRoot.id,
                transform: {
                    position: { x: 0.0, y: -2.9, z: 0.0 }
                }
            }
        });

        const duration = Math.abs(tgtAngle - srcAngle) / 60.0;
        this.soundDialChime.resume();
        await symbolLightRoot.animateTo({
            transform: {
                rotation: Quaternion.RotationAxis(Vector3.Forward(), tgtAngle * DegreesToRadians)
            }
        }, duration, AnimationEaseCurves.EaseInOutSine);
        await delay((duration + 1) * 1000);
        this.soundDialChime.pause();
        this.symbolRingLights.push(symbolLightRoot);

        this.gateRingAngle = tgtAngle;
    }

}
