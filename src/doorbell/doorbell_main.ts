/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    MediaInstance,
    ParameterSet,
    SetAudioStateOptions,
    User} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";

import { ContextLike } from "../frameworks/context/types";

import DoorGuard from "../DoorGuard";
import { initSound, restartSound } from "../helpers";

export default class Doorbell extends Applet {

    private soundURL: string = "https://altvr-distro.azureedge.net/uploads/" +
        "audio_clip/audio/1425522904870683552/ogg_275072__kwahmah-02__doorbell-a.ogg";

    private soundFX: MediaInstance = null;
    private bellRoot: Actor = null;

    private minPause = 1;
    private maxBurst = 3;
    private burstTime = 5;
    private distance = 10.0;

    private burstStart = 0;
    private burstCount = 0;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);

        if (params.soundURL) this.soundURL = params.soundURL as string;
        if (params.minPause) this.minPause = +params.minPause;
        if (params.maxBurst) this.maxBurst = +params.maxBurst;
        if (params.burstTime) this.burstTime = +params.burstTime;
        if (params.distance) this.distance = +params.distance;

        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
    }

    private started = async () => {
        this.bellRoot = this.context.CreateEmpty();

        this.soundFX = initSound(this.context.assets, this.bellRoot, this.soundURL, {
            rolloffStartDistance: this.distance
        });
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        this.ringBell(user);
    }

    private ringBell = async (user: User) => {
        const currentTime = new Date().getTime() / 1000;

        if (this.burstStart + this.minPause >= currentTime) return;

        if (this.burstStart + this.burstTime < currentTime) {
            this.burstStart = currentTime;
            this.burstCount = 0;
        } else {
            if (this.burstCount++ > this.maxBurst) return;
        }

        restartSound(this.soundFX, {
            rolloffStartDistance: this.distance
        });
    }
}
