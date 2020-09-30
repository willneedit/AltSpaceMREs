/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

// NOTE: Not used for cryptographically sensitive operations.
import SHA1 from 'sha1';

import bigInt from 'big-integer';
import { SGDB, SGDBLocationEntry } from './sg_database';

export interface SGLocationData extends SGDBLocationEntry {
    seq_numbers: number[];
    seq_string: string;
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
            lid = lid + digit * digitvalue;
            digitvalue = digitvalue * base;
        }

        return lid;
    }

    /**
     * Transforms the symbol sequence numbers to the representative sequence string
     * @param sequence gate symbol sequence represented in symbol numbers, any length, any base
     */
    public static toLetters(sequence: number[]): string {
        const lowerA = "a".charCodeAt(0);
        const upperA = "A".charCodeAt(0);

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

    private static getGalaxyDigit(srcgalaxy: string): number {
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
    public static analyzeLocationId(seq: string | number[] | number, base: number, srcgalaxy: string): SGLocationData {
        const result: SGLocationData = {
            seq_numbers: [],
            seq_string: '',
            id: 'unknown',
            galaxy: 'unknown',
            location: 'unknown',
            locked: true
        };

        let galaxyDigit = this.getGalaxyDigit(srcgalaxy);

        if (typeof seq === 'number') {
            seq = this.getLocationIdSequence(seq, base);
        }

        if (typeof seq === 'string') {
            seq = this.toNumbers(seq);
        }

        if (seq.length === 0) {
            result.id = '@empty_sequence';
            return result;
        }

        const digits = this.getRequiredDigits(base);

        // Remove the 'a', if given
        if (seq[seq.length - 1] === 0) seq.pop();

        // Remove and save the galaxy area digit if given
        if (seq.length > digits) galaxyDigit = seq.pop();

        // Still there's a mistake in the address
        if (seq.length !== digits) {
            result.id = '@malformed_address';
            return result;
        }

        result.seq_numbers = seq;
        result.seq_string = this.toLetters(seq);
        result.galaxy = this.lookupGalaxy(galaxyDigit);
        result.id = this.getLocationIdNumber(seq, base).toString();

        return result;
    }

    public static async lookupDialedTarget(
        seq: string | number[] | number,
        base: number,
        srcgalaxy: string): Promise<SGLocationData> {

        const result = this.analyzeLocationId(seq, base, srcgalaxy);
        if (result.id[0] === '@') return Promise.reject(result.id.substr(1));

        // FIXME: Database refactoring to contain numeric id rather than dial strings
        // Old database format doesn't take base into account.
        const baseChar = "a".charCodeAt(0) - 1;
        const galaxy = result.galaxy;
        const str = result.seq_string + String.fromCharCode(this.getGalaxyDigit(galaxy) + baseChar);

        return SGDB.getLocationDataId(str).then((res: SGDBLocationEntry) => {
            res.id = result.id;
            res.galaxy = result.galaxy;
            return Promise.resolve({ ...result, ...res});
        }).catch((err) => {
            return Promise.resolve(result);
        });
    }
}
