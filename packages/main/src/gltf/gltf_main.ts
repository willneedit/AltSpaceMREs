/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
	ParameterSet,
	User
} from "@microsoft/mixed-reality-extension-sdk";

import Applet from "../Applet";

import { ContextLike } from "../frameworks/context/types";

export default class ShowGLTF extends Applet {
	private initialized = false;

	public init(context: ContextLike, params: ParameterSet, baseUrl: string) {
		super.init(context, params, baseUrl);
		this.context.onUserJoined(this.userjoined);
	}

	private userjoined = (user: User) => {
		console.debug(`Connection request by ${user.name} from ${user.properties.remoteAddress}`);
		this.started();
	}

	private started = () => {
		if (this.initialized) return;

		this.initialized = true;

		const gltfName = this.parameter.gltf as string;
		const anim = this.parameter.animate !== undefined;

		const model = this.context.CreateFromGLTF({
			uri: gltfName,
			actor: {
				name: `Model URL: ${gltfName}`
			}
		});

		if (anim) {
			const animName = (this.parameter.animate === null) ? 'animation:0' : this.parameter.animate as string;
			model.targetingAnimationsByName.get(animName).play();
		}
	}
}
