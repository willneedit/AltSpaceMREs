/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationEaseCurves,
    ButtonBehavior,
    MediaInstance,
    ParameterSet,
    Quaternion,
    User,
    Vector3
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { delay, initSound, restartSound } from "../helpers";

import { ContextLike } from "../frameworks/context/types";

export default class BlastDoor extends Applet {
    private initialized = false;

    private blastDoorLeftId = 'artifact:1155082333288661757';
    private blastDoorRightId = 'artifact:1155082327643128572';
    private blastDoorLockId = 'artifact:1155082317299974906';

    private externBaseURL = 'https://raw.githubusercontent.com/willneedit/willneedit.github.io/master/MRE/BlastDoor';

    private blastDoorRoot: Actor = null;
    private blastDoorLeft: Actor = null;
    private blastDoorRight: Actor = null;
    private blastDoorLock: Actor = null;

    private open = false;

    private blastDoorSoundFX: MediaInstance = null;
    private blastDoorSoundFXURL = `${this.externBaseURL}/Powered_Sliding_Door.wav`;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        this.started();
    }

    private async closeDoor() {
        this.open = false;

        restartSound(this.blastDoorSoundFX);

        this.blastDoorLeft.animateTo({
            transform: {
                local: {
                    position: { x: 0.0, y: 0.0, z: 0.0 }
                }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorRight.animateTo({
            transform: {
                local: {
                    position: { x: 0.0, y: 0.0, z: 0.0 }
                }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorLock.animateTo({
            transform: {
                local: {
                    rotation: Quaternion.RotationAxis(Vector3.Forward(), 0)
                }
            }
        }, 0.5, AnimationEaseCurves.EaseInOutSine);
    }

    private async doorUsed(user: User) {
        if (this.open) return;

        this.open = true;

        restartSound(this.blastDoorSoundFX);

        this.blastDoorLeft.animateTo({
            transform: {
                local: {
                    position: { x: 1.0, y: 0.0, z: 0.0 }
                }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorRight.animateTo({
            transform: {
                local: {
                    position: { x: -1.0, y: 0.0, z: 0.0 }
                }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorLock.animateTo({
            transform: {
                local: {
                    rotation: Quaternion.RotationAxis(Vector3.Forward(), Math.PI)
                }
            }
        }, 0.5, AnimationEaseCurves.EaseInOutSine);

        delay(5 * 1000).then(() => { this.closeDoor(); });
    }

    private started = async () => {
        if (this.initialized) return;

        this.initialized = true;

        this.blastDoorRoot = this.context.CreateEmpty();

        this.blastDoorLeft = this.context.CreateFromLibrary({
            resourceId: this.blastDoorLeftId
        });

        this.blastDoorRight = this.context.CreateFromLibrary({
            resourceId: this.blastDoorRightId
        });

        this.blastDoorLock = await this.context.CreateFromLibrary({
            resourceId: this.blastDoorLockId,
            actor: {
                parentId: this.blastDoorLeft.id,
                transform: {
                    local: {
                        position: { x: 0.3, y: 1.5, z: 0.0 }
                    }
                }
            }
        });

        this.blastDoorLock.setBehavior(ButtonBehavior).onClick((user: User) => this.doorUsed(user));

        this.blastDoorSoundFX = initSound(this.context.assets, this.blastDoorRoot, this.blastDoorSoundFXURL);
    }
}
