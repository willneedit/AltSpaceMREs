/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import Applet from "../Applet";
import DoorGuard from "../DoorGuard";

import { ContextLike } from "../frameworks/context/types";

import { ParameterSet, User } from "@microsoft/mixed-reality-extension-sdk";

import BasicDoor from "../frameworks/door/door";

export default class GenericDoor extends Applet {
    private initialized = false;

    private door: BasicDoor = null;

    public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
        super.init(context, params, baseUrl);
        this.context.onUserJoined(this.userjoined);
        this.context.onStarted(this.started);
        this.context.onStopped(this.stopped);
    }

    private userjoined = async (user: User) => {
        console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
        DoorGuard.greeted(user.properties.remoteAddress);
    }

    private started = () => {
        this.door = new BasicDoor();
        this.door.started(this.context, this.parameter.def as string);
    }

    private stopped = () => {
        this.door.stopped();
    }
}
