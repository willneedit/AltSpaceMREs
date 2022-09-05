/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { SGDBLike, SGDBLocationEntry } from "./database";

export class SGDBlite implements SGDBLike {
    public async init() {
        return Promise.reject("No SQLite database");
    }

    public async getLocationData(lid: number | string, gid: number): Promise<SGDBLocationEntry> {
        const loc : SGDBLocationEntry = null;
        return loc;
    }

    public async updateTimestamp(lid: number | string, gid: number): Promise<void> {

    }

    private getWhereClause(lid: string | number, gid: number) {

    }

    public async registerLocation(lid: number, gid: number, location: string) {

    }

    public deleteLocation(gid: number, location: string) {

    }
}

