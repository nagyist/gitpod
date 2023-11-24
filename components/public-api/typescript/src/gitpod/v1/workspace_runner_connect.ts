/**
 * Copyright (c) 2023 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

// @generated by protoc-gen-connect-es v1.1.2 with parameter "target=ts"
// @generated from file gitpod/v1/workspace_runner.proto (package gitpod.v1, syntax proto3)
/* eslint-disable */
// @ts-nocheck

import { ListRunnerWorkspacesRequest, ListRunnerWorkspacesResponse, RegisterRunnerRequest, RegisterRunnerResponse, RenewRunnerRegistrationRequest, RenewRunnerRegistrationResponse, UpdateRunnerWorkspaceStatusRequest, UpdateRunnerWorkspaceStatusResponse, WatchRunnerWorkspacesRequest, WatchRunnerWorkspacesResponse } from "./workspace_runner_pb.js";
import { MethodKind } from "@bufbuild/protobuf";

/**
 * @generated from service gitpod.v1.WorkspaceRunnerService
 */
export const WorkspaceRunnerService = {
  typeName: "gitpod.v1.WorkspaceRunnerService",
  methods: {
    /**
     * RegisterRunner registers a new cluster with the server. Registrations are very
     * short-lived and must be renewed every 30 seconds. Runners can be registered for
     * an entire organisation or a single user.
     *
     * @generated from rpc gitpod.v1.WorkspaceRunnerService.RegisterRunner
     */
    registerRunner: {
      name: "RegisterRunner",
      I: RegisterRunnerRequest,
      O: RegisterRunnerResponse,
      kind: MethodKind.Unary,
    },
    /**
     * RenewRunnerRegistration renews a cluster's registration. This must be called every 30 seconds
     * to keep the cluster registered.
     *
     * @generated from rpc gitpod.v1.WorkspaceRunnerService.RenewRunnerRegistration
     */
    renewRunnerRegistration: {
      name: "RenewRunnerRegistration",
      I: RenewRunnerRegistrationRequest,
      O: RenewRunnerRegistrationResponse,
      kind: MethodKind.Unary,
    },
    /**
     * ListRunnerWorkspaces returns the workspaces running on a cluster.
     *
     * @generated from rpc gitpod.v1.WorkspaceRunnerService.ListRunnerWorkspaces
     */
    listRunnerWorkspaces: {
      name: "ListRunnerWorkspaces",
      I: ListRunnerWorkspacesRequest,
      O: ListRunnerWorkspacesResponse,
      kind: MethodKind.Unary,
    },
    /**
     * WatchRunnerWorkspaces returns a stream of workspaces that ought to run on a cluster.
     *
     * @generated from rpc gitpod.v1.WorkspaceRunnerService.WatchRunnerWorkspaces
     */
    watchRunnerWorkspaces: {
      name: "WatchRunnerWorkspaces",
      I: WatchRunnerWorkspacesRequest,
      O: WatchRunnerWorkspacesResponse,
      kind: MethodKind.ServerStreaming,
    },
    /**
     * UpdateRunnerWorkspaceStatus updates the status of a workspace running on a cluster.
     *
     * @generated from rpc gitpod.v1.WorkspaceRunnerService.UpdateRunnerWorkspaceStatus
     */
    updateRunnerWorkspaceStatus: {
      name: "UpdateRunnerWorkspaceStatus",
      I: UpdateRunnerWorkspaceStatusRequest,
      O: UpdateRunnerWorkspaceStatusResponse,
      kind: MethodKind.Unary,
    },
  }
} as const;