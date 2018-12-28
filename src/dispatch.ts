/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Context, ParameterSet } from "@microsoft/mixed-reality-extension-sdk";
import Applet from "./Applet";
import { single_param } from "./helpers";

import AssetPreloadTest from "./asset-preload";
import HelloWorld from "./helloworld";
import Stargate from "./stargate/main";
import SGDialComp from "./stargate/sg_dialcomp";

import WebSocket from 'ws';

/**
 * Contains the names and the factories for the given applets
 */
const registry: { [key: string]: () => Applet } = {
    helloworld: (): Applet => new HelloWorld(),
    stargate: (): Applet => new Stargate(),
    sgdialcomp: (): Applet => new SGDialComp(),
    asset_preload: (): Applet => new AssetPreloadTest(),
};

/**
 * Contains the names and the static functions for the control connections to be routed to
 */
const registryControl: { [key: string]: (ws: WebSocket, data: object) => void } = {
    stargate: (ws: WebSocket, data: object) => Stargate.control(ws, data),
};

/**
 * Dispatch the instantiation to distinct applets.
 * @param context The context of the WebSession
 * @param parameter The parameter set of the WebSession, URLdecoded and split along key=value lines
 * @param baseUrl The base URL of the system, useful for backreferences
 */
export function dispatch(context: Context, parameter: ParameterSet, baseUrl: string): void {
    const name = single_param(parameter.name);

    if (!name) {
        console.error(`No name given: Use an URL like ${baseUrl}/app?name=yourappname to select an app`);
        return;
    }

    try {
        const applet = registry[name];
        if (!applet) {
            console.error(`Unrecognized applet: ${name}`);
        } else {
            applet().init(context, parameter, baseUrl);
        }
    } catch (e) {
        console.error(e.message);
    }
}

export function dispatchControl(ws: WebSocket, payload: string) {
    try {
        const data = JSON.parse(payload);

        if (!data.name) {
            console.error(`Incoming request -- no name given`);
        }

        const cnt = registryControl[data.name];
        if (!cnt) {
            console.error(`Unrecognized control request for ${data.name}`);
        } else {
            cnt(ws, data);
        }
    } catch (e) {
        console.error(e.message);
    }
}
