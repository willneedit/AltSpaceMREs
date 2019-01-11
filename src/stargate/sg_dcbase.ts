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

import {
    GateOperation,
    GateStatus,
    InitStatus,
    SGDialCompLike,
} from "./sg_types";

import SGNetwork from "./sg_network";

import DoorGuard from "../DoorGuard";

export abstract class SGDCBase extends SGDialCompLike {

    // tslint:disable-next-line:variable-name
    private _gateID: string;
    protected sequence: number[] = [];
    private statusline: Actor = null;
    private initstatus = InitStatus.uninitialized;

    private lastuserid = '';
    private lasttyped = 0;

    private openTime = 0;

    public get id() { return this._gateID; }
    public get sessID() { return this.context.sessionId; }

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
        this.context.onUserLeft(this.userLeft);
        this.context.onStopped(this.stopped);

        // Try by ID and location, in this order
        if (!this.id && params.id) this._gateID = params.id as string;
        if (!this.id && params.location) this._gateID = SGNetwork.getLocationId(params.location as string);

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

    private userLeft = (user: User) => {
        if (user.id === this.lastuserid) {
            this.lasttyped = 0;
        }
    }

    private stopped = () => {
        DoorGuard.bumpSessId(this.sessID);
    }

    private keypressed(userid: string, key: number) {
        const gate = SGNetwork.getGate(this.id);

        if (gate == null) {
            this.updateStatus(`Error: Dialing device ${this.id || "(unconfigured)"} disconnected`);
            return; // No gate - dialer is locked
        }

        const gateStatus = gate.gateStatus;
        const timestamp = new Date().getTime() / 1000;

        // Preevent crosstyping if someone's busy with the gate.
        if (userid !== this.lastuserid) {

            // 180 seconds timeout since the last authorized keypress if the gate is connected or dialing up
            if ((gateStatus === GateStatus.engaged || gateStatus === GateStatus.dialing)
                && timestamp < this.lasttyped + 180) return;

            // Thirty seconds timeout otherwise
            if (timestamp < this.lasttyped + 30) return;
        }

        this.lastuserid = userid;
        this.lasttyped = timestamp;

        if (gate.gateStatus !== GateStatus.idle) {
            // 'a' (or big red button) cuts the wormhole if it's engaged - only when outgoing.
            if (key === 0 && !gate.currentDirection) { SGNetwork.controlGateOperation(
                gate.id, gate.currentTarget, GateOperation.disconnect, this.openTime);
            }

            return; // Busy message already came from the 'gate
        }

        this.sequence.push(key);

        if (this.sequence.length === 7) {
            this.openTime = timestamp;

            SGNetwork.controlGateOperation(
                gate.id,
                SGNetwork.stringifySequence(this.sequence),
                GateOperation.startSequence,
                this.openTime);
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
        console.log(`Connection request by ${user.name}`);
        if (this.initstatus === InitStatus.initializing) {
            this.initstatus = InitStatus.initialized;

            if (!SGNetwork.requestSession(this.sessID)) return;
            SGNetwork.registerDCForUser(user.name, this);

            this.makeKeyboard();
            if (this.id) this.updateStatus(`Initialized, Address: ${this.id}`);
            else this.updateStatus(`Awaiting gate address...`);
        }
    }

    private started = () => {
        this.initstatus = InitStatus.initializing;
    }

    protected abstract async makeKeyboard(): Promise<void>;
}
