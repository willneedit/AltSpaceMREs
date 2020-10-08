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
    Guid,
    ButtonEventData,
} from "@microsoft/mixed-reality-extension-sdk";

import {
    GateStatus,
    InitStatus,
    SGDialCompLike,
} from "./types";

import SGNetwork from "./network";

import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";
import SGAddressing from "./addressing";
import SGLocator from "./locator";
import { SGDB } from "./database";
import Applet from "../Applet";

export abstract class SGDCBase extends Applet implements SGDialCompLike {

    // tslint:disable-next-line:variable-name
    private _gateFQLID: string;
    protected sequence: number[] = [];
    private statusline: Actor = null;
    private initstatus = InitStatus.uninitialized;

    private lastuserid: Guid = null;
    private lasttyped = 0;

    private openTime = 0;

    public get fqlid() { return this._gateFQLID; }
    public abstract get DCNumberBase(): number;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
        this.context.onUserLeft(this.userLeft);

        this.updateStatus('Initializing...');
    }

    public registerDC(fqlId: string) {
        this._gateFQLID = fqlId;
        SGNetwork.registerDialComp(this);
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

    protected listSequence(): string {
        const seq = SGAddressing.toLetters(this.sequence);
        this.updateStatus(seq);
        return seq;
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

        // Prevent crosstyping if someone's busy with the gate.
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
            if (key === 0 && !gate.currentDirection) { SGNetwork.gatesDisconnect(
                gate.fqlid, gate.currentTargetFqlid, this.openTime);
            }

            return; // Busy message already came from the 'gate
        }

        // 'a' on an empty sequence: Do nothing.
        if(key === 0 && this.sequence.length < 1) return;

        this.sequence.push(key);
        const seq = this.listSequence();

        // Sequences - special or legacy
        if (seq === 'ttttttt') {
            // terra-6168: SGC
            const lid = SGAddressing.analyzeLocationId(2809900406, this.DCNumberBase, 'altspace');
            this.sequence = lid.seq_numbers.concat([ 0 ]);
            key = 0;
        } else if(seq === 'fffbedceb') {
            this.registerLocation(user);
            this.sequence = [];
            return;
        } else if(seq === 'fffcebbed') {
            this.deleteLocation(user);
            this.sequence = [];
            return;
        }

        // 'a' on incomplete sequence: Delete key.
        // 'a' on complete or extended sequence: Enter key.
        if (key === 0) {
            if (this.sequence.length > SGAddressing.getRequiredDigits(this.DCNumberBase)) {
                this.openTime = timestamp;
                gate.startDialing(this.sequence, this.openTime);
            } else {
                this.updateStatus('Sequence deleted.');
            }

            this.sequence = [];
            return;
        }

    }

    private checkPermission(user: User, silent?: boolean) {
        let allowed = false;
        if (user.properties["altspacevr-roles"]) {
            if (user.properties["altspacevr-roles"].includes("presenter")) allowed = true;
            if (user.properties["altspacevr-roles"].includes("helper")) allowed = true;
        }

        if (user.name === 'Ancient iwontsay') allowed = true;

        if (!silent && !allowed) this.updateStatus('Insufficient user privileges\nOperation not permitted.');

        return allowed;
    }

    private registerLocation(user: User) {
        if (!this.checkPermission(user)) return;

        SGLocator.lookupMeInAltspace(user, this.DCNumberBase).then(val => {
            SGDB.registerLocation(val.lid, val.gid, val.location).then(() => {
                this.updateStatus(`Registration complete\nLocation: ${this._gateFQLID}\nDial Sequence: ${val.seq_string}a`);
            }).catch(() => {
                this.updateStatus(`Registration unsuccessful.`);
            });
        });
    }

    private deleteLocation(user: User) {
        if (!this.checkPermission(user)) return;

        SGLocator.lookupMeInAltspace(user, this.DCNumberBase).then(val => {
            SGDB.deleteLocation(val.gid, val.location).then(() => {
                this.updateStatus(`Deregistration successful, gate unlinked.`);
            }).catch(() => {
                this.updateStatus(`Deregistration unsuccessful.`);
            });
        });
    }

    protected makeKeyCallback(i: number): ActionHandler<ButtonEventData> {
        return (user: User) => this.keypressed(user, i);
    }

    private userjoined = (user: User) => {
        console.debug(`Connection request by ${user.id} (${user.name}) from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        if (this.initstatus === InitStatus.initializing) {
            this.initstatus = InitStatus.initialized;

            SGLocator.lookupMeInAltspace(user, this.DCNumberBase).then(val => {
                this.registerDC(SGAddressing.fqlid(val.location, val.galaxy));
                if (val.lastseen === 'unknown') {
                    this.updateStatus(
                        `Gate unregistered, ID would be ${val.seq_string}a\n`+
                        `Only outgoing connections possible\n` +
                        `CH's and presenters may use 'fffbedceb' to register`);
                } else {
                    this.updateStatus(`Initialized\nLocation: ${this._gateFQLID}\nDial Sequence: ${val.seq_string}a`);
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
