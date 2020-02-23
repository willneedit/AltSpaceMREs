/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationKeyframe,
    AnimationWrapMode,
    ButtonBehavior,
    MediaInstance,
    ParameterSet,
    Quaternion,
    TextAnchorLocation,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

import { double } from "@microsoft/mixed-reality-extension-sdk/built/math/types";

import { initSound, restartSound } from "../helpers";

export default class Earthquake extends Applet {
    private eqgIdleId = 'artifact:1411071212997575195';
    private eqgBodyId = 'artifact:1411071190448996884';
    private eqgRotLowerId = 'artifact:1411071199366087191';
    private eqgRotUpperId = 'artifact:1411071219020595742';
    private eqgEmitterId = 'artifact:1411071199097651734';
    private terrainId = 'artifact:1411071225706316321';

    private terrain: Actor = null;
    private eqRoot: Actor = null;
    private eqIdle: Actor = null;
    private eqRotLower: Actor = null;
    private eqRotUpper: Actor = null;
    private message: Actor = null;

    private soundBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/earthquake';
    private humSoundURL = `${this.soundBaseURL}/Machine_Hum.ogg`;
    private laserSoundURL = `${this.soundBaseURL}/Particle_Beam_Firing.ogg`;
    private humSound: MediaInstance = null;
    private laserSound: MediaInstance = null;

