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
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

export default class DemonGate extends Applet {
    private initialized = false;

    private candleId = 'artifact:1149165753065275931';
    private candleFlameId = 'artifact:1149165752914280986';
    private pentagramLineId = 'artifact:1149165752729731609';
    private gateFrameId = 'artifact:1149165758366876188';
    private gateInsetId = 'artifact:1149165763660087837';

    private candles: Actor[] = [ null, null, null, null, null ];
    private candleFlames: Actor[] = [ null, null, null, null, null ];
    private pentagramLines: Actor[] = [ null, null, null, null, null ];
    private gateInset: Actor = null;

    public init(context: Context, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
    }

    private userjoined = async (user: User) => {
        console.log(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
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
                this.pentagramLines[i] = Actor.CreateFromLibrary(this.context, {
                    resourceId: this.pentagramLineId,
                    actor: {
                        parentId: this.candles[i].id,
                        transform: {
                            position: { x: 0.0, y: 0.1, z: 0.0 }
                        }
                    }
                }).value;
            }
        }

        if (!allLit && this.gateInset !== null) {
            this.gateInset.destroy();
            this.gateInset = null;
        } else if (allLit && this.gateInset === null ) {
            this.gateInset = Actor.CreateFromLibrary(this.context, {
                resourceId: this.gateInsetId,
            }).value;
        }
    }

    protected candleTouched(userid: string, i: number) {
        if (this.candleFlames[i] !== null) {
            this.candleFlames[i].destroy();
            this.candleFlames[i] = null;
        } else {
            this.candleFlames[i] = Actor.CreateFromLibrary(this.context, {
                resourceId: this.candleFlameId,
                actor: {
                    parentId: this.candles[i].id,
                    transform: {
                        position: { x: 0.0, y: 0.11, z: 0.0 }
                    }
                }
            }).value;
        }

        this.evaluatePentLines();
    }

    protected makeCandleCallback(i: number): ActionHandler {
        return (userid: string) => this.candleTouched(userid, i);
    }

    private started = async () => {
        if (this.initialized) return;

        this.initialized = true;

        Actor.CreateFromLibrary(this.context, {
            resourceId: this.gateFrameId,
            actor: {
                transform: {
                    scale: { x: 0.01, y: 0.01, z: 0.01 } // Why? Oculus Medium import oddity?
                }
            }
        });

        for (let i = 0; i < 5; i++) {
            const rot = await Actor.CreateEmpty(this.context, {
                actor: {
                    transform: {
                        rotation: Quaternion.RotationAxis(Vector3.Up(), DegreesToRadians * 72 * i)
                    }
                }
            });

            this.candles[i] = await Actor.CreateFromLibrary(this.context, {
                resourceId: this.candleId,
                actor: {
                    parentId: rot.id,
                    transform: {
                        position: { x: 2.0, y: 0.0, z: 0.0}
                    }
                }
            });

            this.candles[i].setBehavior(ButtonBehavior).onClick('pressed', this.makeCandleCallback(i));
        }
    }
}
