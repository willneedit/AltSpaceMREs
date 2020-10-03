/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    AttachPoint,
    DegreesToRadians,
    ParameterSet,
    Quaternion,
    Transform,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

export default class ShowKitObj extends Applet {
    private initialized = false;
    private attachPoint: AttachPoint = "none";
    private attachUser: string = null;
    private offset: Partial<Transform> = { position: new Vector3(0.0, 0.0, 0.0 ) };

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);

        if (params.attach) this.attachPoint = params.attach as AttachPoint;
        if (params.user) this.attachUser = params.user as string;
        if (params.x) this.offset.position.x = +params.x;
        if (params.y) this.offset.position.y = +params.y;
        if (params.z) this.offset.position.z = +params.z;

        if (params.rx || params.ry || params.rz) {
            const euler = new Vector3(0.0, 0.0, 0.0);
            if (params.rx) euler.x = +params.rx;
            if (params.ry) euler.y = +params.ry;
            if (params.rz) euler.z = +params.rz;

            this.offset.rotation = Quaternion.RotationYawPitchRoll(
                euler.y * DegreesToRadians,
                euler.x * DegreesToRadians,
                euler.z * DegreesToRadians);
        }

        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        this.started(user);
    }

    private started = async (user: User) => {
        if (this.initialized) return;

        if (this.attachUser && this.attachUser !== user.name) return;

        if (this.attachPoint === "none") this.initialized = true;

        const kitObjId = this.parameter.kit as string;
        const anim = this.parameter.animate !== undefined;

        const model = await this.context.CreateFromLibrary({
            resourceId: kitObjId,
            actor: {
                name: `Kit Model Id: ${kitObjId}`,
                transform: { local: this.offset }
            }
        });

        if (anim) {
            const animName = (this.parameter.animate == null) ? 'animation:0' : this.parameter.animate as string;
            model.targetingAnimationsByName.get(animName).play();
        }

        if (this.attachPoint !== "none") model.attach(user, this.attachPoint);
    }
}
