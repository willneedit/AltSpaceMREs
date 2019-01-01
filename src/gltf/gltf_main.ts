/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    Context,
    ParameterSet,
    User
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";

export default class ShowGLTF extends Applet {
    private initialized = false;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        this.started();
    }

    private started = async () => {
        if (this.initialized) return;

        this.initialized = true;

        const gltfName = this.parameter.gltf as string;
        const anim = this.parameter.animate !== undefined;

        const model = await Actor.CreateFromGLTF(this.context, {
            resourceUrl: gltfName,
            actor: {
                name: `Model URL: ${gltfName}`
            }
        });

        if (anim) {
            const animName = (this.parameter.animate == null) ? 'animation:0' : this.parameter.animate as string;
            model.startAnimation(animName);
        }
    }
}
