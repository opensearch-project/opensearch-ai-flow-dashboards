/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { getIn, useFormikContext } from 'formik';
import { isEmpty, isEqual } from 'lodash';
import semver from 'semver';
import {
  EuiSmallButton,
  EuiSmallButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiHorizontalRule,
  EuiLoadingSpinner,
  EuiPanel,
  EuiText,
  EuiHealth,
  EuiBottomBar,
  EuiIconTip,
  EuiSmallButtonIcon,
} from '@elastic/eui';
import {
  CONFIG_STEP,
  CachedFormikState,
  MINIMUM_FULL_SUPPORTED_VERSION,
  SimulateIngestPipelineResponseVerbose,
  TemplateNode,
  WORKFLOW_STEP_TYPE,
  Workflow,
  WorkflowConfig,
  WorkflowFormValues,
  WorkflowTemplate,
  customStringify,
} from '../../../../common';
import { IngestInputs } from './ingest_inputs';
import { SearchInputs } from './search_inputs';
import {
  bulk,
  deprovisionWorkflow,
  getWorkflow,
  provisionWorkflow,
  setIngestPipelineErrors,
  simulatePipeline,
  updateWorkflow,
  useAppDispatch,
} from '../../../store';
import { getCore } from '../../../services';
import {
  formikToUiConfig,
  reduceToTemplate,
  configToTemplateFlows,
  hasProvisionedIngestResources,
  hasProvisionedSearchResources,
  generateId,
  getResourcesToBeForceDeleted,
  getDataSourceId,
  prepareDocsForSimulate,
  getIngestPipelineErrors,
  getEffectiveVersion,
  sleep,
} from '../../../utils';
import { BooleanField } from './input_fields';
import '../workspace/workspace-styles.scss';

interface WorkflowInputsProps {
  workflow: Workflow | undefined;
  uiConfig: WorkflowConfig | undefined;
  setUiConfig: (uiConfig: WorkflowConfig) => void;
  setIngestResponse: (ingestResponse: string) => void;
  ingestDocs: string;
  setIngestDocs: (docs: string) => void;
  isRunningIngest: boolean;
  setIsRunningIngest: (isRunningIngest: boolean) => void;
  isRunningSearch: boolean;
  setIsRunningSearch: (isRunningSearch: boolean) => void;
  selectedStep: CONFIG_STEP;
  setSelectedStep: (step: CONFIG_STEP) => void;
  setUnsavedIngestProcessors: (unsavedIngestProcessors: boolean) => void;
  setUnsavedSearchProcessors: (unsavedSearchProcessors: boolean) => void;
  displaySearchPanel: () => void;
  setCachedFormikState: (cachedFormikState: CachedFormikState) => void;
}

const SUCCESS_TOAST_ID = 'success_toast_id';

/**
 * The workflow inputs component containing the multi-step flow to create ingest
 * and search flows for a particular workflow.
 */

