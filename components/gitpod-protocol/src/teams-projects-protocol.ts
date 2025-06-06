/**
 * Copyright (c) 2021 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import { PrebuiltWorkspaceState, Workspace, WorkspaceClasses } from "./protocol";
import { v4 as uuidv4 } from "uuid";
import { DeepPartial } from "./util/deep-partial";
import { WorkspaceInstance } from "./workspace-instance";

export interface ProjectConfig {
    ".gitpod.yml": string;
}

export interface ProjectSettings {
    /**
     * Controls settings of prebuilds for this project.
     */
    prebuilds?: PrebuildSettings;

    // preferred workspace classes
    workspaceClasses?: WorkspaceClasses;

    /**
     * Controls workspace class restriction for this project, the list is a NOT ALLOW LIST. Empty array to allow all kind of workspace classes
     */
    restrictedWorkspaceClasses?: string[];

    restrictedEditorNames?: string[];

    /**
     * Enable automatic authentication for docker daemon with all credentials specified in GITPOD_IMAGE_AUTH
     */
    enableDockerdAuthentication?: boolean;
}
export namespace PrebuildSettings {
    export type BranchStrategy = "default-branch" | "all-branches" | "matched-branches";
    export type TriggerStrategy = "activity-based" | "webhook-based";
    export interface CloneSettings {
        fullClone?: boolean;
    }
}

export interface PrebuildSettings {
    enable?: boolean;

    /**
     * Defines an interval of commits to run new prebuilds for. Defaults to 20
     */
    prebuildInterval?: number;

    /**
     * Which branches to consider to run new prebuilds on. Default to "all-branches"
     */
    branchStrategy?: PrebuildSettings.BranchStrategy;
    /**
     * If `branchStrategy` s set to "matched-branches", this should define a glob-pattern to be used
     * to match the branch to run new prebuilds on. Defaults to "**"
     */
    branchMatchingPattern?: string;

    /**
     * Preferred workspace class for prebuilds.
     */
    workspaceClass?: string;

    /**
     * The activation strategy for prebuilds. Defaults to "webhook-based"
     */
    triggerStrategy?: PrebuildSettings.TriggerStrategy;

    cloneSettings?: PrebuildSettings.CloneSettings;
}

export interface Project {
    id: string;
    name: string;
    cloneUrl: string;
    teamId: string;
    appInstallationId: string;
    settings?: ProjectSettings;
    creationTime: string;
    markedDeleted?: boolean;
}

export namespace Project {
    export function is(data?: any): data is Project {
        return typeof data === "object" && ["id", "name", "cloneUrl", "teamId"].every((p) => p in data);
    }

    export const create = (project: Omit<Project, "id" | "creationTime">): Project => {
        return {
            ...project,
            id: uuidv4(),
            creationTime: new Date().toISOString(),
        };
    };

    export type PrebuildSettingsWithDefaults = Required<Pick<PrebuildSettings, "prebuildInterval">> & PrebuildSettings;

    export const PREBUILD_SETTINGS_DEFAULTS: PrebuildSettingsWithDefaults = {
        enable: false,
        branchMatchingPattern: "**",
        prebuildInterval: 20,
        branchStrategy: "all-branches",
        triggerStrategy: "activity-based",
    };

    /**
     * Returns effective prebuild settings for the given project. The resulting settings
     * contain default values for properties which are not set explicitly for this project.
     */
    export function getPrebuildSettings(project: Project): PrebuildSettingsWithDefaults {
        // ignoring persisted properties with `undefined` values to exclude them from the override.
        const overrides = Object.fromEntries(
            Object.entries(project.settings?.prebuilds ?? {}).filter(([_, value]) => value !== undefined),
        );

        return {
            ...PREBUILD_SETTINGS_DEFAULTS,
            ...overrides,
        };
    }

    export function hasPrebuildSettings(project: Project) {
        return !(typeof project.settings?.prebuilds === "undefined");
    }

    export interface Overview {
        branches: BranchDetails[];
        isConsideredInactive?: boolean;
    }

    export namespace Overview {
        export function is(data?: any): data is Project.Overview {
            return Array.isArray(data?.branches);
        }
    }

    export interface BranchDetails {
        name: string;
        url: string;
        isDefault: boolean;

        // Latest commit
        changeTitle: string;
        changeDate?: string;
        changeAuthor?: string;
        changeAuthorAvatar?: string;
        changePR?: string;
        changeUrl?: string;
        changeHash: string;
    }

    export type Visibility = "public" | "org-public" | "private";
}

