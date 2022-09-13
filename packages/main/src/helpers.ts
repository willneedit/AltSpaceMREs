/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AssetContainer,
    MediaInstance,
    SetAudioStateOptions,
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
    assets: AssetContainer,
    actor: Actor, url: string, sssoOvr?: Partial<SetAudioStateOptions>): MediaInstance {

    const soundAsset = assets.createSound('default', {
        uri: url
    });

    const sssoDefaults: SetAudioStateOptions = {
        volume: 0.5,
        looping: false,
        doppler: 1.0,
        rolloffStartDistance: 2.0
    };

    const si = actor.startSound(soundAsset.id, { ...sssoDefaults, ...(sssoOvr || { })});
    si.pause();

    return si;
}

/**
 * Restarts the sound from the start or a given offset
 * @param si Sound instance to start over
 * @param sssoOvr Optional: SoundStateOptions to override
 */
export function restartSound(si: MediaInstance, sssoOvr?: Partial<SetAudioStateOptions>) {
    const sssoDefaults: SetAudioStateOptions = {
        volume: 0.5,
        looping: false,
        doppler: 1.0,
        rolloffStartDistance: 2.0
    };
    si.stop();
    si.start({ ...sssoDefaults, ...(sssoOvr || { })});
}
