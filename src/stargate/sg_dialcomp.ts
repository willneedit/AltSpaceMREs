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

import SGNetwork from "./sg_network";
import { GateStatus, SGDialCompLike } from "./sg_types";

export default class SGDialComp extends SGDialCompLike {

    private initialized = false;
    private sequence: number[] = [];
    private statusline: Actor = null;
    private gateID: string;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);

        if (params.id) this.gateID = params.id as string;
            else this.gateID = SGNetwork.getLocationId(params.location as string);

        SGNetwork.registerDialComp(this.gateID, this);
    }

    public updateStatus(message: string) {
        if (!this.statusline) {
            this.statusline = Actor.CreateEmpty(this.context, {
                actor: {
                    transform: { position: { x: 0.0, y: 0.3, z: 0.0 } },
                    text: {
                        contents: message,
                        height: 0.1,
                        anchor: TextAnchorLocation.BottomCenter,
                        color: { r: 0.5, g: 1.0, b: 1.0 }
                    }
                }
            }).value;
        } else this.statusline.text.contents = message;
    }

    private listSequence() {
        let seq = "";
        for (const key of this.sequence) {
            seq = seq + this.getLetter(key);
        }

        this.updateStatus(seq);
    }

    private keypressed(key: number) {
        const gate = SGNetwork.getGate(this.gateID);
        if (gate == null) {
            this.updateStatus(`Error: Dialing device ${this.gateID} disconnected`);
            return; // No gate - dialer is locked
        }

        if (gate.gateStatus !== GateStatus.idle) return; // Busy message already came from the 'gate

        this.sequence.push(key);

        if (this.sequence.length === 7) {
            gate.startDialing(this.sequence);
            this.sequence = [];
        } else this.listSequence();
    }

    private makeKeyCallback(i: number): () => void {
        return () => this.keypressed(i);
    }

    private getLetter(key: number): string {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

        if (key < 26) return String.fromCharCode(key + lowerA);
        else return String.fromCharCode(key - 26 + upperA);
    }

    private async makeKeyboard() {
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

    private userjoined = (user: User) => {
        this.started();
    }

    private started = () => {
        if (this.initialized) return;

        this.initialized = true;

        this.makeKeyboard();
        this.updateStatus(`Initialized, Address: ${this.gateID}`);
    }
}
