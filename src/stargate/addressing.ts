/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

// NOTE: Not used for cryptographically sensitive operations.
import SHA1 from 'sha1';

import bigInt from 'big-integer';
import { SGDB, SGDBLocationEntry } from './database';

export interface SGLocationData extends SGDBLocationEntry {
    seq_numbers: number[];
    seq_string: string;
    galaxy: string;
}

export default class SGAddressing {
    // 3.010.936.384 - 39 symbols, we leave out the 0th symbol, six digits.
    private static addrspace = bigInt(38).pow(6);

    /**
     * Returns the numeric ID of the given world within the targeted galaxy.
     * @param location the in-galaxy location descriptor (as used from the commandline preferred)
     */
    public static getLocationId(location: string): number {
        const sha1 = SHA1(location) as string;

        // Coordinate sequence is one of the 39 symbols, except the origin symbol at 0
        let lid = bigInt(sha1, 16);
        lid = lid.remainder(this.addrspace);

        return lid.valueOf();
    }

    /**
     * Returns the number of digits needed to fully represent the address space within the given number base.
     * With the default 38, it is exactly 6 digits, more with a narrower base
     * @param base the numbering base, usu. 38
     */
    public static getRequiredDigits(base: number): number {
        const res = Math.log(this.addrspace.valueOf()) / Math.log(base);
        return Math.ceil(res);
    }

    /**
     * Return the number sequence for the given location, represented in the given numbering base
     * @param location in-galaxy target location, either as numeric id or as location string
     * @param base desired numbering base
     */
    public static getLocationIdSequence(location: string | number, base: number): number[] {
        if (typeof location !== 'number') location = this.getLocationId(location);

        const digits = this.getRequiredDigits(base);
        const seq: number[] = [];

        // Coordinate sequence is one of the 39 symbols, except the origin symbol at 0
        let lid = location;
        for (let i = 0; i < digits; i++) {
            seq.push((lid % base) + 1);
            lid = Math.floor(lid / base);
        }

        return seq;
    }

    public static getLocationIdNumber(sequence: number[], base: number): number {
        let lid = 0;
        let digitvalue = 1;

        for (const digit of sequence) {
            lid = lid + (digit - 1) * digitvalue;
            digitvalue = digitvalue * base;
        }

        return lid;
    }

    /**
     * Transforms the symbol sequence numbers to the representative sequence string
     * @param sequence gate symbol sequence represented in symbol numbers, any length, any base
     */
    public static toLetters(sequence: number[] | number): string {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

        if (typeof sequence === 'number') sequence = [ sequence ];

        let str = "";
        for (const key of sequence) {
            if (key < 26) str = str + String.fromCharCode(key + lowerA);
            else str = str + String.fromCharCode(key - 26 + upperA);
        }

        return str;
    }

    /**
     * Parses the sequence string and returns the sequence in numbers
     * @param str the sequence string
     */
    public static toNumbers(str: string): number[] {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);
        const seq: number[] = [];

        for (const letter of str) {
            const cc = letter.charCodeAt(0);
            if (cc >= lowerA) seq.push(cc      - lowerA);
            else if (cc >= upperA) seq.push(cc + 26 - upperA);
            else seq.push(0);
        }

