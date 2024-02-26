/**
 * Copyright (c) 2024 Gitpod GmbH. All rights reserved.
 * Licensed under the GNU Affero General Public License (AGPL).
 * See License.AGPL.txt in the project root for license information.
 */

import type { Configuration } from "@gitpod/public-api/lib/gitpod/v1/configuration_pb";
import { useCallback, useState } from "react";
import { Heading3, Subheading } from "@podkit/typography/Headings";
import { ConfigurationSettingsField } from "../ConfigurationSettingsField";
import { useToast } from "../../../components/toasts/Toasts";
import { LoadingButton } from "@podkit/buttons/LoadingButton";
import { useConfigurationMutation } from "../../../data/configurations/configuration-queries";
import { WorkspaceClassOptions } from "../shared/WorkspaceClassOptions";
import { DEFAULT_WS_CLASS } from "../../../data/workspaces/workspace-classes-query";
import { Button } from "@podkit/buttons/Button";
import Modal, { ModalBody, ModalFooter, ModalFooterAlert, ModalHeader } from "../../../components/Modal";
import WorkspaceClassIcon from "../../../icons/WorkspaceClass.svg";
import { useOrgWorkspaceClassesQuery } from "../../../data/organizations/org-workspace-classes-query";
import { LoadingState } from "@podkit/loading/LoadingState";
import { SwitchInputField } from "@podkit/switch/Switch";
import { TextMuted } from "@podkit/typography/TextMuted";
import { cn } from "@podkit/lib/cn";

interface Props {
    configuration: Configuration;
}

export const ConfigurationWorkspaceClassesOptions = ({ configuration }: Props) => {
    const [defaultClass, setDefaultClass] = useState(
        configuration.workspaceSettings?.workspaceClass || DEFAULT_WS_CLASS,
    );
    const [restrictedClasses, setRestrictedClasses] = useState(
        configuration.workspaceSettings?.restrictedWorkspaceClasses ?? [],
    );

    const [showModal, setShowModal] = useState(false);

    return (
        <ConfigurationSettingsField>
            <Heading3>Available workspace classes</Heading3>
            <Subheading>Limit the available workspace classes for this repository.</Subheading>

            <WorkspaceClassOptions value={defaultClass} onChange={setDefaultClass} />
            {/* <WorkspaceClassIcon /> */}
            {showModal && (
                <ConfigurationWorkspaceClassesModifyModal
                    configuration={configuration}
                    onClose={() => setShowModal(false)}
                />
            )}

            <Button className="mt-8" onClick={() => setShowModal(true)}>
                Manage Classes
            </Button>
        </ConfigurationSettingsField>
    );
};

interface ConfigurationWorkspaceClassesModifyModalProps {
    configuration: Configuration;
    onClose: () => void;
}
const ConfigurationWorkspaceClassesModifyModal = ({
    configuration,
    onClose,
}: ConfigurationWorkspaceClassesModifyModalProps) => {
    const [defaultClass, setDefaultClass] = useState(
        configuration.workspaceSettings?.workspaceClass || DEFAULT_WS_CLASS,
    );
    const initValue = configuration.workspaceSettings?.restrictedWorkspaceClasses ?? [];
    const [restrictedClasses, setRestrictedClasses] = useState(initValue);
    const [validateError, setValidateError] = useState("");

    const orgClassesQuery = useOrgWorkspaceClassesQuery();

    const { toast } = useToast();

    const updateMutation = useConfigurationMutation();

    const handleUpdate = () => {
        updateMutation.mutate(
            {
                configurationId: configuration.id,
                workspaceSettings: {
                    workspaceClass: defaultClass,
                    restrictedWorkspaceClasses: restrictedClasses,
                    updateRestrictedWorkspaceClasses: true,
                },
            },
            {
                onSuccess: () => {
                    toast({ message: "Workspace size updated" });
                },
                onError: (e) => {
                    toast({ message: `Failed updating workspace size: ${e.message}` });
                },
            },
        );
    };

    // const setData = useCallback((opts: { restrictedClasses?: string[]; defaultClass?: string }) => {}, []);

    const makeDefaultButtonState = useCallback(
        (classId: string) => {
            if (restrictedClasses.includes(classId)) {
                return {
                    title: "Unavailable",
                    classes: "cursor-not-allowed",
                    description: "Your organization has disabled this class",
                    disabled: true,
                };
            }
            if (defaultClass === classId) {
                return {
                    title: "Default",
                    classes: "text-pk-surface",
                    disabled: true,
                };
            }
            return {
                title: "Set default",
                classes: "cursor-pointer text-blue-500",
                disabled: false,
            };
        },
        [restrictedClasses, defaultClass],
    );

    return (
        <Modal visible onClose={onClose} onSubmit={handleUpdate}>
            <ModalHeader>Available workspace classes</ModalHeader>
            <ModalBody>
                <div className="mt-8">
                    {orgClassesQuery.isLoading ? (
                        <LoadingState />
                    ) : (
                        <>
                            {orgClassesQuery.data &&
                                orgClassesQuery.data.map((wsClass) => (
                                    <SwitchInputField
                                        className="mt-2"
                                        key={wsClass.id}
                                        id={wsClass.id}
                                        label={wsClass.displayName}
                                        description={wsClass.description}
                                        checked={!restrictedClasses.includes(wsClass.id)}
                                        onCheckedChange={(checked) => {
                                            const newVal = !checked
                                                ? restrictedClasses.includes(wsClass.id)
                                                    ? [...restrictedClasses]
                                                    : [...restrictedClasses, wsClass.id]
                                                : restrictedClasses.filter((id) => id !== wsClass.id);
                                            console.log("==========", checked, newVal);
                                            const leftOptions = initValue.filter((e) => !newVal.includes(e));
                                            setValidateError(
                                                leftOptions.length === 0
                                                    ? "At least one workspace class has to be selected."
                                                    : "",
                                            );
                                            setRestrictedClasses(newVal);
                                        }}
                                    >
                                        <div className="flex w-full justify-between content-center">
                                            <div className="flex flex-col">
                                                <label className="font-semibold cursor-pointer" htmlFor={wsClass.id}>
                                                    {wsClass.displayName}
                                                </label>
                                                <TextMuted>{wsClass.description}</TextMuted>
                                            </div>
                                            <Button
                                                title={makeDefaultButtonState(wsClass.id).description}
                                                onClick={() => {
                                                    setDefaultClass(wsClass.id);
                                                }}
                                                variant="ghost"
                                                disabled={makeDefaultButtonState(wsClass.id).disabled}
                                                className={cn(
                                                    "text-sm select-none font-normal",
                                                    makeDefaultButtonState(wsClass.id).classes,
                                                )}
                                            >
                                                {makeDefaultButtonState(wsClass.id).title}
                                            </Button>
                                        </div>
                                    </SwitchInputField>
                                ))}
                        </>
                    )}
                </div>
            </ModalBody>
            <ModalFooter
                alert={
                    updateMutation.isError || orgClassesQuery.isError ? (
                        <ModalFooterAlert type="danger">
                            {String(updateMutation.error || orgClassesQuery.error)}
                        </ModalFooterAlert>
                    ) : null
                }
            >
                <Button variant="secondary" onClick={onClose}>
                    Cancel
                </Button>
                <LoadingButton type="submit" loading={updateMutation.isLoading}>
                    Add Variable
                </LoadingButton>
            </ModalFooter>
        </Modal>
    );
};
