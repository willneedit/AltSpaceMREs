/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ButtonBehavior,
    DegreesToRadians,
    PrimitiveShape,
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

    private dhdModelId = '1144262470072795308';

    private tiers: TierDefinition[] = [
        { letterRadius: -0.34, letterHeight: 0.13, letterElevation: 0.27 }, // Inner Circle
        { letterRadius: -0.59, letterHeight: 0.15, letterElevation: 0.15 }, // Middle Circle
        { letterRadius: -0.83, letterHeight: 0.18, letterElevation: 0.05 }, // Outer Circle
    ];

    private keyStart = 0;
    private keyEnd = 39;
    private keysInTier = Math.floor((this.keyEnd - this.keyStart) / this.tiers.length);

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

        const letterRotation = Quaternion.RotationAxis(Vector3.Right(), 76 * DegreesToRadians);

        Actor.CreateFromLibrary(this.context,
            {
                resourceId: this.dhdModelId,
                actor: {
                    name: 'DHD Stand'
                }
            });

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

            const letterRotRoot = Actor.CreateEmpty(this.context,
                {
                    actor: {
                        parentId: letterRotOffset.id,
                        transform: {
                            rotation: letterRotation,
                            position: { x: 0, y: 0.03, z: letterRadius }},
                    }
                }).value;

            const letterOrientation = (keySlot < 3 || keySlot > 9)
                ? Quaternion.RotationAxis(Vector3.Forward(), 180 * DegreesToRadians)
                : Quaternion.RotationAxis(Vector3.Forward(), 0);

            Actor.CreateEmpty(this.context,
                {
                    actor: {
                        parentId: letterRotRoot.id,
                        transform: {
                            rotation: letterOrientation,
                        },
                        text: {
                            anchor: TextAnchorLocation.MiddleCenter,
                            contents: this.getLetter(i),
                            color: { r: 1.0, g: 1.0, b: 1.0 },
                            height: letterHeight
                        }
                    }
                });

            const collider = Actor.CreatePrimitive(this.context,
                {
                    definition: {
                        shape: PrimitiveShape.Box,
                        dimensions: new Vector3(letterHeight, letterHeight, 0.002)
                    },
                    addCollider: true,
                    actor: {
                        parentId: letterRotRoot.id,
                        transform: {
                            position: { x: 0, y: -0.03, z: 0.05 },
                        }
                    }
                }).value;

            collider.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(i));
        }

        const button = Actor.CreatePrimitive(this.context,
            {
                definition: {
                    shape: PrimitiveShape.Box,
                    dimensions: new Vector3(0.24, 0.1, 0.24)
                },
                addCollider: true,
                actor: {
                    parentId: rootNodeGimbal.id,
                    transform: {
                        position: { x: 0, y: 0.25, z: 0 },
                    }
                }
            }).value;

        button.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(0));

    }
}
