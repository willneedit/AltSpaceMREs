/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import * as MRESDK from '@microsoft/mixed-reality-extension-sdk';
import Applet from './Applet';
import { delay, destroyActors } from './helpers';

export default class AssetPreloadTest extends Applet {

    public init(context: MRESDK.Context, params: MRESDK.ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.run);
    }

    public async run(): Promise<boolean> {
        const label = await MRESDK.Actor.CreateEmpty(this.context, {
            actor: {
                transform: {
                    position: { x: 0, y: 2, z: 0 }
                },
                lookAt: MRESDK.LookAtMode.LocalUserXY,
                text: {
                    contents: 'Initialized',
                    height: 0.3,
                    anchor: MRESDK.TextAnchorLocation.BottomCenter
                }
            }
        });
        await delay(1000);

        label.text.contents = 'Preloading asset';
        const group = await this.context.assets.loadGltf('monkey', this.baseUrl + '/monkey.glb');
        label.text.contents = 'Asset preloaded';
        await delay(1000);

        label.text.contents = 'Instantiating prefab';
        const actor = await MRESDK.Actor.CreateFromPrefab(this.context, {
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
