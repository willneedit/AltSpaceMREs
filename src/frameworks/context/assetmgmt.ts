/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { AssetContainer, Context } from "@microsoft/mixed-reality-extension-sdk";

export class AssetManager {
    private static contexts: { [id: string]: AssetContainer } = { };

    private static getCleanupFn(sesId: string): () => void {
        return () => {
            if (this.contexts[sesId]) {
                console.info(`Unloading Asset Container for ${sesId}`);
                this.contexts[sesId].unload();
                this.contexts[sesId] = undefined;
            }
        };
    }

    public static getAssetContainer(context: Context): AssetContainer {
        if (!this.contexts[context.sessionId]) {
            console.info(`Creating Asset Container for ${context.sessionId}`);
            this.contexts[context.sessionId] = new AssetContainer(context);
            context.onStopped(this.getCleanupFn(context.sessionId));
        }
        return this.contexts[context.sessionId];
    }
}
