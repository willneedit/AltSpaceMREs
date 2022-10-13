/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import { ContextLike } from "./types";

import {
	Actor,
	AssetContainer,
	Context,
	User,
} from "@microsoft/mixed-reality-extension-sdk";
import { AssetManager } from "./assetmgmt";

export class RawContext implements ContextLike {

	private _assets: AssetContainer = null;

	constructor(private _baseContext: Context) {
		this._assets = AssetManager.getAssetContainer(_baseContext);
	}

	public get baseContext() { return this._baseContext; }
	public get assets() { return this._assets; }

	public get sessionId() { return this._baseContext.sessionId; }
	public get conn() { return this._baseContext.conn; }
	public get actors() { return this._baseContext.actors; }
	public get rootActors() { return this._baseContext.rootActors; }
	public get users() { return this._baseContext.users; }

	public onStarted(handler: () => void): this { this._baseContext.onStarted(handler); return this; }
	public onStopped(handler: () => void): this { this._baseContext.onStopped(handler); return this; }
	public onUserJoined(handler: (user: User) => void): this { this._baseContext.onUserJoined(handler); return this; }
	public onUserLeft(handler: (user: User) => void): this { this._baseContext.onUserLeft(handler); return this; }

	private cleanup() {
		this.assets.unload();
	}

	public announceSelf() {
		this.baseContext.emitter.emit('started');
		for (const user of this.baseContext.users) {
			this.baseContext.emitter.emit('user-joined', user);
		}
	}

	public CreateEmpty(options?: any): Actor {
		return Actor.CreateEmpty(this.baseContext, options);
	}

	public CreateFromLibrary(options: any): Actor {
		return Actor.CreateFromLibrary(this.baseContext, options);
	}

	public CreateFromGLTF(options: any): Actor {
		return Actor.CreateFromGltf(this.assets, options);
	}

	public CreateFromPrefab(options: any): Actor {
		return Actor.CreateFromPrefab(this.baseContext, options);
	}

	public CreatePrimitive(options: any): Actor {
		return Actor.CreatePrimitive(this.assets, options);
	}
}
