/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useFormikContext, getIn, Formik } from 'formik';
import { cloneDeep, isEmpty, set } from 'lodash';
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
  EuiSmallButtonEmpty,
  EuiSpacer,
  EuiSmallButtonIcon,
  EuiPopover,
} from '@elastic/eui';
import {
  customStringify,
  ExpressionVar,
  IngestPipelineConfig,
  IProcessorConfig,
  MAX_STRING_LENGTH,
  ModelInterface,
  MultiExpressionFormValues,
  OutputMapEntry,
  PROCESSOR_CONTEXT,
  QueryParam,
  SearchHit,
  SearchPipelineConfig,
  SimulateIngestPipelineResponse,
  TRANSFORM_CONTEXT,
  WorkflowConfig,
  WorkflowFormValues,
} from '../../../../../../../common';
import {
  containsEmptyValues,
  containsSameValues,
  formikToPartialPipeline,
  generateTransform,
  getDataSourceId,
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
  QueryParamsList,
} from '../../../../../../general_components';
import '../../../../../../global-styles.scss';

interface ConfigureMultiExpressionModalProps {
  uiConfig: WorkflowConfig;
  config: IProcessorConfig;
  context: PROCESSOR_CONTEXT;
  baseConfigPath: string;
  modelInputFieldName: string;
  fieldPath: string;
  modelInterface: ModelInterface | undefined;
  outputMapFieldPath: string;
  isDataFetchingAvailable: boolean;
  onClose: () => void;
}

// Spacing between the input field columns
const KEY_FLEX_RATIO = 6;
const VALUE_FLEX_RATIO = 4;

/**
 * A modal to configure multiple JSONPath expression / transforms. Used for parsing out
 * model outputs, which can be arbitrarily complex / nested.
 */
