/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    Context,
    ParameterSet,
    TextAnchorLocation,
    User
} from "@microsoft/mixed-reality-extension-sdk";

import { GateStatus, SGDialCompLike } from "./sg_types";

import SGNetwork from "./sg_network";

export abstract class SGDCBase extends SGDialCompLike {

    // tslint:disable-next-line:variable-name
    private _gateID: string;
    protected sequence: number[] = [];
    private statusline: Actor = null;
    private initialized = false;

    public get gateID() { return this._gateID; }

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);

        if (params.id) this._gateID = params.id as string;
            else if (params.location) this._gateID = SGNetwork.getLocationId(params.location as string);
            else console.info('Neither ID nor Location given - deferring Dial Computer registration');

        if (this._gateID) SGNetwork.registerDialComp(this._gateID, this);
    }

    public registerDC(id: string) {
        if (!this._gateID) {
            this._gateID = id;
            SGNetwork.registerDialComp(this._gateID, this);
            this.updateStatus(`Initialized, Address: ${this._gateID}`);
        }
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

    protected getLetter(key: number): string {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

        if (key < 26) return String.fromCharCode(key + lowerA);
        else return String.fromCharCode(key - 26 + upperA);
    }

    protected listSequence() {
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

    protected makeKeyCallback(i: number): () => void {
        return () => this.keypressed(i);
    }

    private userjoined = (user: User) => {
        if (!this.initialized) SGNetwork.registerDCForUser(user.name, this);
        this.started();
    }

    private started = () => {
        if (this.initialized) return;

        this.initialized = true;

        this.makeKeyboard();
        if (this.gateID) this.updateStatus(`Initialized, Address: ${this.gateID}`);
        else this.updateStatus(`Awaiting gate address...`);
    }

    protected abstract async makeKeyboard(): Promise<void>;
}
