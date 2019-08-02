/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { ContextLike } from "./types";

import {
    Actor,
    Context,
    User,
} from "@microsoft/mixed-reality-extension-sdk";

// tslint:disable:variable-name
export class RawContext implements ContextLike {

    constructor(private _baseContext: Context) {
    }

    public get baseContext() { return this._baseContext; }

    public get sessionId() { return this._baseContext.sessionId; }
    public get conn() { return this._baseContext.conn; }
    public get actors() { return this._baseContext.actors; }
    public get rootActors() { return this._baseContext.rootActors; }
    public get users() { return this._baseContext.users; }

    public onStarted(handler: () => void): this { this._baseContext.onStarted(handler); return this; }
    public onStopped(handler: () => void): this { this._baseContext.onStopped(handler); return this; }
    public onUserJoined(handler: (user: User) => void): this { this._baseContext.onUserJoined(handler); return this; }
    public onUserLeft(handler: (user: User) => void): this { this._baseContext.onUserLeft(handler); return this; }

    public announceSelf() {
        this.baseContext.emitter.emit('started');
        for (const user in this.baseContext.users) {
            if (this.baseContext.users.hasOwnProperty(user)) {
                this.baseContext.emitter.emit('user-joined', this.baseContext.users[user]);
            }
        }
    }

    public CreateEmpty(options?: any): Actor {
        return Actor.CreateEmpty(this.baseContext, options);
    }

    public CreateFromLibrary(options: any): Actor {
        return Actor.CreateFromLibrary(this.baseContext, options);
    }

    public CreateFromGLTF(options: any): Actor {
        return Actor.CreateFromGLTF(this.baseContext, options);
    }

    public CreateFromPrefab(options: any): Actor {
        return Actor.CreateFromPrefab(this.baseContext, options);
    }

    public CreatePrimitive(options: any): Actor {
        return Actor.CreatePrimitive(this.baseContext, options);
    }
}
