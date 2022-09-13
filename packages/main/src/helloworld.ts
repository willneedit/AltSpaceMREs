/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

 /**
  * This is an extended Hello World sample, derived from the one found in
  * @microsoft/mixed-reality-extension-sdk-samples, courtesy of Microsoft.
  */
import {
    Actor,
    AnimationWrapMode,
    ButtonBehavior,
    ParameterSet,
    Quaternion,
    TextAnchorLocation,
    User,
    Vector3,
} from '@microsoft/mixed-reality-extension-sdk';

import Applet from "./Applet";
import { ContextLike } from './frameworks/context/types';

/**
 * The main class of this app. All the logic goes here.
 */
export default class HelloWorld extends Applet {
    private text: Actor = null;
    private cube: Actor = null;
    private announce: Actor = null;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
    }

    /**
     * Once the context is "started", initialize the app.
     */
    private started = () => {

        let mytext = "Hello World! (base: " + this.baseUrl + ")";
        if (this.parameter.error) mytext = this.parameter.error as string;

        // Create a new actor with no mesh, but some text. This operation is asynchronous, so
        // it returns a "forward" promise (a special promise, as we'll see later).
        const textPromise = this.context.CreateEmpty({
            actor: {
                name: 'Text',
                transform: {
                    local: {
                        position: { x: 0, y: 0.5, z: 0 }
                    }
                },
                text: {
                    contents: mytext,
                    anchor: TextAnchorLocation.MiddleCenter,
                    color: { r: 30 / 255, g: 206 / 255, b: 213 / 255 },
                    height: 0.3
                }
            }
        });

        // Even though the actor is not yet created in Altspace (because we didn't wait for the promise),
        // we can still get a reference to it by grabbing the `value` field from the forward promise.
        this.text = textPromise;

        // Load a glTF model
        const cubePromise = this.context.CreateFromGLTF({
            // at the given URL
            uri: `${this.baseUrl}/altspace-cube.glb`,
            // and spawn box colliders around the meshes.
            colliderType: 'box',
            // Also apply the following generic actor properties.
            actor: {
                name: 'Altspace Cube',
                // Parent the glTF model to the text actor.
                parentId: this.text.id,
                transform: {
                    local: {
                        position: { x: 0, y: -1, z: 0 },
                        scale: { x: 0.4, y: 0.4, z: 0.4 }
                    }
                }
            }
        });

        // Grab that early reference again.
        this.cube = cubePromise;

    }

    /* Better not async. Race condition. */
    private userjoined = /* async */ (user: User) => {

        // Delete the previous announcement first.
        if (this.announce != null) {
            this.announce.destroy();
            this.announce = null;
        }

        // Create a new actor with no mesh, but some text. This operation is asynchronous, so
        // it returns a "forward" promise (a special promise, as we'll see later).
        const announcePromise = this.context.CreateEmpty({
            actor: {
                name: 'Announce',
                transform: {
                    local: {
                        position: { x: 0, y: 1, z: 0 }
                    }
                },
                // lookAt: LookAtMode.TargetXY,
                text: {
                    contents: "Hello " + user.name + "!\n" +
                    "Please refer to\n" +
                    "https://github.com/willneedit/AltSpaceMREs/wiki\n" +
                    "for documentation.",
                    anchor: TextAnchorLocation.MiddleCenter,
                    color: { r: 255 / 255, g: 128 / 255, b: 128 / 255 },
                    height: 0.3
                },
                parentId: this.text.id
            }
        });
    }

}
