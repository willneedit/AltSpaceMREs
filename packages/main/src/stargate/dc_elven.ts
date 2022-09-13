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
    TextFontFamily,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import SGAddressing from "./addressing";
import { SGDCBase } from "./dc__base";

interface TierDefinition {
    letterRadius: number;   // Radius the hitbox is away from the rotation axis
    letterHeight: number;   // Size of the letter
    letterElevation: number;   // Elevation of the letter circle's plane in relation to the base of the dial circles
}

export default class SGDCElven extends SGDCBase {

    private dhdModelId = 'artifact:1422743196869329628';

    private tiers: TierDefinition[] = [
        { letterRadius: 1.10, letterHeight: 0.08, letterElevation: 1.10 }, // Inner Circle
        { letterRadius: 1.25, letterHeight: 0.09, letterElevation: 1.30 }, // Middle Circle
        { letterRadius: 1.40, letterHeight: 0.10, letterElevation: 1.50 }, // Outer Circle
    ];

    private keyStart = 0;
    private keyEnd = 39;
    private keysInTier = Math.floor((this.keyEnd - this.keyStart) / this.tiers.length);

    public get DCNumberBase(): number { return 38; }

    protected createStatusLine(message: string): Actor {
        return this.context.CreateEmpty({
            actor: {
                transform: {
                    local: {
                        rotation: Quaternion.RotationAxis(Vector3.Up(), Math.PI),
                        position: { x: 0.0, y: 1.75, z: 0.0 }
                    }
                },
                text: {
                    contents: message,
                    height: 0.12,
                    anchor: TextAnchorLocation.BottomCenter,
                    color: { r: 1.0, g: 2.0, b: 1.5 },
                    font: TextFontFamily.Serif
                }
            }
        });
    }

    private makeRotation(keySlot: number): Quaternion {
        // Calculate the rotation of the key on the ring
        return Quaternion.RotationAxis(Vector3.Up(), (keySlot * 180 / this.keysInTier + 90) * DegreesToRadians);
    }

    protected async makeKeyboard() {
        const letterRotation = Quaternion.RotationAxis(Vector3.Right(), 45 * DegreesToRadians);

        this.context.CreateFromLibrary({
                resourceId: this.dhdModelId,
                actor: {
                    name: 'DHD Stand'
                }
            });

        for (let i = this.keyStart; i < this.keyEnd; i++) {
            const tierData = this.tiers[Math.floor((i - this.keyStart) / this.keysInTier)];
            const keySlot = (i - this.keyStart) % this.keysInTier;
            const letterRadius = tierData.letterRadius;
            const letterHeight = tierData.letterHeight;
            const letterElevation = tierData.letterElevation;

            const letterCoordRot = ((keySlot + 0.5) * 180 / this.keysInTier + 90) * DegreesToRadians;
            const letterRadiusX = letterRadius * Math.sin(letterCoordRot);
            const letterRadiusZ = letterRadius * Math.cos(letterCoordRot) * 0.75 + 1.04;

            const letterRotRoot = this.context.CreateEmpty({
                    actor: {
                        transform: {
                            local: {
                                rotation: this.makeRotation(keySlot + 0.5).multiply(letterRotation),
                                position: { x: letterRadiusX, y: letterElevation + 0.04, z: letterRadiusZ }},
                            }
                    }
                });

            const letterOrientation = Quaternion.RotationAxis(Vector3.Forward(), 0);

            this.context.CreateEmpty({
                    actor: {
                        parentId: letterRotRoot.id,
                        transform: {
                            local: {
                                rotation: letterOrientation,
                            }
                        },
                        text: {
                            anchor: TextAnchorLocation.MiddleCenter,
                            contents: SGAddressing.toLetters(i),
                            color: { r: 1.0, g: 1.0, b: 1.0 },
                            height: letterHeight,
                            font: TextFontFamily.Serif
                        }
                    }
                });

            const collider = this.context.CreatePrimitive({
                    definition: {
                        shape: PrimitiveShape.Box,
                        dimensions: new Vector3(letterHeight, letterHeight, 0.002)
                    },
                    addCollider: true,
                    actor: {
                        parentId: letterRotRoot.id,
                        transform: {
                            local: {
                                position: { x: 0, y: -0.03, z: 0.055 },
                            }
                        }
                    }
                });

            collider.setBehavior(ButtonBehavior).onClick(this.makeKeyCallback(i));
        }
    }
}
