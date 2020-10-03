/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

 /**
  * This is an extended Hello World sample, derived from the one found in
  * @microsoft/mixed-reality-extension-sdk-samples, courtesy of Microsoft.
  */
import {
    Actor,
    AnimationEaseCurves,
    ButtonBehavior,
    ParameterSet,
    PrimitiveShape,
    TextAnchorLocation,
    User,
} from '@microsoft/mixed-reality-extension-sdk';

// tslint:disable:no-bitwise
import Applet from "../Applet";
import { ContextLike } from '../frameworks/context/types';

import DoorGuard from '../DoorGuard';

/**
 * The main class of this app. All the logic goes here.
 */
export default class DragNDropTest extends Applet {
    private sphere: Actor = null;
    private receptacle: Actor = null;
    private announce: Actor = null;

    private mode = 0;
    private modechangetime = 0;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onStarted(this.started);
        this.context.onUserJoined(this.userjoined);
    }

    /**
     * Once the context is "started", initialize the app.
     */
    private started = () => {
        this.receptacle = this.context.CreatePrimitive({
            definition: {
                shape: PrimitiveShape.Box,
                dimensions: { x: 0.5, y: 0.5, z: 0.5 }
            },
            addCollider: true,
            actor: {
                name: "Receptacle",
                transform: { local: { position: { x: 0.0, y: 0.0, z: 0.0 } } }
            }
        });

        this.sphere = this.context.CreatePrimitive({
            definition: {
                shape: PrimitiveShape.Sphere,
                dimensions: { x: 0.1, y: 0.1, z: 0.1 }
            },
            addCollider: true,
            actor: {
                name: "Item",
                transform: { local: { position: { x: 1.0, y: 0.0, z: 0.0 } } },
                subscriptions: [ 'transform' ]
            }
        });

        this.announce = this.context.CreateEmpty({
            actor: {
                name: "Announcement",
                transform: { local: { position: { x: 0.0, y: 1.0, z: 0.0 } } },
                text: {
                    contents: "",
                    anchor: TextAnchorLocation.MiddleCenter,
                    color: { r: 1.0, g: 1.0, b: 1.0 },
                    height: 0.3
                }
            }
        });

        this.sphere.grabbable = true;
        this.sphere.onGrab('begin', (user: User) => { this.handleAction(user, 1); } );
        this.sphere.onGrab('end', (user: User) => { this.handleAction(user, ~1); } );

        // const behavior = this.receptacle.setBehavior(ButtonBehavior);
        // behavior.onHover('enter', (user: User) => { this.handleAction(user, 2); } );
        // behavior.onHover('exit', (user: User) => { this.handleAction(user, ~2); } );

        this.setAnnouncement("Grab the sphere and place it inside the cube");

    }

    private setAnnouncement(str: string) {
        this.announce.text.contents = str;
    }

    private userjoined = (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
    }

    private handleAction(user: User, modechange: number) {
        if (modechange < 0) this.mode = this.mode & modechange;
        else this.mode = this.mode | modechange;
        const currentTime = new Date().getTime();

        const pos1 = this.receptacle.transform.app.position;
        const pos2 = this.sphere.transform.app.position;
        const dvec = pos1.subtract(pos2);

        switch (this.mode) {
            case 0:
                if ( dvec.lengthSquared() < 0.25) {
                    this.setAnnouncement('Looks good!');
                    this.sphere.animateTo({
                        transform: { local: { position: { x: pos1.x, y: pos1.y, z: pos1.z }}}
                    }, 0.5, AnimationEaseCurves.EaseInOutSine);
                } else {
                    this.setAnnouncement('Nope, try again.');
                    this.sphere.animateTo({
                        transform: { local: { position: { x: 1.0, y: 0.0, z: 0.0 }}}
                    }, 1.0, AnimationEaseCurves.EaseInOutSine);
                }
                break;
            case 1:
                this.setAnnouncement('Good. Now place it in the cube.');
                break;
            default:
                this.setAnnouncement(`Unknown mode: ${this.mode}`);
        }
    }
}
