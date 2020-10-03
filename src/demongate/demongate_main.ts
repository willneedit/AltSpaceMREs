/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    ActionHandler,
    Actor,
    ButtonBehavior,
    Context,
    DegreesToRadians,
    ParameterSet,
    Quaternion,
    User,
    Vector3,
    ButtonEventData,
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

export default class DemonGate extends Applet {
    private initialized = false;

    private candleId = 'artifact:1421875914324575051';
    private candleFlameId = 'artifact:1421875905667531533';
    private pentagramLineId = 'artifact:1421875905801749264';
    private gateFrameId = 'artifact:1421875905935966995';
    private gateInsetId = 'artifact:1421875898067452661';

    private candles: Actor[] = [ null, null, null, null, null ];
    private candleFlames: Actor[] = [ null, null, null, null, null ];
    private pentagramLines: Actor[] = [ null, null, null, null, null ];
    private gateInset: Actor = null;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
        this.started();
    }

    protected evaluatePentLines() {
        let allLit = true;
        for (let i = 0; i < 5; i++) {
            const tgt = (i + 2) % 5;

            const isLit = (this.candleFlames[i] !== null) && (this.candleFlames[tgt] !== null);
            allLit = allLit && isLit;

            if (!isLit && this.pentagramLines[i] !== null) {
                this.pentagramLines[i].destroy();
                this.pentagramLines[i] = null;
            } else if (isLit && this.pentagramLines[i] === null) {
                this.pentagramLines[i] = this.context.CreateFromLibrary({
                    resourceId: this.pentagramLineId,
                    actor: {
                        parentId: this.candles[i].id,
                        transform: {
                            local: {
                                position: { x: 0.0, y: 0.1, z: 0.0 },
                                rotation: Quaternion.RotationAxis(Vector3.Up(), DegreesToRadians * -108)
                            }
                        }
                    }
                });
            }
        }

        if (!allLit && this.gateInset !== null) {
            this.gateInset.destroy();
            this.gateInset = null;
        } else if (allLit && this.gateInset === null ) {
            this.gateInset = this.context.CreateFromLibrary({
                resourceId: this.gateInsetId,
                actor: {
                    transform: {
                        local: {
                            rotation: Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2)
                        }
                    }
                }
            });
        }
    }

    protected candleTouched(user: User, i: number) {
        if (this.candleFlames[i] !== null) {
            this.candleFlames[i].destroy();
            this.candleFlames[i] = null;
        } else {
            this.candleFlames[i] = this.context.CreateFromLibrary({
                resourceId: this.candleFlameId,
                actor: {
                    parentId: this.candles[i].id,
                    transform: {
                        local: {
                            position: { x: 0.0, y: 0.11, z: 0.0 },
                            rotation: Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2)
                        }
                    }
                }
            });
        }

        this.evaluatePentLines();
    }

    protected makeCandleCallback(i: number): ActionHandler<ButtonEventData> {
        return (user: User) => this.candleTouched(user, i);
    }

    private started = async () => {
        if (this.initialized) return;

        this.initialized = true;

        this.context.CreateFromLibrary({
            resourceId: this.gateFrameId,
            actor: {
                transform: {
                    local: {
                        scale: { x: 0.01, y: 0.01, z: 0.01 }, // Why? Oculus Medium import oddity?
                        rotation: Quaternion.RotationAxis(Vector3.Right(), -Math.PI / 2)
                    }
                }
            }
        });

        for (let i = 0; i < 5; i++) {
            const rot = await this.context.CreateEmpty({
                actor: {
                    transform: {
                        local: {
                            rotation: Quaternion.RotationAxis(Vector3.Up(), DegreesToRadians * 72 * i)
                        }
                    }
                }
            });

            this.candles[i] = await this.context.CreateFromLibrary({
                resourceId: this.candleId,
                actor: {
                    parentId: rot.id,
                    transform: {
                        local: {
                            position: { x: 2.0, y: 0.0, z: 0.0}
                        }
                    }
                }
            });

            this.candles[i].setBehavior(ButtonBehavior).onClick(this.makeCandleCallback(i));
        }
    }
}
