/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ForwardPromise,
    SetSoundStateOptions,
    SoundInstance,
} from "@microsoft/mixed-reality-extension-sdk";

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

/**
 * Does a common initialization of a sound object on an actor
 * @param actor The actor the sound is tied to
 * @param url URL of the sound resource
 * @param sssoOvr Partial set of SetSoundStateOptions to deviate from common standards
 */
export function initSound(
    actor: Actor, url: string, sssoOvr?: Partial<SetSoundStateOptions>): ForwardPromise<SoundInstance> {
    const context = actor.context;

    const soundAsset = context.assetManager.createSound('default', {
        uri: url
    }).value;

    const sssoDefaults: SetSoundStateOptions = {
        volume: 0.5,
        looping: false,
        doppler: 1.0,
        rolloffStartDistance: 2.0
    };

    const si = actor.startSound(soundAsset.id, { ...sssoDefaults, ...(sssoOvr || { })});
    si.value.pause();

    return si;
}

/**
 * Restarts the sound from the start or a given offset
 * @param si Sound instance to start over
 * @param sssoOvr Optional: SoundStateOptions to override
 * @param startTimeOffset Optional: Start Time offset
 */
export function restartSound(si: SoundInstance, sssoOvr?: Partial<SetSoundStateOptions>, startTimeOffset?: number) {
    const sssoDefaults: SetSoundStateOptions = {
        volume: 0.5,
        looping: false,
        doppler: 1.0,
        rolloffStartDistance: 2.0
    };
    si.stop();
    si.start({ ...sssoDefaults, ...(sssoOvr || { })}, startTimeOffset);
}
