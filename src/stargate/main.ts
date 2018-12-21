/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    AnimationKeyframe,
    AssetGroup,
    Context,
    ParameterSet,
    Quaternion,
    Vector3
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import { delay } from "../helpers";

export default class Stargate extends Applet {

    private gateFrame: Actor = null;
    private gateRing: Actor = null;
    private gateChevrons: Actor[] = [ null, null, null, null, null, null, null, null, null ];
    private chevronLitPrefabs: AssetGroup;
    private chevronUnlitPrefabs: AssetGroup;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
    }

    private generateBaseRotationFrames(index: number): AnimationKeyframe[] {
        return [{
            time: 0,
            value: { transform: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI * index * 40 / 180) } }
        }, {
            time: 1,
            value: { transform: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI * index * 40 / 180) } }
        }, {
            time: 2,
            value: { transform: { rotation: Quaternion.RotationAxis(Vector3.Right(), Math.PI * index * 40 / 180) } }
        }];
    }

    /**
     * Light up or switch off the given chevron
     * @param index No. of chevron (0-8)
     * @param state lit state
     */
    private replaceChevron(index: number, state: boolean): Actor {

        // Remove old chevron
        if (this.gateChevrons[index]) {
            this.gateChevrons[index].destroy();
            this.gateChevrons[index] = null;
        }

        const chevronPromise = Actor.CreateFromPrefab(
            this.context,
            {
                prefabId: (state ? this.chevronLitPrefabs : this.chevronUnlitPrefabs).prefabs.byIndex(0).id,
                actor: {
                    name: 'Gate Chevron ' + index,
                }
            }
        );
        const chev: Actor = chevronPromise.value;
        chev.createAnimation({
            animationName: 'Gate Chevron ' + index + ' rotation',
            keyframes: this.generateBaseRotationFrames(index),
            events: []
        });
        chev.startAnimation('Gate Chevron ' + index + ' rotation');

        this.gateChevrons[index] = chev;

        return chev;
    }

    /**
     * Reset the gate to its idle state
     */
    private resetGate(): void {
        let i = 0;
        for (i = 2; i < 3; ++i) {
            this.replaceChevron(i, true);
        }
    }

    public async loadAssets(): Promise<void> {
        const chevronLitPrefabs =
            this.context.assets.loadGltf('chevron_lit', `${this.baseUrl}/stargate/Chevron_lit.glb`)
            .catch(reason => console.log(`Cannot load Chevron_lit.glb. Reason: ${reason}`));

        const chevronUnlitPrefabs =
            this.context.assets.loadGltf('chevron_unlit', `${this.baseUrl}/stargate/Chevron_unlit.glb`)
            .catch(reason => console.log(`Cannot load Chevron_unlit.glb. Reason: ${reason}`));

        await this.context.assets.ready();
    }

    private started = () => {

        this.loadAssets().then(this.resetGate);

        const gateFramePromise = Actor.CreateFromGLTF(
            this.context,
            {
                resourceUrl: `${this.baseUrl}/stargate/Gate_Frame.glb`,
                actor: {
                    name: 'Gate Frame'
                }
            }
        );

        const gateRingPromise = Actor.CreateFromGLTF(
            this.context,
            {
                resourceUrl: `${this.baseUrl}/stargate/Gate_Ring.glb`,
                actor: {
                    name: 'Gate Ring'
                }
            }
        );

        this.gateFrame = gateFramePromise.value;
        this.gateRing = gateRingPromise.value;
    }
}
