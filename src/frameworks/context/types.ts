/*!
 * Copyright (c) iwontsay/willneedit. All rights reserved.
 * Licensed under the MIT License.
 */

import {
    Actor,
    ActorLike,
    AssetContainer,
    Connection,
    Context,
    PrimitiveDefinition,
    SubscriptionType,
    User,
} from "@microsoft/mixed-reality-extension-sdk";

import { CreateColliderType } from "@microsoft/mixed-reality-extension-sdk/built/types/network/payloads";

// tslint:disable:variable-name
export interface ContextLike {
    readonly baseContext: Context;
    readonly assets: AssetContainer;
    readonly sessionId: string;
    readonly conn: Connection;
    readonly actors: Actor[];
    readonly rootActors: Actor[];
    readonly users: User[];
    // actor: (actorId: string) => Actor;
    // user: (userId: string) => User;
    /**
     * Exits this context.
     */
    // quit(): void;
    /**
     * The onStarted event is raised after the Context is fully initialized and ready for your application logic to
     * start executing.
     * @event
     */
    onStarted(handler: () => void): this;
    /**
     * The onStopped event is raised before the Context starts shutting down, which happens after the last user
     * disconnects.
     * @event
     */
    onStopped(handler: () => void): this;
    /**
     * The onUserJoined event is raised after a new user has joined the Context.
     * @event
     */
    onUserJoined(handler: (user: User) => void): this;
    /**
     * Remove the onUserJoined event handler from the Context.
     * @event
     */
    // offUserJoined(handler: (user: User) => void): this;
    /**
     * The onUserLeft event is raised when the given user has left the Context. After the last user leaves, the Context
     * will be shutdown (and a 'stopped' event will soon follow).
     * @event
     */
    onUserLeft(handler: (user: User) => void): this;
    /**
     * Remove the onUserLeft event handler from the Context
     * @event
     */
    // offUserLeft(handler: (user: User) => void): this;
    /**
     * @hidden
     * (for now)
     */
    // onActorCreated(handler: (actor: Actor) => void): this;
    /**
     * @hidden
     * (for now)
     */
    // offActorCreated(handler: (actor: Actor) => void): this;
    /**
     * @hidden
     * (for now)
     */
    // onActorDestroyed(handler: (actor: Actor) => void): this;
    /**
     * @hidden
     * (for now)
     */
    // offActorDestroyed(handler: (actor: Actor) => void): this;
    /**
     * @hidden
     */
    // onReceiveRPC(handler: (procName: string, channelName: string, args: any[]) => void): this;
    /**
     * @hidden
     */
    // offReceiveRPC(handler: (procName: string, channelName: string, args: any[]) => void): this;

    CreateEmpty(options?: {
        actor?: Partial<ActorLike>;
        subscriptions?: SubscriptionType[];
    }): Actor;

    CreateFromLibrary(options?: {
        resourceId: string;
        actor?: Partial<ActorLike>;
        subscriptions?: SubscriptionType[];
    }): Actor;

    CreateFromGLTF(options: {
        resourceUrl: string;
        assetName?: string;
        colliderType?: CreateColliderType;
        actor?: Partial<ActorLike>;
        subscriptions?: SubscriptionType[];
    }): Actor;

    CreateFromPrefab(options: {
        prefabId: string;
        actor?: Partial<ActorLike>;
        subscriptions?: SubscriptionType[];
    }): Actor;

    CreatePrimitive(options: {
        definition: PrimitiveDefinition;
        addCollider?: boolean;
        actor?: Partial<ActorLike>;
        subscriptions?: SubscriptionType[];
    }): Actor;

    announceSelf(): void;
}