export function ConfigureMultiExpressionModal(
  props: ConfigureMultiExpressionModalProps
) {
  const dispatch = useAppDispatch();
  const dataSourceId = getDataSourceId();
  const { values, setFieldValue, setFieldTouched } = useFormikContext<
    WorkflowFormValues
  >();

  // sub-form values/schema
  const expressionsFormValues = {
    expressions: [{ name: '', transform: '' } as ExpressionVar],
  } as MultiExpressionFormValues;
  const expressionsFormSchema = yup.object({
    expressions: yup
      .array()
      .of(
        yup.object({
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
      )
      .min(1),
  }) as yup.Schema;

  // persist standalone values. update / initialize when it is first opened
  const [tempExpressions, setTempExpressions] = useState<ExpressionVar[]>([]);
  const [tempErrors, setTempErrors] = useState<boolean>(false);

  // get some current form values
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

  // button updating state
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // JSONPath details popover state
  const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

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
    const tempExpressionsAsOutputMap = tempExpressions.map(
      (expressionVar) =>
        ({
          key: expressionVar.name || '',
          value: {
            value: expressionVar.transform || '',
          },
        } as OutputMapEntry)
    );
    if (
      !isEmpty(tempExpressionsAsOutputMap) &&
      !isEmpty(JSON.parse(sourceInput))
    ) {
      let sampleSourceInput = {} as {} | [];
      try {
        sampleSourceInput = JSON.parse(sourceInput);
        const output = generateTransform(
          sampleSourceInput,
          tempExpressionsAsOutputMap,
          props.context,
          TRANSFORM_CONTEXT.OUTPUT
        );
        setTransformedInput(customStringify(output));
      } catch {}
    } else {
      setTransformedInput('{}');
    }
  }, [tempExpressions, sourceInput]);

  // if updating, take the temp vars and assign it to the parent form
  function onUpdate() {
    setIsUpdating(true);
    setFieldValue(`${props.fieldPath}.nestedVars`, tempExpressions);
    setFieldTouched(props.fieldPath, true);
    props.onClose();
  }

  return (
    <Formik
      enableReinitialize={false}
      initialValues={expressionsFormValues}
      validationSchema={expressionsFormSchema}
      onSubmit={(values) => {}}
      validate={(values) => {}}
    >
      {(formikProps) => {
        // override to parent form values when changes detected (when non-empty)
        useEffect(() => {
          if (!isEmpty(getIn(values, `${props.fieldPath}.nestedVars`))) {
            formikProps.setFieldValue(
              'expressions',
              getIn(values, `${props.fieldPath}.nestedVars`)
            );
          }
        }, [getIn(values, props.fieldPath)]);

        // update temp vars when form changes are detected
        useEffect(() => {
          setTempExpressions(getIn(formikProps.values, 'expressions'));
        }, [getIn(formikProps.values, 'expressions')]);

        // update tempErrors if errors detected
        useEffect(() => {
          setTempErrors(!isEmpty(formikProps.errors));
        }, [formikProps.errors]);

        // Adding an input var to the end of the existing arr
        function addExpression(curExpressions: ExpressionVar[]): void {
          const updatedExpressions = [
            ...curExpressions,
            { name: '', transform: '' } as ExpressionVar,
          ];
          formikProps.setFieldValue(`expressions`, updatedExpressions);
          formikProps.setFieldTouched(`expressions`, true);
        }

        // Deleting an input var
        function deleteExpression(
          expressions: ExpressionVar[],
          idxToDelete: number
        ): void {
          const updatedExpressions = [...expressions];
          updatedExpressions.splice(idxToDelete, 1);
          formikProps.setFieldValue('expressions', updatedExpressions);
          formikProps.setFieldTouched('expressions', true);
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
                    <p>{`Configure JSONPath expression`}</p>
                  </EuiModalHeaderTitle>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiText color="subdued">
                    Use a JSONPath expression to extract specific data from a
                    JSON structure and map it to the model input field.
                  </EuiText>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiModalHeader>
            <EuiModalBody style={{ height: '40vh' }}>
              <EuiFlexGroup direction="row">
                <EuiFlexItem grow={5}>
                  <EuiFlexGroup direction="column" gutterSize="xs">
                    <EuiFlexItem grow={false}>
                      <EuiFlexGroup direction="row" gutterSize="s">
                        <EuiFlexItem grow={KEY_FLEX_RATIO}>
                          <EuiFlexGroup
                            direction="row"
                            justifyContent="spaceBetween"
                          >
                            <EuiFlexItem grow={false}>
                              <EuiText size="s">{`Expression`}</EuiText>
                            </EuiFlexItem>
                            <EuiFlexItem grow={false}>
                              <EuiPopover
                                isOpen={popoverOpen}
                                initialFocus={false}
                                anchorPosition="downCenter"
                                closePopover={() => setPopoverOpen(false)}
                                button={
                                  <EuiSmallButtonEmpty
                                    style={{ marginTop: '-4px' }}
                                    onClick={() => setPopoverOpen(!popoverOpen)}
                                  >
                                    Using JSONPath
                                  </EuiSmallButtonEmpty>
                                }
                              >
                                <JsonPathExamplesTable
                                  headerText={`Define JSONPath to transform your model outputs to new ${
                                    props.context ===
                                    PROCESSOR_CONTEXT.SEARCH_REQUEST
                                      ? 'query'
                                      : 'document'
                                  } fields.`}
                                />
                              </EuiPopover>
                            </EuiFlexItem>
                          </EuiFlexGroup>
                        </EuiFlexItem>
                        <EuiFlexItem grow={VALUE_FLEX_RATIO}>
                          <EuiText size="s">
                            {props.context === PROCESSOR_CONTEXT.SEARCH_REQUEST
                              ? `New query field`
                              : `New document field`}
                          </EuiText>
                        </EuiFlexItem>
                      </EuiFlexGroup>
                      <EuiSpacer size="s" />
                      {formikProps.values.expressions?.map(
                        (expression, idx) => {
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
                                    fieldPath={`expressions.${idx}.transform`}
                                    placeholder={`Transform`}
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
                                        fieldPath={`expressions.${idx}.name`}
                                        placeholder={
                                          props.context ===
                                          PROCESSOR_CONTEXT.SEARCH_REQUEST
                                            ? `New query field`
                                            : `New document field`
                                        }
                                        showError={true}
                                      />
                                    </EuiFlexItem>
                                    {idx > 0 && (
                                      <EuiFlexItem grow={false}>
                                        <EuiSmallButtonIcon
                                          iconType={'trash'}
                                          color="danger"
                                          aria-label="Delete"
                                          onClick={() => {
                                            deleteExpression(
                                              formikProps.values.expressions ||
                                                [],
                                              idx
                                            );
                                          }}
                                        />
                                      </EuiFlexItem>
                                    )}
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
                          width: '150px',
                        }}
                        iconType={'plusInCircle'}
                        iconSide="left"
                        onClick={() => {
                          addExpression(formikProps.values.expressions || []);
                        }}
                      >
                        {`Add expression`}
                      </EuiSmallButtonEmpty>
                      <EuiSpacer size="s" />
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
                                // note we skip search request processor context. that is because empty output maps are not supported.
                                // for more details, see comment in ml_processor_inputs.tsx
                                case PROCESSOR_CONTEXT.INGEST: {
                                  // get the current ingest pipeline up to, and including this processor.
                                  // remove any currently-configured output map since we only want the transformation
                                  // up to, and including, the input map transformations
                                  const valuesWithoutOutputMapConfig = cloneDeep(
                                    values
                                  );
                                  set(
                                    valuesWithoutOutputMapConfig,
                                    props.outputMapFieldPath,
                                    []
                                  );
                                  const curIngestPipeline = formikToPartialPipeline(
                                    valuesWithoutOutputMapConfig,
                                    props.uiConfig,
                                    props.config.id,
                                    true,
                                    PROCESSOR_CONTEXT.INGEST
                                  ) as IngestPipelineConfig;
                                  const curDocs = prepareDocsForSimulate(
                                    values.ingest.docs,
                                    values.ingest.index.name
                                  );
                                  await dispatch(
                                    simulatePipeline({
                                      apiBody: {
                                        pipeline: curIngestPipeline,
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
                                        try {
                                          const docObjs = unwrapTransformedDocs(
                                            resp
                                          );
                                          if (docObjs.length > 0) {
                                            const sampleModelResult =
                                              docObjs[0]?.inference_results ||
                                              {};
                                            setSourceInput(
                                              customStringify(sampleModelResult)
                                            );
                                          }
                                        } catch {}
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
                                  break;
                                }
                                case PROCESSOR_CONTEXT.SEARCH_RESPONSE: {
                                  // get the current search pipeline up to, and including this processor.
                                  // remove any currently-configured output map since we only want the transformation
                                  // up to, and including, the input map transformations
                                  const valuesWithoutOutputMapConfig = cloneDeep(
                                    values
                                  );
                                  set(
                                    valuesWithoutOutputMapConfig,
                                    props.outputMapFieldPath,
                                    []
                                  );
                                  const curSearchPipeline = formikToPartialPipeline(
                                    valuesWithoutOutputMapConfig,
                                    props.uiConfig,
                                    props.config.id,
                                    true,
                                    PROCESSOR_CONTEXT.SEARCH_RESPONSE
                                  ) as SearchPipelineConfig;

                                  // Execute search. Augment the existing query with
                                  // the partial search pipeline (inline) to get the latest transformed
                                  // version of the request.
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
                                      const hits = resp?.hits?.hits?.map(
                                        (hit: SearchHit) => hit._source
                                      ) as any[];
                                      if (hits.length > 0) {
                                        const sampleModelResult =
                                          hits[0].inference_results || {};
                                        setSourceInput(
                                          customStringify(sampleModelResult)
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
                      <EuiText size="s">Output data source</EuiText>
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
                      <EuiText size="s">Extracted data</EuiText>
                    </EuiFlexItem>
                    <EuiFlexItem grow={false}>
                      <EuiCodeEditor
                        mode="json"
                        theme="textmate"
                        width="100%"
                        height="15vh"
                        value={transformedInput}
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
                data-testid="closeMultiExpressionButton"
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
                data-testid="updateMultiExpressionButton"
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
