/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Context, ParameterSet } from "@microsoft/mixed-reality-extension-sdk";

import { ContextLike } from "./frameworks/context/types";

export default abstract class Applet {
    // tslint:disable:variable-name
    private _context: ContextLike;
    private _parameter: ParameterSet;
    private _baseUrl: string;
    // tslint:enable:variable-name

    public get context() { return this._context; }
    public get parameter() { return this._parameter; }
    public get baseUrl() { return this._baseUrl; }
    public get sessID() { return this.context.sessionId; }

    public init(context: ContextLike, parameter: ParameterSet, baseUrl: string): void {
        this._context = context;
        this._parameter = parameter;
        this._baseUrl = baseUrl;

        console.info(`Starting: ${this._parameter.name} in ${this._context.sessionId} ...`);
    }
}
