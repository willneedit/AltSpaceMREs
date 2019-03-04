/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationEaseCurves,
    ButtonBehavior,
    Context,
    ParameterSet,
    Quaternion,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";
import KitAudio from "../kit_audio";

import { delay } from "../helpers";

export default class BlastDoor extends Applet {
    private initialized = false;

    private blastDoorLeftId = 'artifact:1155082333288661757';
    private blastDoorRightId = 'artifact:1155082327643128572';
    private blastDoorLockId = 'artifact:1155082317299974906';
    private blastDoorSoundFXId = 'artifact:1155082322744181499';

    private blastDoorLeft: Actor = null;
    private blastDoorRight: Actor = null;
    private blastDoorLock: Actor = null;

    private open = false;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        console.log(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        this.started();
    }

    private async closeDoor() {
        this.open = false;

        await KitAudio.startSound(this.context, this.blastDoorSoundFXId);

        this.blastDoorLeft.animateTo({
            transform: {
                position: { x: 0.0, y: 0.0, z: 0.0 }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorRight.animateTo({
            transform: {
                position: { x: 0.0, y: 0.0, z: 0.0 }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorLock.animateTo({
            transform: {
                rotation: Quaternion.RotationAxis(Vector3.Forward(), 0)
            }
        }, 0.5, AnimationEaseCurves.EaseInOutSine);
    }

    private async doorUsed(userId: string) {
        if (this.open) return;

        this.open = true;

        await KitAudio.startSound(this.context, this.blastDoorSoundFXId);

        this.blastDoorLeft.animateTo({
            transform: {
                position: { x: 1.0, y: 0.0, z: 0.0 }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorRight.animateTo({
            transform: {
                position: { x: -1.0, y: 0.0, z: 0.0 }
            }
        }, 2.0, AnimationEaseCurves.EaseInOutSine);

        this.blastDoorLock.animateTo({
            transform: {
                rotation: Quaternion.RotationAxis(Vector3.Forward(), Math.PI)
            }
        }, 0.5, AnimationEaseCurves.EaseInOutSine);

        delay(5 * 1000).then(() => { this.closeDoor(); });
    }

    private started = async () => {
        if (this.initialized) return;

        this.initialized = true;

        this.blastDoorLeft = Actor.CreateFromLibrary(this.context, {
            resourceId: this.blastDoorLeftId
        }).value;

        this.blastDoorRight = Actor.CreateFromLibrary(this.context, {
            resourceId: this.blastDoorRightId
        }).value;

        this.blastDoorLock = await Actor.CreateFromLibrary(this.context, {
            resourceId: this.blastDoorLockId,
            actor: {
                parentId: this.blastDoorLeft.id,
                transform: {
                    position: { x: 0.3, y: 1.5, z: 0.0 }
                }
            }
        });

        this.blastDoorLock.setBehavior(ButtonBehavior).onClick('pressed',
            (userId: string) => this.doorUsed(userId) );
    }
}