    private generateShakeBaseKeyFrames(offset: double, amp: double): AnimationKeyframe[] {
        return [
            {
                time: 0 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: 0.0 } } } }
            }, {
                time: 0.05 + offset,
                value: { transform: { local: { position: { x: 0.1 * amp, y: 0.0, z: 0.0 } } } }
            }, {
                time: 0.10 + offset,
                value: { transform: { local: { position: { x: -0.1 * amp, y: 0.0, z: 0.0 } } } }
            }, {
                time: 0.15 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: 0.1 * amp } } } }
            }, {
                time: 0.20 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: -0.2 * amp } } } }
            }, {
                time: 0.25 + offset,
                value: { transform: { local: { position: { x: 0.1 * amp, y: 0.0, z: 0.0 } } } }
            }, {
                time: 0.30 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: 0.1 * amp } } } }
            }, {
                time: 0.35 + offset,
                value: { transform: { local: { position: { x: 0.2 * amp, y: 0.0, z: 0.0 } } } }
            }, {
                time: 0.40 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: 0.1 * amp } } } }
            }, {
                time: 0.45 + offset,
                value: { transform: { local: { position: { x: 0.0, y: 0.0, z: -0.1 * amp } } } }
            }

        ];
    }
    private generateShakeKeyframes(): AnimationKeyframe[] {
        let res: AnimationKeyframe[] = [];
        res = res.concat(
            this.generateShakeBaseKeyFrames(0.0, 0.25)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(0.5, 0.50)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(1.0, 0.75)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(1.5, 1.0)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(2.0, 1.0)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(2.5, 0.75)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(3.0, 0.50)
        );
        res = res.concat(
            this.generateShakeBaseKeyFrames(3.5, 0.25)
        );

        res.push({
            time: 8.0,
            value: { transform: { local: { position: { x: 0.0, y: 0.0, z: 0.0 } } } }
        });

        return res;
    }

    private generateSpinKeyframes(duration: number, axis: Vector3): AnimationKeyframe[] {
        return [{
            time: 0 * duration,
            value: { transform: { local: { rotation: Quaternion.RotationAxis(axis, 0) } } }
        }, {
            time: 0.25 * duration,
            value: { transform: { local: { rotation: Quaternion.RotationAxis(axis, Math.PI / 2) } } }
        }, {
            time: 0.5 * duration,
            value: { transform: { local: { rotation: Quaternion.RotationAxis(axis, Math.PI) } } }
        }, {
            time: 0.75 * duration,
            value: { transform: { local: { rotation: Quaternion.RotationAxis(axis, 3 * Math.PI / 2) } } }
        }, {
            time: 1 * duration,
            value: { transform: { local: { rotation: Quaternion.RotationAxis(axis, 2 * Math.PI) } } }
        }];
    }

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);

        this.context.onUserJoined(this.userjoined);
        this.context.onStarted(this.started);
    }

    private userjoined = async (user: User) => {
        console.log(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
    }

    private started = async () => {
        this.terrain = this.context.CreateFromLibrary({
            resourceId: this.terrainId
        });

        this.eqRoot = this.context.CreateEmpty({
            actor: {
                parentId: this.terrain.id,
                transform: {
                    local: {
                        position: { x: -3, y: 1, z: 1 }
                    }
                }
            }
        });

        this.eqIdle = this.context.CreateFromLibrary({
            resourceId: this.eqgIdleId,
            actor: {
                parentId: this.eqRoot.id
            }
        });

        this.eqIdle.setBehavior(ButtonBehavior).onClick((user: User) => this.activate(user));

        this.humSound = initSound(this.context.assets, this.terrain, this.humSoundURL, {
            looping: true
        });

        this.laserSound = initSound(this.context.assets, this.terrain, this.laserSoundURL, {
            looping: true
        });

    }

    private async activate(user: User) {
        let allowed = false;

        if (user.properties["altspacevr-roles"]) {
            if (user.properties["altspacevr-roles"].includes("moderator")) allowed = true;
            if (user.properties["altspacevr-roles"].includes("presenter")) allowed = true;
            if (user.properties["altspacevr-roles"].includes("helper")) allowed = true;
        }

        if (user.name === 'Ancient iwontsay') allowed = true;

        if (!allowed) return;

        await this.context.CreateFromLibrary({
            resourceId: this.eqgBodyId,
            actor: {
                parentId: this.eqRoot.id
            }
        });

        this.eqRotUpper = await this.context.CreateFromLibrary({
            resourceId: this.eqgRotUpperId,
            actor: {
                parentId: this.eqRoot.id
            }
        });

        this.eqRotLower = await this.context.CreateFromLibrary({
            resourceId: this.eqgRotLowerId,
            actor: {
                parentId: this.eqRoot.id
            }
        });

        this.eqIdle.destroy();

        this.message = this.context.CreateEmpty({
            actor: {
                parentId: this.eqRoot.id,
                transform: {
                    local: {
                        position: { x: 0, y: 1, z: -0.7 }
                    }
                },
                text: {
                    color: { r: 1.0, g: 1.0, b: 1.0 },
                    height: 0.1,
                    anchor: TextAnchorLocation.MiddleCenter,
                    contents: "Initializing..."
                }
            }
        });

        this.eqRotUpper.createAnimation('spin', {
            keyframes: this.generateSpinKeyframes(8, Vector3.Up()),
            events: [],
            wrapMode: AnimationWrapMode.Loop
        });

        this.eqRotLower.createAnimation('spin', {
            keyframes: this.generateSpinKeyframes(8, Vector3.Down()),
            events: [],
            wrapMode: AnimationWrapMode.Loop
        });

        this.terrain.createAnimation('shake', {
            keyframes: this.generateShakeKeyframes(),
            events: [],
            wrapMode: AnimationWrapMode.Loop
        });

        this.eqRotUpper.enableAnimation('spin');

        restartSound(this.humSound, { looping: true });

        setTimeout(() => this.activateStage2(), 16000);
    }

    private activateStage2() {
        this.eqRotLower.enableAnimation('spin');
        this.message.text.contents = 'Fault line detected\nDetermining resonance frequency...';
        this.message.text.color = { r: 1.0, g: 1.0, b: 0.5 };

        setTimeout(() => this.activateStage3(), 16000);
    }

    private activateStage3() {
        this.message.text.contents = 'Resonance frequency found\nFiring...';
        this.message.text.color = { r: 1.0, g: 0.5, b: 0.5 };

        this.context.CreateFromLibrary({
            resourceId: this.eqgEmitterId,
            actor: {
                parentId: this.eqRoot.id
            }
        });

        restartSound(this.laserSound, { looping: true });

        setTimeout(() => this.activateStage4(), 4000);
    }

    private activateStage4() {
        this.terrain.enableAnimation('shake');
    }
}
