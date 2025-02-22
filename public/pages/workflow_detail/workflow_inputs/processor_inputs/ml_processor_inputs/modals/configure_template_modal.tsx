/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useFormikContext, getIn, Formik } from 'formik';
import { get, isEmpty } from 'lodash';
import * as yup from 'yup';
import {
  EuiCodeEditor,
  EuiFlexGroup,
  EuiFlexItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSmallButton,
  EuiText,
  EuiPopover,
  EuiContextMenu,
  EuiSmallButtonEmpty,
  EuiSmallButtonIcon,
  EuiSpacer,
  EuiIconTip,
} from '@elastic/eui';
import {
  customStringify,
  IngestPipelineConfig,
  InputMapEntry,
  IProcessorConfig,
  MAX_STRING_LENGTH,
  MAX_TEMPLATE_STRING_LENGTH,
  ModelInterface,
  PROCESSOR_CONTEXT,
  PROMPT_PRESETS,
  PromptPreset,
  SearchHit,
  SimulateIngestPipelineResponse,
  TemplateFormValues,
  ExpressionVar,
  TRANSFORM_CONTEXT,
  WorkflowConfig,
  WorkflowFormValues,
  QueryParam,
} from '../../../../../../../common';
import {
  containsEmptyValues,
  containsSameValues,
  formikToPartialPipeline,
  generateArrayTransform,
  generateTransform,
  getDataSourceId,
  getInitialValue,
  getPlaceholdersFromQuery,
  injectParameters,
  prepareDocsForSimulate,
  unwrapTransformedDocs,
} from '../../../../../../utils';
import { TextField } from '../../../input_fields';
import {
  searchIndex,
  simulatePipeline,
  useAppDispatch,
} from '../../../../../../store';
import { getCore } from '../../../../../../services';
import {
  JsonPathExamplesTable,
  ProcessingBadge,
  QueryParamsList,
} from '../../../../../../general_components';
import '../../../../../../global-styles.scss';

interface ConfigureTemplateModalProps {
  uiConfig: WorkflowConfig;
  config: IProcessorConfig;
  context: PROCESSOR_CONTEXT;
  baseConfigPath: string;
  fieldPath: string;
  modelInterface: ModelInterface | undefined;
  isDataFetchingAvailable: boolean;
  onClose: () => void;
}

// Spacing between the input field columns
const KEY_FLEX_RATIO = 4;
const VALUE_FLEX_RATIO = 6;

// the max number of input docs we use to display & test transforms with (search response hits)
const MAX_INPUT_DOCS = 10;

// the prompt editor element ID. Used when fetching the element to perform functions on the
// underlying ace editor (inserting template variables at the cursor position)
const PROMPT_EDITOR_ID = 'promptEditor';

/**
 * A modal to configure a prompt template. Can manually configure, include placeholder values
 * using other model inputs, and/or select from a presets library. Used for configuring model
 * input transforms.
 */