        return seq;
    }

    // At this moment a complete database would be overkill....

    public static getGalaxyDigit(srcgalaxy: string): number {
        if (srcgalaxy === 'altspace') return 1;
        if (srcgalaxy === 'sansar') return 2;
        return 0;
    }

    private static lookupGalaxy(gDigit: number): string {
        if (gDigit === 1) return 'altspace';
        if (gDigit === 2) return 'sansar';
        return 'unknown';
    }

    /**
     * Analyzes and normalizes the entered dialing sequence, yielding the ID of a (possible) target and the
     * target galaxy. Doesn't do target lookups at this point.
     * @param seq dial sequence, as entered
     * @param base number base of the dial computer
     * @param srcgalaxy the source galaxy the dial computer and its gate resides in
     */
    public static analyzeLocationId(
        seq: string | number[] | number,
        base: number,
        srcgalaxy: string | number): SGLocationData {
        const result: SGLocationData = {
            seq_numbers: [],
            seq_string: '',
            lid: 0,
            gid: 0,
            location: 'unknown',
            lastseen: 'unknown',
            galaxy: 'unknown'
        };

        if (typeof srcgalaxy === 'string') {
            result.gid = this.getGalaxyDigit(srcgalaxy);
        } else {
            result.gid = srcgalaxy;
        }

        if (typeof seq === 'number') {
            seq = this.getLocationIdSequence(seq, base);
        }

        if (typeof seq === 'string') {
            seq = this.toNumbers(seq);
        }

        if (seq.length === 0) {
            result.lastseen = '@empty_sequence';
            return result;
        }

        const digits = this.getRequiredDigits(base);

        // Remove the 'a', if given
        if (seq[seq.length - 1] === 0) {
            seq = seq.concat();
            seq.pop();
        }

        // Remove and save the galaxy area digit if given
        if (seq.length > digits)  {
            seq = seq.concat();
            result.gid = seq.pop();
        }

        // Still there's a mistake in the address
        if (seq.length !== digits) {
            result.lastseen = '@malformed_address';
            return result;
        }

        result.seq_numbers = seq;
        result.seq_string = this.toLetters(seq);
        result.galaxy = this.lookupGalaxy(result.gid);
        result.lid = this.getLocationIdNumber(seq, base);

        return result;
    }

    /**
     * Looks up a dialed target and fills in the gaps
     * @param seq Entered sequence, as string or as numbers, or location id (if in same galaxy)
     * @param base The numbering base of the sequence, usu. 38
     * @param srcgalaxy Source galaxy, either by name or by ID.
     */
    public static async lookupDialedTarget(
        seq: string | number[] | number,
        base: number,
        srcgalaxy: string | number): Promise<SGLocationData> {

        const result = this.analyzeLocationId(seq, base, srcgalaxy);
        if (result.lastseen[0] === '@') return Promise.reject(result);

        return SGDB.getLocationData(result.lid, result.gid).then((res: SGDBLocationEntry) => {
            return Promise.resolve({ ...result, ...res});
        }).catch((err) => Promise.reject(result));
    }

    /**
     * Looks up a location and either returns what a gate address could be (if not in database)
     * or the actual gate address within its galaxy
     * @param location Location, as known in the galaxy
     * @param base Numbering base to generate the sequence with
     * @param srcgalaxy Source galaxy, either by name or by ID
     */
    public static async lookupGateAddress(
        location: string,
        base: number,
        srcgalaxy: string | number): Promise<SGLocationData> {
        let result: SGLocationData = {
            seq_numbers: [],
            seq_string: '',
            lid: 0,
            gid: 0,
            location: 'unknown',
            lastseen: 'unknown',
            galaxy: 'unknown'
        };

        if (typeof srcgalaxy === 'string') {
            result.gid = this.getGalaxyDigit(srcgalaxy);
        } else {
            result.gid = srcgalaxy;
        }

        return SGDB.getLocationData(location, result.gid).then((res: SGDBLocationEntry) => {
            result = this.analyzeLocationId(res.lid, base, res.gid);
            return Promise.resolve({ ...result, ...res});
        }).catch((err) => {
            const locid = this.getLocationId(location);
            result = this.analyzeLocationId(locid, base, result.gid);
            return Promise.reject(result);
        });
    }

    /**
     * Return a fully qualified location string uniquely identifying the location even across galaxies'
     * @param location In-Galaxy location string, architecture dependent
     * @param galaxy numerical ID or name of the galaxy
     */
    public static fqlid(location: string, galaxy: number | string) {
        if (typeof galaxy === 'number') {
            galaxy = this.lookupGalaxy(galaxy);
        }
        return galaxy + "/" + location;
    }
}
