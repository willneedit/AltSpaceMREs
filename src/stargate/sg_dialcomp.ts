/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ButtonBehavior,
    Context,
    DegreesToRadians,
    ParameterSet,
    PrimitiveShape,
    Quaternion,
    TextAnchorLocation,
    User,
    Vector3,
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import SGNetwork from "./sg_network";
import { GateStatus } from "./types";

export default class SGDialComp extends Applet {

    private initialized = false;
    private sequence: number[] = [];
    private statusline: Actor = null;
    private gateID: string;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.gateID = params.id as string;
        this.context.onUserJoined(this.userjoined);
        console.log(`Registered Dialing Computer for ID ${this.gateID}`);
    }

    private updateStatus(message: string) {
        const oldline = this.statusline;

        this.statusline = Actor.CreateEmpty(this.context, {
            actor: {
                transform: { position: { x: 0.0, y: 0.5, z: 0.0 } },
                text: {
                    contents: message,
                    height: 0.2,
                    anchor: TextAnchorLocation.BottomCenter,
                    color: { r: 0.5, g: 1.0, b: 1.0 }
                }
            }
        }).value;

        if (oldline != null) {
            oldline.destroy();
        }
    }

    private listSequence() {
        let seq = "";
        let key = 0;
        for (key of this.sequence) {
            if (seq !== "") {
                seq = seq + ", ";
            }
            seq = seq + key;
        }

        this.updateStatus(seq);
    }

    private keypressed(key: number) {
        this.sequence.push(key);

        if (this.sequence.length === 7) {
            const gate = SGNetwork.getGate(this.gateID);

            if (gate == null) {
                this.updateStatus(`No gate registered for ID ${this.gateID}, check configuration`);
            }

            if (gate.gateStatus !== GateStatus.idle) {
                this.updateStatus(`Gate is already busy`);
            }

            gate.startDialing([ 1, 2, 3, 4, 5, 6, 0 ]);
            this.sequence = [];
            this.listSequence();
        } else {
            this.listSequence();
        }
    }

    private makeKeyCallback(i: number): () => void {
        return () => this.keypressed(i);
    }

    private async makeKeyboard() {
        let i = 0;
        const rootNodePromise = Actor.CreateEmpty(this.context,
            {
                actor: {
                    transform: { rotation: Quaternion.RotationAxis(Vector3.Right(), 45 * DegreesToRadians)}
                }
            });
        const rootNode = rootNodePromise.value;

        for (i = 0; i < 39; i++) {
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
            key.setBehavior(ButtonBehavior).onClick('pressed', this.makeKeyCallback(i));
        }
    }

    private userjoined = (user: User) => {
        this.started();
    }

    private started = () => {
        if (this.initialized) {
            return;
        }
        this.initialized = true;

        this.makeKeyboard();
    }
}