export function ConfigureTemplateModal(props: ConfigureTemplateModalProps) {
  const dispatch = useAppDispatch();
  const dataSourceId = getDataSourceId();
  const { values, setFieldValue, setFieldTouched } = useFormikContext<
    WorkflowFormValues
  >();

  // sub-form values/schema
  const templateFormValues = {
    value: getInitialValue('string'),
    nestedVars: [],
  } as TemplateFormValues;
  const templateFormSchema = yup.object({
    value: yup
      .string()
      .trim()
      .min(1, 'Too short')
      .max(MAX_TEMPLATE_STRING_LENGTH, 'Too long')
      .required('Required') as yup.Schema,
    nestedVars: yup.array().of(
      yup.object().shape({
        name: yup
          .string()
          .trim()
          .min(1, 'Too short')
          .max(MAX_STRING_LENGTH, 'Too long')
          .required('Required') as yup.Schema,
        transform: yup
          .string()
          .trim()
          .min(1, 'Too short')
          .max(MAX_STRING_LENGTH, 'Too long')
          .required('Required') as yup.Schema,
      })
    ),
  }) as yup.Schema;

  // persist standalone values. update / initialize when it is first opened
  const [tempTemplate, setTempTemplate] = useState<string>('');
  const [tempNestedVars, setTempNestedVars] = useState<ExpressionVar[]>([]);
  const [tempErrors, setTempErrors] = useState<boolean>(false);

  // get some current form values
  const oneToOne = getIn(
    values,
    `${props.baseConfigPath}.${props.config.id}.one_to_one`
  );
  const docs = getIn(values, 'ingest.docs');
  let docObjs = [] as {}[] | undefined;
  try {
    const lines = docs?.split('\n') as string[];
    lines.forEach((line) => docObjs?.push(JSON.parse(line)));
  } catch {}
  const query = getIn(values, 'search.request');
  let queryObj = {} as {} | undefined;
  try {
    queryObj = JSON.parse(query);
  } catch {}
  const onIngestAndNoDocs =
    props.context === PROCESSOR_CONTEXT.INGEST && isEmpty(docObjs);
  const onSearchAndNoQuery =
    (props.context === PROCESSOR_CONTEXT.SEARCH_REQUEST ||
      props.context === PROCESSOR_CONTEXT.SEARCH_RESPONSE) &&
    isEmpty(queryObj);

  // transformed template state
  const [transformedTemplate, setTransformedTemplate] = useState<string>('');

  // button updating state
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // popover states
  const [presetsPopoverOpen, setPresetsPopoverOpen] = useState<boolean>(false);
  const [jsonPathPopoverOpen, setJsonPathPopoverOpen] = useState<boolean>(
    false
  );

  // source input / transformed input state
  const [sourceInput, setSourceInput] = useState<string>('{}');
  const [transformedInput, setTransformedInput] = useState<string>('{}');

  // fetching input data state
  const [isFetching, setIsFetching] = useState<boolean>(false);

  // query params state, if applicable. Users cannot run preview if there are query parameters
  // and the user is configuring something in a search context (search request/response)
  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  useEffect(() => {
    if (props.context !== PROCESSOR_CONTEXT.INGEST && query !== undefined) {
      const placeholders = getPlaceholdersFromQuery(query);
      if (
        !containsSameValues(
          placeholders,
          queryParams.map((queryParam) => queryParam.name)
        )
      ) {
        setQueryParams(
          placeholders.map((placeholder) => ({
            name: placeholder,
            type: 'Text',
            value: '',
          }))
        );
      }
    }
  }, [query]);

  // hook to re-generate the transform when any inputs to the transform are updated
  useEffect(() => {
    const nestedVarsAsInputMap = tempNestedVars?.map((expressionVar) => {
      return {
        key: expressionVar.name,
        value: {
          value: expressionVar.transform,
        },
      } as InputMapEntry;
    });
    if (!isEmpty(nestedVarsAsInputMap) && !isEmpty(JSON.parse(sourceInput))) {
      let sampleSourceInput = {} as {} | [];
      try {
        sampleSourceInput = JSON.parse(sourceInput);
        const output =
          // Edge case: users are collapsing input docs into a single input field when many-to-one is selected
          // fo input transforms on search response processors.
          oneToOne === false &&
          props.context === PROCESSOR_CONTEXT.SEARCH_RESPONSE &&
          Array.isArray(sampleSourceInput)
            ? generateArrayTransform(
                sampleSourceInput as [],
                nestedVarsAsInputMap,
                props.context,
                TRANSFORM_CONTEXT.INPUT,
                queryObj
              )
            : generateTransform(
                sampleSourceInput,
                nestedVarsAsInputMap,
                props.context,
                TRANSFORM_CONTEXT.INPUT,
                queryObj
              );
        setTransformedInput(customStringify(output));
      } catch {}
    } else {
      setTransformedInput('{}');
    }
  }, [tempNestedVars, sourceInput]);

  // hook to set the transformed template, when the template
  // and/or its injected variables are updated
  useEffect(() => {
    if (!isEmpty(tempTemplate)) {
      setTransformedTemplate(
        injectValuesIntoTemplate(tempTemplate, JSON.parse(transformedInput))
      );
    }
  }, [tempTemplate, transformedInput]);

  // if updating, take the temp vars and assign it to the parent form
  function onUpdate() {
    setIsUpdating(true);
    setFieldValue(`${props.fieldPath}.value`, tempTemplate);
    setFieldValue(`${props.fieldPath}.nestedVars`, tempNestedVars);
    setFieldTouched(props.fieldPath, true);
    props.onClose();
  }

  return (
    <Formik
      enableReinitialize={false}
      initialValues={templateFormValues}
      validationSchema={templateFormSchema}
      onSubmit={(values) => {}}
      validate={(values) => {}}
    >
      {(formikProps) => {
        // override to parent form values when changes detected
        useEffect(() => {
          formikProps.setFieldValue(
            'value',
            getIn(values, `${props.fieldPath}.value`)
          );
          formikProps.setFieldValue(
            'nestedVars',
            getIn(values, `${props.fieldPath}.nestedVars`)
          );
        }, [getIn(values, props.fieldPath)]);

        // update temp vars when form changes are detected
        useEffect(() => {
          setTempTemplate(getIn(formikProps.values, 'value'));
        }, [getIn(formikProps.values, 'value')]);
        useEffect(() => {
          setTempNestedVars(getIn(formikProps.values, 'nestedVars'));
        }, [getIn(formikProps.values, 'nestedVars')]);

        // update tempErrors if errors detected
        useEffect(() => {
          setTempErrors(!isEmpty(formikProps.errors));
        }, [formikProps.errors]);

        // Adding an input var to the end of the existing arr
        function addInputVar(curInputVars: ExpressionVar[]): void {
          const updatedInputVars = [
            ...curInputVars,
            { name: '', transform: '' } as ExpressionVar,
          ];
          formikProps.setFieldValue(`nestedVars`, updatedInputVars);
          formikProps.setFieldTouched(`nestedVars`, true);
        }

        // Deleting an input var
        function deleteInputVar(
          curInputVars: ExpressionVar[],
          idxToDelete: number
        ): void {
          const updatedInputVars = [...curInputVars];
          updatedInputVars.splice(idxToDelete, 1);
          formikProps.setFieldValue('nestedVars', updatedInputVars);
          formikProps.setFieldTouched('nestedVars', true);
        }

        return (
          <EuiModal
            maxWidth={false}
            onClose={props.onClose}
            className="configuration-modal"
          >
            <EuiModalHeader>
              <EuiFlexGroup direction="column">
                <EuiFlexItem grow={false}>
                  <EuiModalHeaderTitle>
                    <p>{`Configure prompt`}</p>
                  </EuiModalHeaderTitle>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText color="subdued">
                    Configure a prompt to provide instructions to the model. You
                    can define variables in the prompt and populate them with
                    data extracted from the input source.
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiModalHeader>
            <EuiModalBody style={{ height: '40vh' }}>
              <EuiFlexGroup direction="row">
                <EuiFlexItem grow={6}>
                  <EuiFlexGroup direction="column" gutterSize="xs">
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup
                        direction="row"
                        justifyContent="spaceBetween"
                      >
                        <EuiFlexItem grow={false}>
                          <EuiText size="m">Prompt</EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiPopover
                            button={
                              <EuiSmallButton
                                onClick={() =>
                                  setPresetsPopoverOpen(!presetsPopoverOpen)
                                }
                                iconSide="right"
                                iconType="arrowDown"
                              >
                                Prompt samples
                              </EuiSmallButton>
                            }
                            isOpen={presetsPopoverOpen}
                            closePopover={() => setPresetsPopoverOpen(false)}
                            anchorPosition="downLeft"
                          >
                            <EuiContextMenu
                              size="s"
                              initialPanelId={0}
                              panels={[
                                {
                                  id: 0,
                                  items: PROMPT_PRESETS.map(
                                    (preset: PromptPreset) => ({
                                      name: preset.name,
                                      // If a new prompt is selected, update the prompt,
                                      // and reset any nested vars.
                                      onClick: () => {
                                        try {
                                          formikProps.setFieldValue(
                                            'value',
                                            preset.prompt
                                          );
                                          formikProps.setFieldValue(
                                            'nestedVars',
                                            extractParametersFromTemplate(
                                              preset.prompt
                                            )
                                          );
                                          formikProps.setFieldTouched(
                                            'nestedVars',
                                            false
                                          );
                                        } catch {}
                                        formikProps.setFieldTouched(
                                          'value',
                                          true
                                        );
                                        setPresetsPopoverOpen(false);
                                      },
                                    })
                                  ),
                                },
                              ]}
                            />
                          </EuiPopover>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    <EuiSpacer size="s" />
                    <EuiFlexItem grow={false} id={PROMPT_EDITOR_ID}>
                      <EuiCodeEditor
                        mode="json"
                        theme="textmate"
                        width="100%"
                        height="15vh"
                        value={tempTemplate}
                        readOnly={false}
                        setOptions={{
                          fontSize: '12px',
                          autoScrollEditorIntoView: true,
                          showLineNumbers: false,
                          showGutter: false,
                          showPrintMargin: false,
                          wrap: true,
                        }}
                        tabSize={2}
                        onChange={(value) =>
                          formikProps.setFieldValue('value', value)
                        }
                        onBlur={(e) => {
                          formikProps.setFieldTouched('value');
                        }}
                      />
                    </EuiFlexItem>
                    <EuiSpacer size="s" />
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup direction="row" gutterSize="xs">
                        <EuiFlexItem grow={false}>
                          <EuiText size="m">Input variables</EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiIconTip
                            content={`Define variables in the prompt. Populate the variables with data extracted from the input data using JSONPath expressions. Insert into the prompt by clicking the insert button.`}
                            position="right"
                          />
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup
                        direction="row"
                        justifyContent="spaceAround"
                        gutterSize="s"
                      >
                        <EuiFlexItem grow={KEY_FLEX_RATIO}>
                          <EuiText size="s">{`Name`}</EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={VALUE_FLEX_RATIO}>
                          <EuiFlexGroup
                            direction="row"
                            justifyContent="spaceBetween"
                          >
                            <EuiFlexItem grow={false}>
                              <EuiText size="s">{`Expression`}</EuiText>
                            </EuiFlexItem>
                            <EuiFlexItem grow={false}>
                              <EuiPopover
                                isOpen={jsonPathPopoverOpen}
                                initialFocus={false}
                                anchorPosition="downCenter"
                                closePopover={() =>
                                  setJsonPathPopoverOpen(false)
                                }
                                button={
                                  <EuiSmallButtonEmpty
                                    style={{ marginTop: '-4px' }}
                                    onClick={() =>
                                      setJsonPathPopoverOpen(
                                        !jsonPathPopoverOpen
                                      )
                                    }
                                  >
                                    Using JSONPath
                                  </EuiSmallButtonEmpty>
                                }
                              >
                                <JsonPathExamplesTable
                                  headerText={`Define JSONPath to transform your input ${
                                    props.context ===
                                    PROCESSOR_CONTEXT.SEARCH_REQUEST
                                      ? 'query'
                                      : 'documents'
                                  } to map to input variables that can be dynamically injected in your template.`}
                                />
                              </EuiPopover>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      <EuiSpacer size="s" />
                      {formikProps.values.nestedVars?.map(
                        (expressionVar, idx) => {
                          return (
                            <div key={idx}>
                              <EuiFlexGroup
                                key={idx}
                                direction="row"
                                justifyContent="spaceAround"
                                gutterSize="s"
                              >
                                <EuiFlexItem grow={KEY_FLEX_RATIO}>
                                  <TextField
                                    fullWidth={true}
                                    fieldPath={`nestedVars.${idx}.name`}
                                    placeholder={`Name`}
                                    showError={true}
                                  />
                                </EuiFlexItem>
                                <EuiFlexItem grow={VALUE_FLEX_RATIO}>
                                  <EuiFlexGroup
                                    direction="row"
                                    justifyContent="spaceAround"
                                    gutterSize="xs"
                                  >
                                    <EuiFlexItem>
                                      <TextField
                                        fullWidth={true}
                                        fieldPath={`nestedVars.${idx}.transform`}
                                        placeholder={`Transform`}
                                        showError={true}
                                      />
                                    </EuiFlexItem>
                                    <EuiFlexItem grow={false}>
                                      <EuiSmallButtonEmpty
                                        disabled={isEmpty(
                                          getIn(
                                            formikProps.values,
                                            `nestedVars.${idx}.transform`
                                          )
                                        )}
                                        onClick={() => {
                                          const promptEditorParentElement = document
                                            .getElementById(PROMPT_EDITOR_ID)
                                            ?.getElementsByClassName(
                                              'ace_editor'
                                            );
                                          const promptEditor = get(
                                            promptEditorParentElement,
                                            '0.env.editor'
                                          );
                                          const promptEditorSession =
                                            promptEditor?.session;
                                          const cursorPosition = promptEditor?.getCursorPosition();
                                          const valueToInsert = getPlaceholderString(
                                            getIn(
                                              formikProps.values,
                                              `nestedVars.${idx}.name`
                                            )
                                          );
                                          if (
                                            promptEditorSession !== undefined &&
                                            cursorPosition !== undefined &&
                                            valueToInsert !== undefined &&
                                            !isEmpty(valueToInsert)
                                          ) {
                                            promptEditorSession.insert(
                                              cursorPosition,
                                              valueToInsert
                                            );
                                          } else {
                                            console.error(
                                              'Value could not be inserted'
                                            );
                                          }
                                        }}
                                      >
                                        Insert
                                      </EuiSmallButtonEmpty>
                                    </EuiFlexItem>
                                    <EuiFlexItem grow={false}>
                                      <EuiSmallButtonIcon
                                        iconType={'trash'}
                                        color="danger"
                                        aria-label="Delete"
                                        onClick={() => {
                                          deleteInputVar(
                                            formikProps.values.nestedVars || [],
                                            idx
                                          );
                                        }}
                                      />
                                    </EuiFlexItem>
                                  </EuiFlexGroup>
                                </EuiFlexItem>
                              </EuiFlexGroup>
                              <EuiSpacer size="s" />
                            </div>
                          );
                        }
                      )}
                      <EuiSmallButtonEmpty
                        style={{
                          marginLeft: '-8px',
                          width: '125px',
                        }}
                        iconType={'plusInCircle'}
                        iconSide="left"
                        onClick={() => {
                          addInputVar(formikProps.values.nestedVars || []);
                        }}
                      >
                        {`Add variable`}
                      </EuiSmallButtonEmpty>
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
                <EuiFlexItem grow={4}>
                  <EuiFlexGroup direction="column" gutterSize="xs">
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup
                        direction="row"
                        justifyContent="spaceBetween"
                      >
                        <EuiFlexItem grow={false}>
                          <EuiText size="m">Preview</EuiText>
                        </EuiFlexItem>
                        <EuiFlexItem grow={false}>
                          <EuiSmallButton
                            style={{ width: '100px' }}
                            isLoading={isFetching}
                            disabled={
                              onIngestAndNoDocs ||
                              onSearchAndNoQuery ||
                              !props.isDataFetchingAvailable ||
                              (props.context !== PROCESSOR_CONTEXT.INGEST &&
                                containsEmptyValues(queryParams))
                            }
                            onClick={async () => {
                              setIsFetching(true);
                              switch (props.context) {
                                case PROCESSOR_CONTEXT.INGEST: {
                                  // get the current ingest pipeline up to, but not including, this processor
                                  const curIngestPipeline = formikToPartialPipeline(
                                    values,
                                    props.uiConfig,
                                    props.config.id,
                                    false,
                                    PROCESSOR_CONTEXT.INGEST
                                  );
                                  // if there are preceding processors, we need to simulate the partial ingest pipeline,
                                  // in order to get the latest transformed version of the docs
                                  if (curIngestPipeline !== undefined) {
                                    const curDocs = prepareDocsForSimulate(
                                      values.ingest.docs,
                                      values.ingest.index.name
                                    );
                                    await dispatch(
                                      simulatePipeline({
                                        apiBody: {
                                          pipeline: curIngestPipeline as IngestPipelineConfig,
                                          docs: [curDocs[0]],
                                        },
                                        dataSourceId,
                                      })
                                    )
                                      .unwrap()
                                      .then(
                                        (
                                          resp: SimulateIngestPipelineResponse
                                        ) => {
                                          const docObjs = unwrapTransformedDocs(
                                            resp
                                          );
                                          if (docObjs.length > 0) {
                                            setSourceInput(
                                              customStringify(docObjs[0])
                                            );
                                          }
                                        }
                                      )
                                      .catch((error: any) => {
                                        getCore().notifications.toasts.addDanger(
                                          `Failed to fetch input data`
                                        );
                                      })
                                      .finally(() => {
                                        setIsFetching(false);
                                      });
                                  } else {
                                    try {
                                      const docObjs = JSON.parse(
                                        values.ingest.docs
                                      ) as {}[];
                                      if (docObjs.length > 0) {
                                        setSourceInput(
                                          customStringify(docObjs[0])
                                        );
                                      }
                                    } catch {
                                    } finally {
                                      setIsFetching(false);
                                    }
                                  }
                                  break;
                                }
                                case PROCESSOR_CONTEXT.SEARCH_REQUEST: {
                                  // get the current search pipeline up to, but not including, this processor
                                  const curSearchPipeline = formikToPartialPipeline(
                                    values,
                                    props.uiConfig,
                                    props.config.id,
                                    false,
                                    PROCESSOR_CONTEXT.SEARCH_REQUEST
                                  );
                                  // if there are preceding processors, we cannot generate. The button to render
                                  // this modal should be disabled if the search pipeline would be enabled. We add
                                  // this if check as an extra layer of checking, and if mechanism for gating
                                  // this is changed in the future.
                                  if (curSearchPipeline === undefined) {
                                    setSourceInput(
                                      injectParameters(queryParams, query)
                                    );
                                  }
                                  setIsFetching(false);
                                  break;
                                }
                                case PROCESSOR_CONTEXT.SEARCH_RESPONSE: {
                                  // get the current search pipeline up to, but not including, this processor
                                  const curSearchPipeline = formikToPartialPipeline(
                                    values,
                                    props.uiConfig,
                                    props.config.id,
                                    false,
                                    PROCESSOR_CONTEXT.SEARCH_RESPONSE
                                  );
                                  // Execute search. If there are preceding processors, augment the existing query with
                                  // the partial search pipeline (inline) to get the latest transformed version of the response.
                                  dispatch(
                                    searchIndex({
                                      apiBody: {
                                        index: values.search.index.name,
                                        body: JSON.stringify({
                                          ...JSON.parse(
                                            injectParameters(queryParams, query)
                                          ),
                                          search_pipeline:
                                            curSearchPipeline || {},
                                        }),
                                      },
                                      dataSourceId,
                                    })
                                  )
                                    .unwrap()
                                    .then(async (resp) => {
                                      const hits = resp?.hits?.hits
                                        ?.map((hit: SearchHit) => hit._source)
                                        .slice(0, MAX_INPUT_DOCS);
                                      if (hits.length > 0) {
                                        setSourceInput(
                                          // if one-to-one, treat the source input as a single retrieved document
                                          // else, treat it as all of the returned documents
                                          customStringify(
                                            oneToOne ? hits[0] : hits
                                          )
                                        );
                                      }
                                    })
                                    .catch((error: any) => {
                                      getCore().notifications.toasts.addDanger(
                                        `Failed to fetch source input data`
                                      );
                                    })
                                    .finally(() => {
                                      setIsFetching(false);
                                    });
                                  break;
                                }
                              }
                            }}
                          >
                            Run preview
                          </EuiSmallButton>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    {props.context !== PROCESSOR_CONTEXT.INGEST &&
                      !isEmpty(queryParams) && (
                        <EuiFlexItem grow={false}>
                          <QueryParamsList
                            queryParams={queryParams}
                            setQueryParams={setQueryParams}
                          />
                        </EuiFlexItem>
                      )}
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup
                        direction="row"
                        gutterSize="s"
                        justifyContent="flexStart"
                      >
                        <EuiFlexItem grow={false}>
                          <EuiText size="s">Input data source</EuiText>
                        </EuiFlexItem>
                        <ProcessingBadge
                          context={props.context}
                          oneToOne={oneToOne}
                        />
                      </EuiFlexGroup>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiCodeEditor
                        mode="json"
                        theme="textmate"
                        width="100%"
                        height="15vh"
                        value={sourceInput}
                        readOnly={true}
                        setOptions={{
                          fontSize: '12px',
                          autoScrollEditorIntoView: true,
                          showLineNumbers: false,
                          showGutter: false,
                          showPrintMargin: false,
                          wrap: true,
                        }}
                        tabSize={2}
                      />
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiText size="s">Prompt</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiCodeEditor
                        mode="json"
                        theme="textmate"
                        width="100%"
                        height="15vh"
                        value={transformedTemplate}
                        readOnly={true}
                        setOptions={{
                          fontSize: '12px',
                          autoScrollEditorIntoView: true,
                          showLineNumbers: false,
                          showGutter: false,
                          showPrintMargin: false,
                          wrap: true,
                        }}
                        tabSize={2}
                      />
                    </EuiFlexItem>
                  </EuiFlexGroup>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiModalBody>
            <EuiModalFooter>
              <EuiSmallButtonEmpty
                onClick={props.onClose}
                color="primary"
                data-testid="closeTemplateButton"
              >
                Cancel
              </EuiSmallButtonEmpty>
              <EuiSmallButton
                onClick={() => {
                  formikProps
                    .submitForm()
                    .then((value: any) => {
                      onUpdate();
                    })
                    .catch((err: any) => {});
                }}
                isLoading={isUpdating}
                isDisabled={tempErrors} // blocking update until valid input is given
                fill={true}
                color="primary"
                data-testid="updateTemplateButton"
              >
                Save
              </EuiSmallButton>
            </EuiModalFooter>
          </EuiModal>
        );
      }}
    </Formik>
  );
}

