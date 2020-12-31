/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';
import { StargateLike, GateStatus } from "./types";
import SGNetwork from "./network";
import SGAddressing, { SGLocationData } from './addressing';
import { delay } from '../helpers';
import SGLocator from './locator';
import { SGDB } from './database';

export default class SGHTTP implements StargateLike {
    // tslint:disable:variable-name
    private _gateStatus: GateStatus = GateStatus.idle;
    private _gateNumberBase: number = null;
    private _gateFQLID: string;
    private _gateGalaxy: string;
    private _currentTargetFQLID: string;
    private _currentTargetSequence: string;
    private _currentDirection: boolean;
    private _connectionTimeStamp: number;
    // tslint:enable:variable-name

    public get gateStatus(): GateStatus { return this._gateStatus; }
    public get gateNumberBase(): number { return this._gateNumberBase; }
    public get fqlid(): string { return this._gateFQLID; }
    public get currentTargetFqlid(): string { return this._currentTargetFQLID; }
    public get currentTargetSequence(): string { return this._currentTargetSequence; }
    public get currentDirection(): boolean { return this._currentDirection; }
    public get currentTimeStamp(): number { return this._connectionTimeStamp; }

    public registerGate(id: string): void {
        this._gateFQLID = id;
        SGNetwork.announceGate(this);
    }

    public async startDialing(sequence: number[], timestamp: number) {
        return SGAddressing.lookupDialedTarget(sequence, this.gateNumberBase, this._gateGalaxy).then(tgtLid => {
            const tgtFqlid = SGAddressing.fqlid(tgtLid.location, tgtLid.galaxy);

            SGNetwork.gatesStartSequence(
                this.fqlid,
                tgtFqlid,
                SGAddressing.toLetters(sequence),
                timestamp);

        });
    }


    // --------------------------------------------------------------------------------------------
    /*
     * Incoming requests from SGNetwork, update internal state and pass it on to the client objects
     */


    public startSequence(tgtFqlid: string, tgtSequence: string, timestamp: number): void {
        // Reject request if we're not in idle state
        if (this.gateStatus !== GateStatus.idle) return;

        this._gateStatus = GateStatus.dialing;
        this._connectionTimeStamp = timestamp;
        this._currentTargetFQLID = tgtFqlid;
        this._currentTargetSequence = tgtSequence;

        // true for incoming direction, they don't allow for reverse travel
        this._currentDirection = (tgtSequence === null);

        SGNetwork.postEvent(this.fqlid, {
            command: "startSequence",
            srcFqlid: this.fqlid,
            'tgtFqlid': tgtFqlid,
            'tgtSequence': tgtSequence,
            'tgtSeqNumbers' : (tgtSequence != null) ? SGAddressing.toNumbers(tgtSequence) : null,
            'timestamp': timestamp
        });
    }

    public lightChevron(index: number, silent: boolean): void {
        if (this.gateStatus !== GateStatus.dialing) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "lightChevron",
            'index': index,
            'silent': silent
        });
    }

    public connect(): void {
        if (this.gateStatus !== GateStatus.dialing) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "connect",
            'tgtFqlid': this.currentTargetFqlid
        });

        this._gateStatus = GateStatus.engaged;

        // Timing out the gate is handled by the client object.

    }

    public disconnect(oldTs: number): void {
        if (this.currentTimeStamp !== oldTs) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "disconnect",
            'timestamp': oldTs
        });

        this._gateStatus = GateStatus.idle;
    }

    // --------------------------------------------------------------------------------------------
    /*
     * Incoming requests from the client object, update internal state
     */

    public init(fqlid: string, base: number) {
        const pos = fqlid.indexOf('/');
        this._gateGalaxy = fqlid.substr(0,pos);
        this._gateNumberBase = base;
        this._gateStatus = GateStatus.idle;
        this.registerGate(fqlid);
    }

    public static control(req: RS.Request) {
        const myFqlid = req.params.fqlid;
        const gate = SGNetwork.getGate(myFqlid);
        const command = req.params.command as string;

        if(command === 'announce') {
            const newGate = new SGHTTP();
            newGate.init(
                req.params.fqlid,
                +req.params.base
            );
            SGLocator.lookupFQLID(req.params.fqlid, +req.params.base).then((res: SGLocationData) => {
                if(res.lastseen === "unknown") {
                    SGNetwork.postEvent(req.params.fqlid, {
                        status: "Gate announcement OK, but gate is unregistered",
                        status_data1: res.seq_string
                    });
                } else {
                    SGNetwork.postEvent(req.params.fqlid, {
                        status: "Gate announcement OK",
                        status_data1: res.seq_string
                    });
                }
            });
            return;
        } else if(command === 'deannounce') {
            SGNetwork.deannounceGate(req.params.fqlid);
            SGNetwork.postEvent(req.params.fqlid, { status: "Gate deannouncement OK"});
            return;
        }

        if(!gate) {
            SGNetwork.postEvent(req.params.fqlid, { error: "Gate not present"});
            return;
        }

        if(command === 'register') {
            SGLocator.lookupFQLID(gate.fqlid, gate.gateNumberBase).then((res: SGLocationData) => {
                SGDB.registerLocation(res.lid, res.gid, res.location).then(() => {
                    SGNetwork.postEvent(req.params.fqlid, {
                        status: "Gate registration successful",
                        status_data1: res.seq_string
                    });
                }).catch((err2) => {
                    SGNetwork.postEvent(req.params.fqlid, {
                        error: "Gate registration failed",
                        status_data1: res.seq_string
                    });
                });
            });
            return;
        } else if(command === 'deregister') {
            SGLocator.lookupFQLID(gate.fqlid, gate.gateNumberBase).then((res: SGLocationData) => {
                SGDB.deleteLocation(res.gid, res.location).then(() => {
                    SGNetwork.postEvent(req.params.fqlid, {
                        status: "Gate deregistration successful",
                        status_data1: res.seq_string
                    });
                }).catch((err2) => {
                    SGNetwork.postEvent(req.params.fqlid, {
                        error: "Gate deregistration failed",
                        status_data1: res.seq_string
                    });
                });
            });
            return;
        }

        // Where the Altspace gates call SGNetwork directly, the client-driven gates need ReST API calls.
        // Requests will be bounced back to the clients
        if(command === 'startDialing') {
            gate.startDialing(
                SGAddressing.toNumbers(req.params.tgtSequence),
                new Date().getTime() / 1000).then(() => {
                    // No need for explicit StartDialing announcement, gate comes with StartSequence
                    // SGNetwork.postEvent(gate.fqlid, { status: "Dialing started"});
                }
            ).catch(() => {
                SGNetwork.postEvent(gate.fqlid, { error: "No target gate under this address"});
            });
            return;
        } else if(command === 'lightChevron') {
            const silent: boolean =
                (req.params.silent !== "0") &&
                (req.params.silent !== "false") &&
                (req.params.silent !== "False");
            SGNetwork.gatesLightChevron(
                gate.fqlid,
                gate.currentTargetFqlid,
                +req.params.index,
                silent
            );
            return;
        } else if(command === 'connect') {
            SGNetwork.gatesConnect(gate.fqlid, gate.currentTargetFqlid);
            return;
        } else if(command === 'disconnect') {
            SGNetwork.gatesDisconnect(gate.fqlid, gate.currentTargetFqlid, gate.currentTimeStamp);
            return;
        }

        SGNetwork.postEvent(gate.fqlid, { error: "Malformed request"});
        return;
    }

}