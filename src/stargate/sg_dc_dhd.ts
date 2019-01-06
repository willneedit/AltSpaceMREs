/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ButtonBehavior,
    DegreesToRadians,
    Quaternion,
    TextAnchorLocation,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import { SGDCBase } from "./sg_dcbase";

interface TierDefinition {
    letterRadius: number;   // Radius the hitbox is away from the rotation axis
    letterHeight: number;   // Size of the letter
    letterElevation: number;   // Elevation of the letter circle's plane in relation to the base of the dial circles
}

export default class SGDCDHD extends SGDCBase {
    private tiers: TierDefinition[] = [
        { letterRadius: -0.30, letterHeight: 0.13, letterElevation: 0.27 }, // Inner Circle
        { letterRadius: -0.55, letterHeight: 0.15, letterElevation: 0.15 }, // Middle Circle
        { letterRadius: -0.78, letterHeight: 0.18, letterElevation: 0.05 }, // Outer Circle
    ];

    private keyStart = 0;
    private keyEnd = 39;
    private keysInTier = Math.floor((39 - this.keyStart) / this.tiers.length);

    private resourceBaseURL = 'https://willneedit.github.io/MRE/stargate';

    protected createStatusLine(message: string): Actor {
        return Actor.CreateEmpty(this.context, {
            actor: {
                transform: {
                    rotation: Quaternion.RotationAxis(Vector3.Up(), Math.PI),
                    position: { x: 0.0, y: 1.75, z: 0.0 }
                },
                text: {
                    contents: message,
                    height: 0.1,
                    anchor: TextAnchorLocation.BottomCenter,
                    color: { r: 0.5, g: 1.0, b: 1.0 }
                }
            }
        }).value;
    }

    private makeRotation(keySlot: number): Quaternion {
        // Calculate the rotation of the key on the ring
        return Quaternion.RotationAxis(Vector3.Up(), -keySlot * 360 / this.keysInTier * DegreesToRadians);
    }

    protected async makeKeyboard() {
        const kbtilt = Quaternion.RotationAxis(Vector3.Right(), 30 * DegreesToRadians);

        const rootNodeGimbal = Actor.CreateEmpty(this.context,
            {
                actor: {
                    transform: {
                        position: { x: 0.0, y: 1, z: 0.0 },
                        rotation: kbtilt
                    }
                }
            }).value;

        const letterRotation = Quaternion.RotationAxis(Vector3.Right(), 75 * DegreesToRadians);

        const frame = Actor.CreateFromGLTF(this.context,
            {
                resourceUrl: `${this.resourceBaseURL}/DHD_3tiers.glb`,
                actor: {
                    name: 'DHD Stand'
                }
            }).value;

        for (let i = this.keyStart; i < this.keyEnd; i++) {
            const tierData = this.tiers[Math.floor((i - this.keyStart) / this.keysInTier)];
            const letterRadius = tierData.letterRadius;
            const letterHeight = tierData.letterHeight;
            const letterElevation = tierData.letterElevation;
            const keySlot = (i - this.keyStart) % this.keysInTier;

            const letterRotOffset = Actor.CreateEmpty(this.context,
                {
                    actor: {
                        parentId: rootNodeGimbal.id,
                        transform: {
                            position: { x: 0.0, y: letterElevation, z: 0},
                            rotation: this.makeRotation(keySlot + 0.5),
                        }
                    }
                }).value;

            const letter = Actor.CreateEmpty(this.context,
                {
                    actor: {
                        parentId: letterRotOffset.id,
                        transform: {
                            rotation: letterRotation,
                            position: { x: 0, y: 0.03, z: letterRadius }},
                        text: {
                            contents: this.getLetter(i),
                            color: { r: 1.0, g: 1.0, b: 1.0 },
                            height: letterHeight
                        }
                    }
                }).value;

            // HACK: Primitives aren't displayed for all users (issue submitted), so create and scale a unit
            // volume box to provide the collider.
            const collider = Actor.CreateFromGLTF(this.context,
                {
                    colliderType: 'box',
                    resourceUrl: 'https://willneedit.github.io/MRE/VolumeUnit.glb',
                    actor: {
                        parentId: letter.id,
                        transform: {
                            position: { x: 0, y: 0, z: 0.05 },
                            scale: { x: letterHeight, y: letterHeight, z: 0.002 }
                        }
                    }
                }).value;

            collider.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(i));
        }

        const button = Actor.CreateFromGLTF(this.context,
            {
                colliderType: 'box',
                resourceUrl: 'https://willneedit.github.io/MRE/VolumeUnit.glb',
                actor: {
                    parentId: rootNodeGimbal.id,
                    transform: {
                        position: { x: 0, y: 0.25, z: 0 },
                        scale: { x: 0.24, y: 0.1, z: 0.24 }
                    }
                }
            }).value;

        button.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(0));

    }
}
