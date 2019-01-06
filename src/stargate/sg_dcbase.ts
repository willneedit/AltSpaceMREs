/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ActionHandler,
    Actor,
    Context,
    ParameterSet,
    TextAnchorLocation,
    User,
} from "@microsoft/mixed-reality-extension-sdk";

import { GateStatus, SGDialCompLike } from "./sg_types";

import SGNetwork from "./sg_network";

export abstract class SGDCBase extends SGDialCompLike {

    // tslint:disable-next-line:variable-name
    private _gateID: string;
    protected sequence: number[] = [];
    private statusline: Actor = null;
    private initialized = false;

    private lastuserid = '';
    private lasttyped = 0;

    public get id() { return this._gateID; }
    public get sessID() { return this.context.sessionId; }

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);

        // Try by ID and location, in this order
        if (!this.id && params.id) this._gateID = params.id as string;
        if (!this.id && params.location) this._gateID = SGNetwork.getLocationId(params.location as string);

        // Try by gate's session ID
        this._gateID = SGNetwork.getIdBySessId(this.sessID);

        // Register if found, else wait for the A-Frame component to announce itself.
        if (this.id) SGNetwork.registerDialComp(this);
        else console.info('Neither ID nor Location given - deferring Dial Computer registration');
    }

    public registerDC(id: string) {
        if (!this._gateID) {
            this._gateID = id;
            SGNetwork.registerDialComp(this);
            this.updateStatus(`Initialized, Address: ${this._gateID}`);
        } else if (this.id !== id) {
            console.error(`Dial computer: ID COLLISION: ${this.id} vs. retrieved ID ${id}`);
        }
    }

    public updateStatus(message: string) {
        if (!this.statusline) {
            this.statusline = this.createStatusLine(message);
        } else this.statusline.text.contents = message;
    }

    protected createStatusLine(message: string): Actor {
        return Actor.CreateEmpty(this.context, {
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

    private keypressed(userid: string, key: number) {
        const gate = SGNetwork.getGate(this.id);
        if (gate == null) {
            this.updateStatus(`Error: Dialing device ${this.id || "(unconfigured)"} disconnected`);
            return; // No gate - dialer is locked
        }

        const timestamp = new Date().getTime() / 1000;

        // Preevent crosstyping if someone's busy with the gate.
        if (userid !== this.lastuserid) {

            // Sixty seconds timeout since the last authorized keypress if the gate is connected
            if (gate.gateStatus === GateStatus.engaged && timestamp < this.lasttyped + 60) return;

            // Twenty seconds timeout otherwise
            if (timestamp < this.lasttyped + 20) return;
        }

        this.lastuserid = userid;
        this.lasttyped = timestamp;

        // 'a' (or big red button) cuts the wormhole if it's engaged
        if (gate.gateStatus === GateStatus.engaged && key === 0) {
            gate.disengage();
            return;
        }

        if (gate.gateStatus !== GateStatus.idle) {
            return; // Busy message already came from the 'gate
        }

        this.sequence.push(key);

        if (this.sequence.length === 7) {
            gate.startDialing(this.sequence);
            this.sequence = [];
        } else if (key === 0) {
            // 'a' (or big red button) acts as a delete button for an incomplete sequence
            this.sequence = [];
        }

        this.listSequence();
    }

    protected makeKeyCallback(i: number): ActionHandler {
        return (userid: string) => this.keypressed(userid, i);
    }

    private userjoined = (user: User) => {
        if (!this.initialized) SGNetwork.registerDCForUser(user.name, this);
        this.started();
    }

    private started = () => {
        if (this.initialized) return;

        this.initialized = true;

        this.makeKeyboard();
        if (this.id) this.updateStatus(`Initialized, Address: ${this.id}`);
        else this.updateStatus(`Awaiting gate address...`);
    }

    protected abstract async makeKeyboard(): Promise<void>;
}
