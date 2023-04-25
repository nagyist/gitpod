/**
 * Copyright (c) 2020 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import * as express from "express";
import { User, OAuth2Config, AuthProviderEntry } from "@gitpod/gitpod-protocol";
import { saveSession } from "../express-util";
import { Session } from "../express";

import { HostContext } from "./host-context";

export const AuthProviderParams = Symbol("AuthProviderParams");
export interface AuthProviderParams extends AuthProviderEntry {
    readonly builtin: boolean; // true, if `ownerId` == ""
    readonly verified: boolean; // true, if `status` == "verified"

    readonly oauth: OAuth2Config;

    // for special auth providers only
    readonly params?: {
        [key: string]: string;
        readonly authUrl: string;
        readonly callBackUrl: string;
        readonly githubToken: string;
    };

    // properties to control behavior
    readonly hiddenOnDashboard?: boolean;
    readonly disallowLogin?: boolean;
    readonly requireTOS?: boolean;

    readonly description: string;
    readonly icon: string;

    readonly requirements?: {
        readonly default: string[];
        readonly publicRepo: string[];
        readonly privateRepo: string[];
    };
}
export function parseAuthProviderParamsFromEnv(json: object): AuthProviderParams[] {
    if (Array.isArray(json)) {
        return normalizeAuthProviderParams(json as AuthProviderParams[]);
    }
    return [];
}
export function normalizeAuthProviderParams(
    params: Omit<AuthProviderParams, "ownerId" | "builtin" | "status" | "verified">[],
): AuthProviderParams[] {
    const result: AuthProviderParams[] = [];
    for (const p of params) {
        result.push({
            ...p,
            ownerId: "",
            builtin: true,
            status: "verified",
            verified: true,
        });
    }
    return result;
}

export interface AuthUserSetup {
    authUser: AuthUser;
    blockUser?: boolean;
    currentScopes: string[];
}

export interface AuthUser {
    readonly authId: string;
    readonly authName: string;
    readonly primaryEmail: string;
    readonly name?: string;
    readonly avatarUrl?: string;
    readonly company?: string;
    readonly created_at?: string;
}

export const AuthProvider = Symbol("AuthProvider");
export interface AuthProvider {
    // readonly authProviderId: string;
    // readonly params: AuthProviderParams;
    // readonly info: AuthProviderInfo;
    // readonly authCallbackPath: string;

    readonly type: string;

    readonly scopeRequirements: {
        readonly default: string[];
        readonly publicRepo: string[];
        readonly privateRepo: string[];
    };

    callback(
        hostContext: HostContext,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ): Promise<void>;
    authorize(
        hostContext: HostContext,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
        scopes?: string[],
    ): void;
    refreshToken?(hostContext: HostContext, user: User): Promise<void>;
}

export interface AuthFlow {
    readonly host: string;
    readonly returnTo: string;
    readonly overrideScopes?: boolean;
}
export namespace AuthFlow {
    export function get(session: Session | undefined): AuthFlow | undefined {
        if (session) {
            return session.authFlow;
        }
    }
    export async function attach(session: Session, authFlow: AuthFlow): Promise<void> {
        session.authFlow = authFlow;
        return saveSession(session);
    }
    export async function clear(session: Session | undefined) {
        if (session) {
            session.authFlow = undefined;
            return saveSession(session);
        }
    }
}
