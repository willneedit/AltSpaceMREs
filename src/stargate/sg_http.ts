/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import RS from 'restify';
import { StargateLike, GateStatus } from "./types";
import SGNetwork from "./network";
import SGAddressing, { SGLocationData } from './addressing';

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
            'timestamp': timestamp
        });
    }

    public lightChevron(index: number, silent: boolean): void {
        if (this.gateStatus !== GateStatus.dialing) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "lightChevron",
            'index': index,
            'silent': (silent ? "1" : "0")
        });
    }

    public connect(): void {
        if (this.gateStatus !== GateStatus.dialing) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "connect",
            'tgtFqlid': this.currentTargetFqlid
        });

        this._gateStatus = GateStatus.engaged;
    }

    public disconnect(oldTs: number): void {
        if (this.currentTimeStamp !== oldTs) return;

        SGNetwork.postEvent(this.fqlid, {
            command: "disconnect",
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
        this.registerGate(fqlid);
    }

    public static async control(req: RS.Request): Promise<any> {
        const myFqlid = req.params.fqlid;
        const gate = SGNetwork.getGate(myFqlid);
        const command = req.params.command as string;

        if(command === 'announce') {
            const newGate = new SGHTTP();
            newGate.init(
                req.params.fqlid,
                +req.params.base
            );
            return Promise.resolve("Gate announcement OK");
        } else if(command === 'deannounce') {
            SGNetwork.deannounceGate(req.params.fqlid);
            return Promise.resolve("Gate deannouncement OK");
        }

        if(!gate) return Promise.reject({code: 404, payload: "Gate not present"});

        // Where the Altspace gates call SGNetwork directly, the client-driven gates need ReST API calls.
        // In the end, most of the commands are bounced back to the client.
        if(command === 'startDialing') {
            return gate.startDialing(
                SGAddressing.toNumbers(req.params.tgtSequence),
                new Date().getTime() / 1000).then(() => Promise.resolve("Dialing started")
            ).catch(() => Promise.reject({ code: 404, payload: "Target not found" }));
        } else if(command === 'lightChevron') {
            SGNetwork.gatesLightChevron(
                gate.fqlid,
                gate.currentTargetFqlid,
                +req.params.index,
                !!req.params.silent
            );
            return Promise.resolve("OK");
        } else if(command === 'connect') {
            SGNetwork.gatesConnect(gate.fqlid, gate.currentTargetFqlid);
            return Promise.resolve("OK");
        } else if(command === 'disconnect') {
            SGNetwork.gatesDisconnect(gate.fqlid, gate.currentTargetFqlid, gate.currentTimeStamp);
            return Promise.resolve("OK");
        }

        return Promise.reject({ code: 400, payload: "Malformed request"});
    }

}