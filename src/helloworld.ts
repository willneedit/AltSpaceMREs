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
    AnimationKeyframe,
    AnimationWrapMode,
    ButtonBehavior,
    Context,
    LookAtMode,
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

        // Here we create an animation on our text actor. Animations have three mandatory arguments:
        // a name, an array of keyframes, and an array of events.
        this.text.createAnimation("Spin", {
            // Keyframes define the timeline for the animation: where the actor should be, and when.
            // We're calling the generateSpinKeyframes function to produce a simple 20-second revolution.
            keyframes: this.generateSpinKeyframes(20, Vector3.Up()),
            // Events are points of interest during the animation. The animating actor will emit a given
            // named event at the given timestamp with a given string value as an argument.
            events: [],

            // Optionally, we also repeat the animation infinitely.
            wrapMode: AnimationWrapMode.Loop
        });

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

        // Create some animations on the cube.
        this.cube.createAnimation('GrowIn', {
            keyframes: this.growAnimationData,
            events: []
        });

        this.cube.createAnimation('ShrinkOut', {
            keyframes: this.shrinkAnimationData,
            events: []
        });

        this.cube.createAnimation('DoAFlip', {
            keyframes: this.generateSpinKeyframes(1.0, Vector3.Right()),
            events: []
        });

        // Now that the text and its animation are all being set up, we can start playing
        // the animation.
        this.text.enableAnimation('Spin');

        // Set up cursor interaction. We add the input behavior ButtonBehavior to the cube.
        // Button behaviors have two pairs of events: hover start/stop, and click start/stop.
        const buttonBehavior = this.cube.setBehavior(ButtonBehavior);

        // Trigger the grow/shrink animations on hover.
        buttonBehavior.onHover('enter', (user: User) => {
            this.cube.enableAnimation('GrowIn');
        });
        buttonBehavior.onHover('exit', (user: User) => {
            this.cube.enableAnimation('ShrinkOut');
        });

        // When clicked, do a 360 sideways.
        buttonBehavior.onClick((user: User) => {
            this.cube.enableAnimation('DoAFlip');
        });

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

    /**
     * Generate keyframe data for a simple spin animation.
     * @param duration The length of time in seconds it takes to complete a full revolution.
     * @param axis The axis of rotation in local space.
     */
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

    private growAnimationData: AnimationKeyframe[] = [{
        time: 0,
        value: { transform: { local: { scale: { x: 0.4, y: 0.4, z: 0.4 } } } }
    }, {
        time: 0.3,
        value: { transform: { local: { scale: { x: 0.5, y: 0.5, z: 0.5 } } } }
    }];

    private shrinkAnimationData: AnimationKeyframe[] = [{
        time: 0,
        value: { transform: { local: { scale: { x: 0.5, y: 0.5, z: 0.5 } } } }
    }, {
        time: 0.3,
        value: { transform: { local: { scale: { x: 0.4, y: 0.4, z: 0.4 } } } }
    }];
}
