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
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import SGAddressing from "./addressing";
import { SGDCBase } from "./dc__base";

export default class SGDCDebug extends SGDCBase {

    public get DCNumberBase(): number { return 38; }

    protected async makeKeyboard() {
        const rootNode = this.context.CreateEmpty({
                actor: {
                    transform: { local: { rotation: Quaternion.RotationAxis(Vector3.Right(), 45 * DegreesToRadians)} }
                }
            });

        for (let i = 0; i < 39; i++) {
            const xpos = (i % 8) * 0.10 + -0.35;
            const ypos = Math.trunc(i / 8) * -0.10 + 0.20;

            const key = this.context.CreatePrimitive({
                    definition: { shape: PrimitiveShape.Box, dimensions: new Vector3(0.09, 0.09, 0.01)},
                    addCollider: true,
                    actor: {
                        parentId: rootNode.id,
                        transform: { local: { position: { x: xpos, y: ypos, z: 0 }} },
                        name: 'button ' + i
                    }
                });

            const letter = this.context.CreateEmpty({
                    actor: {
                        parentId: key.id,
                        transform: { local: { position: { x: -0.002, y: 0.03, z: -0.011 }} },
                        text: {
                            contents: SGAddressing.toLetters(i),
                            color: { r: 0.0, g: 0.0, b: 0.0 },
                            height: 0.07
                        }
                    }
                });

            key.setBehavior(ButtonBehavior).onClick(this.makeKeyCallback(i));
        }
    }

}