export type PartialProject = DeepPartial<Project> & Pick<Project, "id">;

export interface ProjectUsage {
    lastWebhookReceived: string;
    lastWorkspaceStart: string;
}

export interface PrebuildWithStatus {
    info: PrebuildInfo;
    status: PrebuiltWorkspaceState;
    workspace: Workspace;
    instance?: WorkspaceInstance;
    error?: string;
}

export interface PrebuildInfo {
    id: string;
    buildWorkspaceId: string;
    basedOnPrebuildId?: string;

    teamId?: string;
    userId?: string;

    projectId: string;
    projectName: string;

    cloneUrl: string;
    branch: string;

    startedAt: string;
    startedBy: string;
    startedByAvatar?: string;

    changeTitle: string;
    changeDate: string;
    changeAuthor: string;
    changeAuthorAvatar?: string;
    changePR?: string;
    changeUrl?: string;
    changeHash: string;
}
export namespace PrebuildInfo {
    export function is(data?: any): data is PrebuildInfo {
        return typeof data === "object" && ["id", "buildWorkspaceId", "projectId", "branch"].every((p) => p in data);
    }
}

export interface StartPrebuildResult {
    prebuildId: string;
    wsid: string;
    done: boolean;
}

// alias for backwards compatibility
export type Team = Organization;
export interface Organization {
    id: string;
    name: string;
    slug?: string;
    creationTime: string;
    markedDeleted?: boolean;
    maintenanceMode?: boolean;
    maintenanceNotification?: MaintenanceNotification;
}
export interface MaintenanceNotification {
    enabled: boolean;
    message?: string;
}

export interface OrganizationSettings {
    workspaceSharingDisabled?: boolean;
    // undefined or empty string to reset to default
    defaultWorkspaceImage?: string;

    // empty array to allow all kind of workspace classes
    allowedWorkspaceClasses?: string[];

    pinnedEditorVersions?: { [key: string]: string };

    restrictedEditorNames?: string[];

    // what role new members will get, default is "member"
    defaultRole?: OrgMemberRole;

    // the default organization-wide timeout settings for workspaces
    timeoutSettings?: TimeoutSettings;

    roleRestrictions?: RoleRestrictions;

    // max number of parallel running workspaces per user
    maxParallelRunningWorkspaces?: number;

    // onboarding settings for the organization
    onboardingSettings?: OnboardingSettings;

    // whether to add a special annotation to commits that are created through Gitpod
    annotateGitCommits?: boolean;
}

export type TimeoutSettings = {
    // default per-org workspace timeout
    inactivity?: string;

    // If this field is true, workspaces neither a) pick up user-defined workspace timeouts, nor b) members can set custom timeouts during workspace runtime.
    denyUserTimeouts?: boolean;
};

export const VALID_ORG_MEMBER_ROLES = ["owner", "member", "collaborator"] as const;

export type TeamMemberRole = OrgMemberRole;
export type OrgMemberRole = typeof VALID_ORG_MEMBER_ROLES[number];

export type OrgMemberPermission = "start_arbitrary_repositories";
export type RoleRestrictions = Partial<Record<OrgMemberRole, OrgMemberPermission[]>>;

export namespace TeamMemberRole {
    export function isValid(role: unknown): role is TeamMemberRole {
        return VALID_ORG_MEMBER_ROLES.includes(role as TeamMemberRole);
    }
}

export interface OnboardingSettings {
    /**
     * the link to an internal onboarding page for the organization, possibly featuring a custom onboarding guide and other resources
     */
    internalLink?: string;

    /**
     * the repository IDs of the repositories that are recommended for members to start with
     */
    recommendedRepositories?: string[];

    /**
     * the welcome message for new members of the organization
     */
    welcomeMessage?: WelcomeMessage;
}

export interface WelcomeMessage {
    enabled?: boolean;
    featuredMemberId?: string;
    featuredMemberResolvedAvatarUrl?: string;
    message?: string;
}

export type TeamMemberInfo = OrgMemberInfo;
export interface OrgMemberInfo {
    userId: string;
    fullName?: string;
    primaryEmail?: string;
    avatarUrl?: string;
    role: TeamMemberRole;
    memberSince: string;
    ownedByOrganization: boolean;
}

export interface TeamMembershipInvite {
    id: string;
    teamId: string;
    role: TeamMemberRole;
    creationTime: string;
    invalidationTime: string;
    invitedEmail?: string;

    /** This is a flag that triggers the HARD DELETION of this entity */
    deleted?: boolean;
}