export function WorkflowInputs(props: WorkflowInputsProps) {
  const {
    submitForm,
    validateForm,
    resetForm,
    setTouched,
    values,
    dirty,
  } = useFormikContext<WorkflowFormValues>();
  const dispatch = useAppDispatch();
  const dataSourceId = getDataSourceId();
  const [dataSourceVersion, setDataSourceVersion] = useState<
    string | undefined
  >(undefined);
  useEffect(() => {
    async function getVersion() {
      if (dataSourceId !== undefined) {
        setDataSourceVersion(await getEffectiveVersion(dataSourceId));
      }
    }
    getVersion();
  }, [dataSourceId]);
  const isPreV219 =
    dataSourceVersion !== undefined
      ? semver.lt(dataSourceVersion, MINIMUM_FULL_SUPPORTED_VERSION)
      : false;

  // transient running states
  const [isUpdatingSearchPipeline, setIsUpdatingSearchPipeline] = useState<
    boolean
  >(false);

  // provisioned resources states
  const [ingestProvisioned, setIngestProvisioned] = useState<boolean>(false);
  const [searchProvisioned, setSearchProvisioned] = useState<boolean>(false);

  // last ingested state
  const [lastIngested, setLastIngested] = useState<number | undefined>(
    undefined
  );

  // maintain global states
  const onIngest = props.selectedStep === CONFIG_STEP.INGEST;
  const onSearch = props.selectedStep === CONFIG_STEP.SEARCH;
  const ingestEnabled = values?.ingest?.enabled || false;
  const onIngestAndUnprovisioned = onIngest && !ingestProvisioned;
  const onIngestAndDisabled = onIngest && !ingestEnabled;
  const isProposingNoSearchResources =
    isEmpty(getIn(values, 'search.enrichRequest')) &&
    isEmpty(getIn(values, 'search.enrichResponse'));
  // fine-grained deprovisioning is not supported, hence once a search pipeline is created, it cannot
  // be deleted without re-creating all of the resources, including ingest resources.
  const searchUpdateDisabled =
    searchProvisioned && isProposingNoSearchResources;
  // there is an edge case where search resources based on the form should be ignored:
  // that is, when users first create a workflow and are setting up ingest for the first time,
  // where there may be preset form values for search, but should be ignored during the initial ingestion provisioning steps.
  const includeSearchDuringProvision =
    onSearch || (onIngest && searchProvisioned);

  // maintaining any fine-grained differences between the generated templates produced by the form,
  // produced by the current UI config, and the one persisted in the workflow itself. We enable/disable buttons
  // based on any discrepancies found.
  const [persistedTemplateNodes, setPersistedTemplateNodes] = useState<
    TemplateNode[]
  >([]);
  const [
    persistedIngestTemplateNodes,
    setPersistedIngestTemplateNodes,
  ] = useState<TemplateNode[]>([]);
  const [
    persistedSearchTemplateNodes,
    setPersistedSearchTemplateNodes,
  ] = useState<TemplateNode[]>([]);
  const [formGeneratedTemplateNodes, setFormGeneratedTemplateNodes] = useState<
    TemplateNode[]
  >([]);
  const [
    formGeneratedIngestTemplateNodes,
    setFormGeneratedIngestTemplateNodes,
  ] = useState<TemplateNode[]>([]);
  const [
    formGeneratedSearchTemplateNodes,
    setFormGeneratedSearchTemplateNodes,
  ] = useState<TemplateNode[]>([]);
  const [ingestTemplatesDifferent, setIngestTemplatesDifferent] = useState<
    boolean
  >(false);
  const [searchTemplatesDifferent, setSearchTemplatesDifferent] = useState<
    boolean
  >(false);

  // If a workflow is imported, but not yet provisioned, the template nodes will exist, but the resources themselves won't be created.
  // We persist this to ensure that the update search button is enabled to allow provisioning on the UI.
  const isProposingSearchResourcesButNotProvisioned =
    !isEmpty(persistedSearchTemplateNodes) && !searchProvisioned;

  // fetch the total template nodes
  useEffect(() => {
    setPersistedTemplateNodes(
      props.workflow?.workflows?.provision?.nodes || []
    );
    setFormGeneratedTemplateNodes(
      (values?.ingest &&
        values?.search &&
        props.uiConfig &&
        props.workflow &&
        configToTemplateFlows(
          formikToUiConfig(values, props.uiConfig as WorkflowConfig),
          true,
          includeSearchDuringProvision
        )?.provision?.nodes) ||
        []
    );
  }, [values, props.uiConfig, props.workflow, includeSearchDuringProvision]);

  // fetch the persisted template nodes for ingest & search
  useEffect(() => {
    const tmpIngestNodes = [] as TemplateNode[];
    const tmpSearchNodes = [] as TemplateNode[];
    persistedTemplateNodes.forEach((templateNode) => {
      if (
        templateNode.type ===
        WORKFLOW_STEP_TYPE.CREATE_SEARCH_PIPELINE_STEP_TYPE
      ) {
        tmpSearchNodes.push(templateNode);
      } else {
        tmpIngestNodes.push(templateNode);
      }
    });
    setPersistedIngestTemplateNodes(tmpIngestNodes);
    setPersistedSearchTemplateNodes(tmpSearchNodes);
  }, [persistedTemplateNodes]);

  // fetch the form-generated template nodes for ingest & search
  useEffect(() => {
    const tmpIngestNodes = [] as TemplateNode[];
    const tmpSearchNodes = [] as TemplateNode[];
    formGeneratedTemplateNodes.forEach((templateNode) => {
      if (
        templateNode.type ===
        WORKFLOW_STEP_TYPE.CREATE_SEARCH_PIPELINE_STEP_TYPE
      ) {
        tmpSearchNodes.push(templateNode);
      } else {
        tmpIngestNodes.push(templateNode);
      }
    });
    setFormGeneratedIngestTemplateNodes(tmpIngestNodes);
    setFormGeneratedSearchTemplateNodes(tmpSearchNodes);
  }, [formGeneratedTemplateNodes]);

  // determine any discrepancies between the form-generated and persisted templates
  useEffect(() => {
    setIngestTemplatesDifferent(
      !isEqual(
        persistedIngestTemplateNodes,
        formGeneratedIngestTemplateNodes
      ) || false
    );
    setSearchTemplatesDifferent(
      !isEqual(
        persistedSearchTemplateNodes,
        formGeneratedSearchTemplateNodes
      ) || false
    );
  }, [
    persistedIngestTemplateNodes,
    persistedSearchTemplateNodes,
    formGeneratedIngestTemplateNodes,
    formGeneratedSearchTemplateNodes,
  ]);

  useEffect(() => {
    setIngestProvisioned(hasProvisionedIngestResources(props.workflow));
  }, [props.workflow]);
  useEffect(() => {
    setSearchProvisioned(hasProvisionedSearchResources(props.workflow));
  }, [props.workflow]);

  // populated ingest docs state
  const [docsPopulated, setDocsPopulated] = useState<boolean>(false);
  useEffect(() => {
    let parsedDocsObjs = [] as {}[];
    try {
      const lines = props.ingestDocs?.split('\n') as string[];
      lines.forEach((line) => parsedDocsObjs.push(JSON.parse(line)));
    } catch {}
    setDocsPopulated(parsedDocsObjs.length > 0 && !isEmpty(parsedDocsObjs[0]));
  }, [props.ingestDocs]);

  // bottom bar eligibility
  const showIngestBottomBar =
    onIngest &&
    docsPopulated &&
    (ingestTemplatesDifferent || props.isRunningIngest);
  const showSearchBottomBar =
    onSearch &&
    (searchTemplatesDifferent ||
      isUpdatingSearchPipeline ||
      isProposingSearchResourcesButNotProvisioned);

  // Utility fn to revert any unsaved changes, reset the form
  function revertUnsavedChanges(): void {
    resetForm();
    if (props.workflow?.ui_metadata?.config !== undefined) {
      props.setUiConfig(props.workflow?.ui_metadata?.config);
    }
  }

  // Utility fn to perform bulk ingest
  function bulkIngest(ingestDocsObjs: {}[]) {
    const bulkBody = prepareBulkBody(values.ingest.index.name, ingestDocsObjs);
    dispatch(bulk({ apiBody: { body: bulkBody }, dataSourceId }))
      .unwrap()
      .then(async (resp: any) => {
        props.setIngestResponse(customStringify(resp));
        props.setIsRunningIngest(false);
        setLastIngested(Date.now());
        getCore().notifications.toasts.add({
          id: SUCCESS_TOAST_ID,
          iconType: 'check',
          color: 'success',
          title: 'Ingest flow updated',
          // @ts-ignore
          text: (
            <EuiFlexGroup direction="column">
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  Validate your ingest flow using Test flow
                </EuiText>
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFlexGroup direction="row" justifyContent="flexEnd">
                  <EuiFlexItem grow={false}>
                    <EuiSmallButton
                      fill={false}
                      onClick={() => {
                        props.displaySearchPanel();
                        getCore().notifications.toasts.remove(SUCCESS_TOAST_ID);
                      }}
                    >
                      Test flow
                    </EuiSmallButton>
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
            </EuiFlexGroup>
          ),
        });
      })
      .catch((error: any) => {
        props.setIngestResponse('');
        throw error;
      });
  }

  // Utility fn to update the workflow UI config only, based on the current form values.
  // A get workflow API call is subsequently run to fetch the updated state.
  async function updateWorkflowUiConfig() {
    let success = false;
    const updatedTemplate = {
      name: props.workflow?.name,
      ui_metadata: {
        ...props.workflow?.ui_metadata,
        config: formikToUiConfig(values, props.uiConfig as WorkflowConfig),
      },
    } as WorkflowTemplate;
    await dispatch(
      updateWorkflow({
        apiBody: {
          workflowId: props.workflow?.id as string,
          workflowTemplate: updatedTemplate,
          updateFields: true,
          reprovision: false,
        },
        dataSourceId,
      })
    )
      .unwrap()
      .then(async (result) => {
        success = true;
        props.setUnsavedIngestProcessors(false);
        props.setUnsavedSearchProcessors(false);
        setTouched({});
        new Promise((f) => setTimeout(f, 1000)).then(async () => {
          dispatch(
            getWorkflow({
              workflowId: props.workflow?.id as string,
              dataSourceId,
            })
          );
        });
      })
      .catch((error: any) => {
        console.error('Error saving workflow: ', error);
      });
    return success;
  }

  // Utility fn to update the workflow, including any updated/new resources.
  // The reprovision param is used to determine whether we are doing full
  // deprovision/update/provision, vs. update w/ reprovision (fine-grained provisioning).
  // Details on the reprovision API is here: https://github.com/opensearch-project/flow-framework/pull/804
  async function updateWorkflowAndResources(
    updatedWorkflow: Workflow,
    reprovision: boolean
  ): Promise<boolean> {
    let success = false;
    if (!ingestTemplatesDifferent && !searchTemplatesDifferent) {
      success = await updateWorkflowUiConfig();
    } else if (reprovision) {
      await dispatch(
        updateWorkflow({
          apiBody: {
            workflowId: updatedWorkflow.id as string,
            workflowTemplate: reduceToTemplate(updatedWorkflow),
            reprovision: true,
          },
          dataSourceId,
          dataSourceVersion,
        })
      )
        .unwrap()
        .then(async (result) => {
          // if the datasource < 2.19, only async provisioning/reprovisioning is supported.
          // so, we manually wait some time before trying to fetch the updated workflow
          if (isPreV219) {
            await sleep(1000);
          }
          props.setUnsavedIngestProcessors(false);
          props.setUnsavedSearchProcessors(false);
          success = true;
          // Kicking off an async task to re-fetch the workflow details
          // after some amount of time. Provisioning will finish in an indeterminate
          // amount of time and may be long and expensive; we add this single
          // auto-fetching to cover the majority of provisioning updates which
          // are inexpensive and will finish within milliseconds.
          setTimeout(async () => {
            dispatch(
              getWorkflow({
                workflowId: updatedWorkflow.id as string,
                dataSourceId,
              })
            );
          }, 1000);
        })
        .catch((error: any) => {
          console.error('Error reprovisioning workflow: ', error);
        });
    } else {
      await dispatch(
        deprovisionWorkflow({
          apiBody: {
            workflowId: updatedWorkflow.id as string,
            resourceIds: getResourcesToBeForceDeleted(props.workflow),
          },
          dataSourceId,
        })
      )
        .unwrap()
        .then(async (result) => {
          await sleep(100);
          await dispatch(
            updateWorkflow({
              apiBody: {
                workflowId: updatedWorkflow.id as string,
                workflowTemplate: reduceToTemplate(updatedWorkflow),
                reprovision: false,
              },
              dataSourceId,
            })
          )
            .unwrap()
            .then(async (result) => {
              await sleep(100);
              props.setUnsavedIngestProcessors(false);
              props.setUnsavedSearchProcessors(false);
              await dispatch(
                provisionWorkflow({
                  workflowId: updatedWorkflow.id as string,
                  dataSourceId,
                  dataSourceVersion,
                })
              )
                .unwrap()
                .then(async (result) => {
                  await sleep(100);
                  // if the datasource < 2.19, only async provisioning/reprovisioning is supported.
                  // so, we manually wait some time before trying to fetch the updated workflow
                  if (isPreV219) {
                    await sleep(1000);
                  }
                  await dispatch(
                    getWorkflow({
                      workflowId: updatedWorkflow.id as string,
                      dataSourceId,
                    })
                  )
                    .unwrap()
                    .then(async (result: any) => {
                      const resultWorkflow = result.workflow as Workflow;
                      if (isEmpty(resultWorkflow.error)) {
                        success = true;
                      } else {
                        success = false;
                        getCore().notifications.toasts.addDanger(
                          `Error creating all resources, rolling back: ${resultWorkflow.error}`
                        );
                        await dispatch(
                          deprovisionWorkflow({
                            apiBody: {
                              workflowId: resultWorkflow?.id as string,
                              resourceIds: getResourcesToBeForceDeleted(
                                resultWorkflow
                              ),
                            },
                            dataSourceId,
                          })
                        )
                          .unwrap()
                          .then(async (result) => {
                            setTimeout(async () => {
                              await dispatch(
                                getWorkflow({
                                  workflowId: updatedWorkflow.id as string,
                                  dataSourceId,
                                })
                              );
                            }, 1000);
                          });
                      }
                    });
                })
                .catch((error: any) => {
                  console.error('Error provisioning updated workflow: ', error);
                });
            })
            .catch((error: any) => {
              console.error('Error updating workflow: ', error);
            });
        })
        .catch((error: any) => {
          console.error('Error deprovisioning workflow: ', error);
        });
    }
    return success;
  }

  // Utility fn to validate the form and update the workflow if valid
  // Support fine-grained validation if we only need to validate a subset
  // of the entire form.
  async function validateAndUpdateWorkflow(
    reprovision: boolean,
    includeIngest: boolean = true,
    includeSearch: boolean = true
  ): Promise<boolean> {
    let success = false;
    // Submit the form to bubble up any errors.
    // Ideally we handle Promise accept/rejects with submitForm(), but there is
    // open issues for that - see https://github.com/jaredpalmer/formik/issues/2057
    // The workaround is to additionally execute validateForm() which will return any errors found.
    await submitForm();
    await validateForm()
      .then(async (validationResults: { ingest?: {}; search?: {} }) => {
        const { ingest, search } = validationResults;
        const relevantValidationResults = {
          ...(includeIngest && ingest !== undefined ? { ingest } : {}),
          ...(includeSearch && search !== undefined ? { search } : {}),
        };
        if (Object.keys(relevantValidationResults).length > 0) {
          getCore().notifications.toasts.addDanger('Missing or invalid fields');
          console.error('Form invalid');
        } else {
          setTouched({});
          const updatedConfig = formikToUiConfig(
            values,
            props.uiConfig as WorkflowConfig
          );
          const updatedWorkflow = {
            ...props.workflow,
            ui_metadata: {
              ...props.workflow?.ui_metadata,
              config: updatedConfig,
            },
            // for updating the actual template to be provisioned, we need to handle few scenarios:
            // for ingest, always set to "true", as we will always take into account any ingest config
            // into the provisioning steps
            // for search, we generally want to include, except for the edge case of initial workflow creation.
            // see description where "includeSearchDuringProvision" is defined.
            workflows: configToTemplateFlows(
              updatedConfig,
              true,
              includeSearchDuringProvision
            ),
          } as Workflow;
          success = await updateWorkflowAndResources(
            updatedWorkflow,
            reprovision
          );
        }
      })
      .catch((error) => {
        console.error('Error validating form: ', error);
      });

    return success;
  }

  // Updating ingest. In this case, do full deprovision/update/provision, since we want
  // to clean up any created resources and not have leftover / stale data in some index.
  // This is propagated by passing `reprovision=false` to validateAndUpdateWorkflow()
  async function validateAndRunIngestion(): Promise<boolean> {
    props.setIsRunningIngest(true);
    let success = false;
    try {
      let ingestDocsObjs = [] as {}[];
      try {
        const lines = props.ingestDocs?.split('\n') as string[];
        lines.forEach((line) => ingestDocsObjs.push(JSON.parse(line)));
      } catch (e) {}
      if (ingestDocsObjs.length > 0 && !isEmpty(ingestDocsObjs[0])) {
        success = await validateAndUpdateWorkflow(false, true, false);
        if (success) {
          if (
            !isEmpty(values?.ingest?.enrich) &&
            values?.ingest?.pipelineName !== undefined &&
            values?.ingest?.pipelineName !== ''
          ) {
            const curDocs = prepareDocsForSimulate(
              values?.ingest?.docs,
              values?.ingest?.index?.name
            );
            await dispatch(
              simulatePipeline({
                apiBody: {
                  docs: curDocs,
                },
                pipelineId: values.ingest.pipelineName,
                dataSourceId,
                verbose: true,
              })
            )
              .unwrap()
              .then((resp: SimulateIngestPipelineResponseVerbose) => {
                const ingestPipelineErrors = getIngestPipelineErrors(resp);
                // The errors map may be empty; in which case, this dispatch will clear
                // any older errors.
                dispatch(
                  setIngestPipelineErrors({ errors: ingestPipelineErrors })
                );
                if (isEmpty(ingestPipelineErrors)) {
                  bulkIngest(ingestDocsObjs);
                }
              })
              .catch((error: any) => {
                getCore().notifications.toasts.addDanger(
                  `Failed to simulate ingest pipeline: ${error}`
                );
              });
          } else {
            bulkIngest(ingestDocsObjs);
            dispatch(setIngestPipelineErrors({ errors: {} }));
          }
        }
      } else {
        getCore().notifications.toasts.addDanger(
          'No valid document(s) provided. Ensure it is a valid JSON array.'
        );
      }
    } catch (error) {
      console.error('Error ingesting documents: ', error);
    }
    props.setIsRunningIngest(false);
    return success;
  }

  // Updating search-related resources. If existing ingest resources, run fine-grained provisioning to persist that
  // created index and any indexed data, and only update/re-create the search
  // pipeline, as well as adding that pipeline as the default pipeline for the existing index.
  // If no ingest resources (using user's existing index), run full
  // deprovision/update/provision, since we're just re-creating the search pipeline.
  // This logic is propagated by passing `reprovision=true/false` in the
  // validateAndUpdateWorkflow() fn calls below.
  async function validateAndUpdateSearchResources(): Promise<boolean> {
    setIsUpdatingSearchPipeline(true);
    let success = false;
    try {
      if (hasProvisionedIngestResources(props.workflow)) {
        success = await validateAndUpdateWorkflow(true, false, true);
      } else {
        success = await validateAndUpdateWorkflow(false, false, true);
      }
    } catch (error) {
      console.error('Error updating search pipeline: ', error);
    }
    setIsUpdatingSearchPipeline(false);
    return success;
  }

  return (
    <EuiPanel
      paddingSize="s"
      grow={true}
      className="workspace-panel"
      borderRadius="l"
    >
      {props.uiConfig === undefined ? (
        <EuiLoadingSpinner size="xl" />
      ) : (
        <EuiFlexGroup
          direction="column"
          justifyContent="spaceBetween"
          gutterSize="none"
          style={{
            height: '100%',
            gap: '16px',
          }}
        >
          <EuiFlexItem grow={false}>
            <EuiFlexGroup direction="row" justifyContent="spaceBetween">
              <EuiFlexItem grow={false}>
                <EuiText size="s">
                  <h2>{onIngest ? 'Ingest flow' : 'Search flow'}</h2>
                </EuiText>
              </EuiFlexItem>
              {onIngestAndUnprovisioned && (
                <EuiFlexItem grow={false} style={{ marginTop: '20px' }}>
                  <BooleanField
                    fieldPath="ingest.enabled"
                    label="Enable ingest flow"
                    type="Switch"
                  />
                </EuiFlexItem>
              )}
            </EuiFlexGroup>
          </EuiFlexItem>
          <EuiFlexItem
            grow={true}
            style={{
              overflowY: 'scroll',
              overflowX: 'hidden',
            }}
          >
            {onIngest ? (
              <>
                {!onIngestAndDisabled && (
                  <IngestInputs
                    setIngestDocs={props.setIngestDocs}
                    uiConfig={props.uiConfig}
                    setUiConfig={props.setUiConfig}
                    workflow={props.workflow}
                    lastIngested={lastIngested}
                    setCachedFormikState={props.setCachedFormikState}
                  />
                )}
              </>
            ) : (
              <SearchInputs
                uiConfig={props.uiConfig}
                setUiConfig={props.setUiConfig}
                setCachedFormikState={props.setCachedFormikState}
              />
            )}
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFlexGroup direction="column" gutterSize="none">
              <EuiFlexItem>
                <EuiHorizontalRule margin="m" />
              </EuiFlexItem>
              <EuiFlexItem>
                <EuiFlexGroup direction="row" justifyContent="spaceBetween">
                  {onIngest && (
                    <>
                      <EuiFlexItem grow={false}>
                        <EuiHealth
                          color={ingestProvisioned ? 'primary' : 'subdued'}
                        >
                          {ingestProvisioned
                            ? 'Active ingest resources'
                            : 'No active ingest resources'}
                        </EuiHealth>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup
                          direction="row"
                          gutterSize="s"
                          justifyContent="flexEnd"
                        >
                          {ingestTemplatesDifferent && (
                            <EuiFlexItem
                              grow={false}
                              style={{ marginTop: '8px' }}
                            >
                              <EuiIconTip
                                content={`To edit your search pipeline, finish building an ingest pipeline by providing some sample data.`}
                                position="right"
                              />
                            </EuiFlexItem>
                          )}

                          <EuiFlexItem
                            grow={false}
                            style={{ marginTop: '0px' }}
                          >
                            <EuiSmallButton
                              fill={true}
                              onClick={() => {
                                props.setSelectedStep(CONFIG_STEP.SEARCH);
                              }}
                              data-testid="searchPipelineButton"
                              disabled={
                                !ingestEnabled
                                  ? false
                                  : ingestTemplatesDifferent
                              }
                              iconSide="right"
                              iconType="arrowRight"
                            >
                              {`Next: Search flow`}
                            </EuiSmallButton>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiFlexItem>
                    </>
                  )}
                  {onSearch && (
                    <>
                      <EuiFlexItem grow={false}>
                        <EuiFlexGroup direction="row" gutterSize="s">
                          <EuiFlexItem grow={false}>
                            <EuiSmallButtonIcon
                              style={{ marginTop: '-4px' }}
                              aria-label="searchPipelineBackButton"
                              data-testid="searchPipelineBackButton"
                              iconType={'arrowLeft'}
                              onClick={() =>
                                props.setSelectedStep(CONFIG_STEP.INGEST)
                              }
                            />
                          </EuiFlexItem>
                          <EuiFlexItem
                            grow={false}
                            style={{ marginLeft: '8px' }}
                          >
                            <EuiHealth
                              color={ingestProvisioned ? 'primary' : 'subdued'}
                            >
                              {ingestProvisioned
                                ? 'Active ingest resources'
                                : 'No active ingest resources'}
                            </EuiHealth>
                          </EuiFlexItem>
                        </EuiFlexGroup>
                      </EuiFlexItem>
                      <EuiFlexItem grow={false} style={{ marginRight: '20px' }}>
                        <EuiHealth
                          color={searchProvisioned ? 'primary' : 'subdued'}
                        >
                          {searchProvisioned
                            ? 'Active search resources'
                            : 'No active search resources'}
                        </EuiHealth>
                      </EuiFlexItem>
                    </>
                  )}
                </EuiFlexGroup>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiFlexItem>
        </EuiFlexGroup>
      )}
      {showIngestBottomBar && (
        <EuiBottomBar position="sticky">
          <EuiFlexGroup direction="row" justifyContent="spaceBetween">
            <EuiFlexItem grow={false}>
              <EuiText>You have pending changes</EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              <EuiFlexGroup direction="row" gutterSize="s">
                {!props.isRunningIngest && (
                  <EuiFlexItem grow={false}>
                    <EuiSmallButtonEmpty
                      iconType="editorUndo"
                      iconSide="left"
                      disabled={!dirty}
                      onClick={() => revertUnsavedChanges()}
                    >
                      Discard changes
                    </EuiSmallButtonEmpty>
                  </EuiFlexItem>
                )}
                <EuiFlexItem grow={false}>
                  <EuiSmallButton
                    data-test-subj="updateAndRunIngestButton"
                    fill={true}
                    iconType="check"
                    iconSide="left"
                    disabled={!ingestTemplatesDifferent}
                    isLoading={props.isRunningIngest}
                    onClick={() => validateAndRunIngestion()}
                  >
                    Update
                  </EuiSmallButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiBottomBar>
      )}
      {showSearchBottomBar && (
        <EuiBottomBar position="sticky">
          <EuiFlexGroup direction="row" justifyContent="spaceBetween">
            {searchUpdateDisabled ? (
              <EuiFlexItem grow={false}>
                <EuiText color="danger">
                  You must specify at least one processor
                </EuiText>
              </EuiFlexItem>
            ) : (
              <EuiFlexItem grow={false}>
                <EuiText>You have pending changes</EuiText>
              </EuiFlexItem>
            )}
            <EuiFlexItem grow={false}>
              <EuiFlexGroup direction="row" gutterSize="s">
                {!isUpdatingSearchPipeline && (
                  <EuiFlexItem grow={false}>
                    <EuiSmallButtonEmpty
                      iconType="editorUndo"
                      iconSide="left"
                      disabled={searchUpdateDisabled ? false : !dirty}
                      onClick={() => revertUnsavedChanges()}
                    >
                      Discard changes
                    </EuiSmallButtonEmpty>
                  </EuiFlexItem>
                )}
                {!searchUpdateDisabled && (
                  <EuiFlexItem grow={false}>
                    <EuiSmallButton
                      data-test-subj="updateSearchButton"
                      fill={true}
                      iconType="check"
                      iconSide="left"
                      disabled={
                        isProposingSearchResourcesButNotProvisioned
                          ? false
                          : !searchTemplatesDifferent
                      }
                      isLoading={isUpdatingSearchPipeline}
                      onClick={async () => {
                        if (await validateAndUpdateSearchResources()) {
                          getCore().notifications.toasts.add({
                            id: SUCCESS_TOAST_ID,
                            iconType: 'check',
                            color: 'success',
                            title: 'Search flow updated',
                            // @ts-ignore
                            text: (
                              <EuiFlexGroup direction="column">
                                <EuiFlexItem grow={false}>
                                  <EuiText size="s">
                                    Validate your search flow using Test flow
                                  </EuiText>
                                </EuiFlexItem>
                                <EuiFlexItem>
                                  <EuiFlexGroup
                                    direction="row"
                                    justifyContent="flexEnd"
                                  >
                                    <EuiFlexItem grow={false}>
                                      <EuiSmallButton
                                        fill={false}
                                        onClick={() => {
                                          props.displaySearchPanel();
                                          getCore().notifications.toasts.remove(
                                            SUCCESS_TOAST_ID
                                          );
                                        }}
                                      >
                                        Test flow
                                      </EuiSmallButton>
                                    </EuiFlexItem>
                                  </EuiFlexGroup>
                                </EuiFlexItem>
                              </EuiFlexGroup>
                            ),
                          });
                          setSearchProvisioned(true);
                        }
                      }}
                    >
                      Update
                    </EuiSmallButton>
                  </EuiFlexItem>
                )}
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiBottomBar>
      )}
    </EuiPanel>
  );
}

// ingesting multiple documents must follow the proper format for the bulk API.
// see https://opensearch.org/docs/latest/api-reference/document-apis/bulk/#request-body
function prepareBulkBody(indexName: string, docObjs: {}[]): {} {
  const bulkBody = [] as any[];
  docObjs.forEach((doc) => {
    bulkBody.push({
      index: {
        _index: indexName,
        _id: generateId(),
      },
    });
    bulkBody.push(doc);
  });
  return bulkBody;
}
