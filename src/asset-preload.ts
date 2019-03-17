/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRESDK from '@microsoft/mixed-reality-extension-sdk';
import Applet from './Applet';
import { delay, destroyActors } from './helpers';

import { ContextLike } from './delegator/types';

export default class AssetPreloadTest extends Applet {

    public init(context: ContextLike, params: MRESDK.ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.run);
    }

    public run = async (): Promise<boolean> =>  {
        const label = await this.context.CreateEmpty({
            actor: {
                transform: {
                    position: { x: 0, y: 2, z: 0 }
                },
                // lookAt: MRESDK.LookAtMode.TargetXY,
                text: {
                    contents: 'Initialized',
                    height: 0.3,
                    anchor: MRESDK.TextAnchorLocation.BottomCenter
                }
            }
        });
        await delay(1000);

        label.text.contents = 'Preloading asset';
        const group = await this.context.assetManager.loadGltf('monkey', this.baseUrl + '/monkey.glb');
        label.text.contents = 'Asset preloaded';
        await delay(1000);

        label.text.contents = 'Instantiating prefab';
        const actor = await this.context.CreateFromPrefab({
            prefabId: group.prefabs.byIndex(0).id,
            actor: {
                transform: {
                    position: { x: 0, y: 1, z: 0 }
                }
            }
        });
        label.text.contents = 'Prefab instantiated';
        await delay(10000);

        destroyActors([actor, label]);
        return true;
    }
}
