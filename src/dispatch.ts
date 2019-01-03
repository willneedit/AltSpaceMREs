/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Context, ParameterSet } from "@microsoft/mixed-reality-extension-sdk";
import Applet from "./Applet";
import { single_param } from "./helpers";

import WebSocket from 'ws';

import AssetPreloadTest from "./asset-preload";
import HelloWorld from "./helloworld";
import SGDialComp from "./stargate/sg_dialcomp";
import Stargate from "./stargate/sg_main";

import ShowGLTF from "./gltf/gltf_main";
import SGNetwork from "./stargate/sg_network";

/**
 * Contains the names and the factories for the given applets
 */
const registry: { [key: string]: () => Applet } = {
    helloworld: (): Applet => new HelloWorld(),
    stargate: (): Applet => new Stargate(),
    sgdialcomp: (): Applet => new SGDialComp(),
    asset_preload: (): Applet => new AssetPreloadTest(),
    gltf: (): Applet => new ShowGLTF(),
};

/**
 * Contains the names and the static functions for the control connections to be routed to
 */
const registryControl: { [key: string]: (ws: WebSocket, data: ParameterSet) => void } = {
    stargate: (ws: WebSocket, data: ParameterSet) => Stargate.control(ws, data),
    hb: (ws: WebSocket, data: ParameterSet) => { }
};

/**
 * Contains a list of functions needed to call before the service goes online.
 */
const registryStartup: { [key: string]: () => void } = {
    sgnetwork: () => SGNetwork.loadNetwork(),
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
        const data: ParameterSet = JSON.parse(payload);

        if (!data.name) {
            console.error(`Incoming request -- no name given`);
            return;
        }

        const name = data.name as string;

        const cnt = registryControl[name];
        if (!cnt) {
            console.error(`Unrecognized control request for ${name}`);
        } else {
            cnt(ws, data);
        }
    } catch (e) {
        console.error(e.message);
    }
}

export function dispatchStartup() {
    for ( const key in registryStartup) {
        if (registryStartup.hasOwnProperty(key)) {
            registryStartup[key]();
        }
    }
}