// small util fn to get the full placeholder string to be
// inserted into the template. String conversion is required
// if the input is an array, so default to toString() for
// all types. Also, all values
// should be prepended with "parameters.", as all inputs
// will be nested under a base parameters obj.
function getPlaceholderString(label: string) {
  return `\$\{parameters.${label}.toString()\}`;
}

function injectValuesIntoTemplate(
  template: string,
  parameters: { [key: string]: any }
): string {
  let finalTemplate = template;
  // replace any parameter placeholders in the prompt with any values found in the
  // parameters obj.
  // we do 2 checks - one for the regular prompt, and one with "toString()" appended.
  // this is required for parameters that have values as a list, for example.
  Object.keys(parameters).forEach((parameterKey) => {
    const parameterValue = JSON.stringify(parameters[parameterKey]);
    const regex = new RegExp(`\\$\\{parameters.${parameterKey}\\}`, 'g');
    const regexWithToString = new RegExp(
      `\\$\\{parameters.${parameterKey}.toString\\(\\)\\}`,
      'g'
    );
    finalTemplate = finalTemplate
      .replace(regex, parameterValue)
      .replace(regexWithToString, parameterValue);
  });

  return finalTemplate;
}

function extractParametersFromTemplate(template: string): ExpressionVar[] {
  const expressionVars = [] as ExpressionVar[];
  const paramsFound = template.match(/\${([^}]+)}/g);
  paramsFound?.forEach((param) => {
    const curExpressionNames = expressionVars.map(
      (expressionVar) => expressionVar.name
    );
    const curExpressionName = param.slice(2, -1).split('.')[1];
    if (!curExpressionNames.includes(curExpressionName)) {
      expressionVars.push({
        name: curExpressionName,
        transform: '',
      });
    }
  });
  return expressionVars;
}
