/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ActionHandler,
    Actor,
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

import { ContextLike } from "../frameworks/context/types";
import SGAddressing from "./sg_addressing";
import SGLocator from "./sg_locator";

export abstract class SGDCBase extends SGDialCompLike {

    // tslint:disable-next-line:variable-name
    private _gateFQLID: string;
    protected sequence: number[] = [];
    private statusline: Actor = null;
    private initstatus = InitStatus.uninitialized;

    private lastuserid = '';
    private lasttyped = 0;

    private openTime = 0;

    public get fqlid() { return this._gateFQLID; }
    public get sessID() { return this.context.sessionId; }

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
        this.context.onUserLeft(this.userLeft);

        this.updateStatus('Initializing...');
    }

    public registerDC(id: string) {
        this._gateFQLID = id;
        SGNetwork.registerDialComp(this);
        this.updateStatus(`Initialized, Address: ${this._gateFQLID}`);
    }

    public updateStatus(message: string) {
        if (!this.statusline) {
            this.statusline = this.createStatusLine(message);
        } else this.statusline.text.contents = message;
    }

    protected createStatusLine(message: string): Actor {
        return this.context.CreateEmpty({
            actor: {
                transform: { local: {position: { x: 0.0, y: 0.3, z: 0.0 } } },
                text: {
                    contents: message,
                    height: 0.1,
                    anchor: TextAnchorLocation.BottomCenter,
                    color: { r: 0.5, g: 1.0, b: 1.0 }
                }
            }
        });
    }

    protected listSequence() {
        const seq = SGAddressing.toLetters(this.sequence);
        this.updateStatus(seq);
    }

    private userLeft = (user: User) => {
        if (user.id === this.lastuserid) {
            this.lasttyped = 0;
        }
    }

    private keypressed(user: User, key: number) {
        const gate = SGNetwork.getGate(this.fqlid);

        if (gate == null) {
            this.updateStatus(`Error: Dialing device ${this.fqlid || "(unconfigured)"} disconnected`);
            return; // No gate - dialer is locked
        }

        const gateStatus = gate.gateStatus;
        const timestamp = new Date().getTime() / 1000;

        // Preevent crosstyping if someone's busy with the gate.
        if (user.id !== this.lastuserid) {

            // 180 seconds timeout since the last authorized keypress if the gate is connected or dialing up
            if ((gateStatus === GateStatus.engaged || gateStatus === GateStatus.dialing)
                && timestamp < this.lasttyped + 180) return;

            // Thirty seconds timeout otherwise
            if (timestamp < this.lasttyped + 30) return;
        }

        this.lastuserid = user.id;
        this.lasttyped = timestamp;

        if (gate.gateStatus !== GateStatus.idle) {
            // 'a' (or big red button) cuts the wormhole if it's engaged - only when outgoing.
            if (key === 0 && !gate.currentDirection) { SGNetwork.controlGateOperation(
                gate.fqlid, gate.currentTarget, GateOperation.disconnect, this.openTime);
            }

            return; // Busy message already came from the 'gate
        }

        this.sequence.push(key);

        if (this.sequence.length === 7) {
            this.openTime = timestamp;
            gate.startDialing(this.sequence);
            this.sequence = [];
        } else if (key === 0) {
            // 'a' (or big red button) acts as a delete button for an incomplete sequence
            this.sequence = [];
        }

        this.listSequence();
    }

    protected makeKeyCallback(i: number): ActionHandler {
        return (user: User) => this.keypressed(user, i);
    }

    private userjoined = (user: User) => {
        console.log(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        if (this.initstatus === InitStatus.initializing) {
            this.initstatus = InitStatus.initialized;

            SGNetwork.meetup({ id: user.name, comp: this });

            SGLocator.lookupMeInAltspace(user, 38).then(val => {
                this.registerDC(SGAddressing.fqlid(val.location, val.galaxy));
                if (val.lastseen === 'unknown') {
                    this.updateStatus(`Gate is not registered,\nID would be ${val.seq_string}`);
                }
            });

        }
    }

    private started = () => {
        this.initstatus = InitStatus.initializing;

        this.makeKeyboard();
    }

    protected abstract async makeKeyboard(): Promise<void>;
}
