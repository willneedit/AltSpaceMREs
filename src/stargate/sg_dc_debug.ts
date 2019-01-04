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

import { SGDCBase } from "./sg_dcbase";

export default class SGDCDebug extends SGDCBase {

    protected async makeKeyboard() {
        const rootNode = Actor.CreateEmpty(this.context,
            {
                actor: {
                    transform: { rotation: Quaternion.RotationAxis(Vector3.Right(), 45 * DegreesToRadians)}
                }
            }).value;

        for (let i = 0; i < 39; i++) {
            const xpos = (i % 8) * 0.10 + -0.35;
            const ypos = Math.trunc(i / 8) * -0.10 + 0.20;

            const key = Actor.CreatePrimitive(this.context,
                {
                    definition: { shape: PrimitiveShape.Box, dimensions: new Vector3(0.09, 0.09, 0.01)},
                    addCollider: true,
                    actor: {
                        parentId: rootNode.id,
                        transform: { position: { x: xpos, y: ypos, z: 0 }},
                        name: 'button ' + i
                    }
                }).value;

            const letter = Actor.CreateEmpty(this.context,
                {
                    actor: {
                        parentId: key.id,
                        transform: { position: { x: -0.002, y: 0.03, z: -0.011 }},
                        text: {
                            contents: this.getLetter(i),
                            color: { r: 0.0, g: 0.0, b: 0.0 },
                            height: 0.07
                        }
                    }
                }).value;

            key.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(i));
        }
    }

}
