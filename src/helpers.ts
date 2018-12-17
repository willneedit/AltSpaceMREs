/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { Actor } from "@microsoft/mixed-reality-extension-sdk";

/**
 * Return a single string param, either the param itself or the first one listed
 * @param param the value of one param in a ParameterSet
 */
export function single_param(param: string | string[]): string {
    if (Array.isArray(param) && param.length > 0) {
        return param[0];
    } else {
        return param as string;
    }
}

/**
 * Delay execution for the given amount of time. Use like 'await delay(1000)'
 * @param milliseconds Time to wait
 */
export function delay(milliseconds: number): Promise<void> {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), milliseconds);
    });
}

/**
 * Destroys a single actor or a whole array of actors
 * @param actors The actor(s) to remove.
 */
export function destroyActors(actors: Actor | Actor[]): Actor[] {
    if (!Array.isArray(actors)) {
        actors = [actors];
    }
    for (const actor of actors) {
        actor.destroy();
    }
    return [];
}
