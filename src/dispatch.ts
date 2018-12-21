/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Context, ParameterSet } from "@microsoft/mixed-reality-extension-sdk";
import Applet from "./Applet";
import { single_param } from "./helpers";

import HelloWorld from "./helloworld";
import Stargate from "./stargate/main";

/**
 * Contains the names and the factories for the given applets
 */
const registry: { [key: string]: () => Applet } = {
    helloworld: (): Applet => new HelloWorld(),
    stargate: (): Applet => new Stargate(),
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

    const applet = registry[name]();
    if (!applet) {
        console.error(`Unrecognized applet: ${name}`);
    } else {
        applet.init(context, parameter, baseUrl);
    }
}
