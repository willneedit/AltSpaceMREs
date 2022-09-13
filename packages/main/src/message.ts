/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    Context,
    TextAnchorLocation
} from "@microsoft/mixed-reality-extension-sdk";
import { delay } from "./helpers";

export default class Message {
    private msgActor: Actor = null;

    constructor(private context: Context, private message: string, private timeout = 0) {
        const textPromise = Actor.CreateEmpty(this.context, {
            actor: {
                name: 'Text',
                transform: {
                    local: { position: { x: 0, y: 0.5, z: 0 } }
                },
                text: {
                    contents: message,
                    anchor: TextAnchorLocation.MiddleCenter,
                    color: { r: 255 / 255, g: 255 / 255, b: 255 / 255 },
                    height: 0.3
                }
            }
        });

        this.msgActor = textPromise;
        if (timeout > 0) {
            this.showtimed();
        }
    }

    public destroy(): void {
        this.msgActor.destroy();
    }

    public async showtimed(): Promise<void> {
        await delay(this.timeout);
        this.destroy();
    }
}
