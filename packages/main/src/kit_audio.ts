/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	Actor, Context, ScaledTransform, Vector3,
} from '@microsoft/mixed-reality-extension-sdk';

interface AudioEntry {
	ctx: Context;
	actor: Actor;
}

export default class KitAudio {
	private static sources: { [cid: string]: AudioEntry } = { };

	public static startSound(context: Context, id: string, pos?: Partial<ScaledTransform>) {

		this.stopSound(context, id);

		const cid = context.sessionId + "@" + id;

		if (!pos) pos = { scale: new Vector3(1.0, 1.0, 1.0)};

		this.sources[cid] = {
			ctx: context,
			actor: Actor.CreateFromLibrary(context, {
				resourceId: id,
				actor: {
					transform: { local: pos }
				}
			})
		};

		return this.sources[id];
	}

	public static stopSound(context: Context, id: string) {
		const cid = context.sessionId + "@" + id;

		if (this.sources[cid]) {
			this.sources[cid].actor.destroy();
		}

		this.sources[cid] = null;
	}
}
