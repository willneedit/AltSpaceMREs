/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Context, ParameterSet } from "@microsoft/mixed-reality-extension-sdk";
import Applet from "./Applet";
import { single_param } from "./helpers";

import WebSocket from 'ws';

import DemonGate from "./demongate/demongate_main";
import HelloWorld from "./helloworld";
import SGDCDebug from "./stargate/sg_dc_debug";
import SGDCDHD from "./stargate/sg_dc_dhd";
import Stargate from "./stargate/sg_main";

import SGNetwork from "./stargate/sg_network";

import ShowGLTF from "./gltf/gltf_main";
import ShowKitObj from "./kit/kit_main";

import DoorGuard from "./DoorGuard";

/**
 * Contains the names and the factories for the given applets
 */
const registry: { [key: string]: () => Applet } = {
    helloworld: (): Applet => new HelloWorld(),
    stargate: (): Applet => new Stargate(),
    sgdialcomp: (): Applet => new SGDCDHD(),
    gltf: (): Applet => new ShowGLTF(),
    kit: (): Applet => new ShowKitObj(),
    demongate: (): Applet => new DemonGate(),
};

/**
 * Contains the names and the static functions for the control connections to be routed to
 */
const registryControl: { [key: string]: (ws: WebSocket, data: ParameterSet) => void } = {
    sg_register_init: (ws: WebSocket, data: ParameterSet) => SGNetwork.sgRegisterInit(ws, data),
    sg_register: (ws: WebSocket, data: ParameterSet) => SGNetwork.sgRegister(ws, data),
    sg_admin: (ws: WebSocket, data: ParameterSet) => SGNetwork.sgAdmin(ws, data),
    hb: (ws: WebSocket, data: ParameterSet) => { }
};

/**
 * Contains a list of functions needed to call before the service goes online.
 */
const registryStartup: { [key: string]: () => void } = {
    sgnetwork: async () => await SGNetwork.loadNetwork(),
    DoorGuard: async () => await DoorGuard.init(),
};

/**
 * Dispatch the instantiation to distinct applets.
 * @param context The context of the WebSession
 * @param parameter The parameter set of the WebSession, URLdecoded and split along key=value lines
 * @param baseUrl The base URL of the system, useful for backreferences
 */
export function dispatch(context: Context, parameter: ParameterSet, baseUrl: string): void {
    let name = single_param(parameter.name);

    if (!name) {
        name = "helloworld";
        console.error(`No name given: Use an URL like ${baseUrl}/app?name=yourappname to select an app`);
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

export async function dispatchStartup() {
    for ( const key in registryStartup) {
        if (registryStartup.hasOwnProperty(key)) {
            await registryStartup[key]();
        }
    }
}
