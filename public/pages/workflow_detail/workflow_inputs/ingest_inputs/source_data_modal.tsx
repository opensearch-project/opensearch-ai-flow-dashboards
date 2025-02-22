/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Formik, getIn, useFormikContext } from 'formik';
import { isEmpty } from 'lodash';
import * as yup from 'yup';
import {
  EuiSmallButton,
  EuiCompressedFilePicker,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSpacer,
  EuiText,
  EuiSmallButtonEmpty,
  EuiButtonGroup,
  EuiCompressedComboBox,
  EuiLink,
} from '@elastic/eui';
import { JsonLinesField } from '../input_fields';
import {
  customStringifySingleLine,
  FETCH_ALL_QUERY_LARGE,
  IConfigField,
  IndexMappings,
  IngestDocsFormValues,
  isVectorSearchUseCase,
  JSONLINES_LINK,
  MAX_BYTES_FORMATTED,
  MAX_DOCS_TO_IMPORT,
  SearchHit,
  SOURCE_OPTIONS,
  Workflow,
  WorkflowConfig,
  WorkflowFormValues,
} from '../../../../../common';
import {
  AppState,
  getMappings,
  searchIndex,
  useAppDispatch,
} from '../../../../store';
import {
  getDataSourceId,
  getFieldSchema,
  getInitialValue,
} from '../../../../utils';
import { getProcessorInfo } from './source_data';
import '../../../../global-styles.scss';

interface SourceDataProps {
  workflow: Workflow | undefined;
  uiConfig: WorkflowConfig;
  selectedOption: SOURCE_OPTIONS;
  setSelectedOption: (option: SOURCE_OPTIONS) => void;
  setIsModalOpen: (isOpen: boolean) => void;
}

/**
 * Modal for configuring the source data for ingest. Maintains standalone form state, and only updates
 * parent form if the user explicitly clicks "Update", and there are no validation errors.
 */
export function SourceDataModal(props: SourceDataProps) {
  const dispatch = useAppDispatch();
  const dataSourceId = getDataSourceId();
  const { values, setFieldValue } = useFormikContext<WorkflowFormValues>();
  const indices = useSelector((state: AppState) => state.opensearch.indices);

  // sub-form values/schema
  const docsFormValues = {
    docs: getInitialValue('jsonLines'),
  } as IngestDocsFormValues;
  const docsFormSchema = yup.object({
    docs: getFieldSchema({
      type: 'jsonLines',
    } as IConfigField),
  }) as yup.Schema;

  // persist standalone values. update / initialize when it is first opened
  const [tempDocs, setTempDocs] = useState<string>('[]');
  const [tempErrors, setTempErrors] = useState<boolean>(false);

  // button updating state
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // selected index state
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>(
    undefined
  );

  // hook to clear out the selected index when switching options
  useEffect(() => {
    if (props.selectedOption !== SOURCE_OPTIONS.EXISTING_INDEX) {
      setSelectedIndex(undefined);
    }
  }, [props.selectedOption]);

  function onClose() {
    props.setIsModalOpen(false);
  }

  function onUpdate() {
    setIsUpdating(true);
    // 1. Update the form with the temp docs
    setFieldValue('ingest.docs', tempDocs);

    // 2. Update several form values if an index is selected (and if vector search)
    if (selectedIndex !== undefined) {
      if (isVectorSearchUseCase(props.workflow)) {
        dispatch(getMappings({ index: selectedIndex, dataSourceId }))
          .unwrap()
          .then((resp: IndexMappings) => {
            const { processorId, inputMapEntry } = getProcessorInfo(
              props.uiConfig,
              values
            );
            if (processorId !== undefined && inputMapEntry !== undefined) {
              // set/overwrite default text field for the input map. may be empty.
              if (inputMapEntry !== undefined) {
                const textFieldFormPath = `ingest.enrich.${processorId}.input_map.0.0.value`;
                const curTextField = getIn(values, textFieldFormPath) as string;
                if (!Object.keys(resp.properties).includes(curTextField)) {
                  const defaultTextField =
                    Object.keys(resp.properties).find((fieldName) => {
                      return resp.properties[fieldName]?.type === 'text';
                    }) || '';
                  setFieldValue(textFieldFormPath, defaultTextField);
                  setIsUpdating(false);
                }
              }
            }
          });
      }
    } else {
      setIsUpdating(false);
    }
    props.setIsModalOpen(false);
  }

  return (
    <Formik
      enableReinitialize={false}
      initialValues={docsFormValues}
      validationSchema={docsFormSchema}
      onSubmit={(values) => {}}
      validate={(values) => {}}
    >
      {(formikProps) => {
        // override to parent form value when changes detected
        useEffect(() => {
          formikProps.setFieldValue('docs', getIn(values, 'ingest.docs'));
        }, [getIn(values, 'ingest.docs')]);

        // update tempDocs when form changes are detected
        useEffect(() => {
          setTempDocs(getIn(formikProps.values, 'docs'));
        }, [getIn(formikProps.values, 'docs')]);

        // fetch & populate sample documents if an existing index is chosen
        useEffect(() => {
          if (selectedIndex !== undefined) {
            dispatch(
              searchIndex({
                apiBody: {
                  index: selectedIndex,
                  body: FETCH_ALL_QUERY_LARGE,
                  searchPipeline: '_none',
                },
                dataSourceId,
              })
            )
              .unwrap()
              .then((resp) => {
                const docObjs = resp?.hits?.hits
                  ?.slice(0, MAX_DOCS_TO_IMPORT)
                  ?.map((hit: SearchHit) => hit?._source) as {}[];
                let jsonLinesStr = '';
                try {
                  docObjs.forEach((docObj) => {
                    jsonLinesStr += customStringifySingleLine(docObj) + '\n';
                  });
                } catch {}
                formikProps.setFieldValue('docs', jsonLinesStr);
              });
          }
        }, [selectedIndex]);

        // update tempErrors if errors detected
        useEffect(() => {
          setTempErrors(!isEmpty(formikProps.errors));
        }, [formikProps.errors]);

        return (
          <EuiModal
            maxWidth={false}
            onClose={() => onClose()}
            className="configuration-modal"
          >
            <EuiModalHeader>
              <EuiModalHeaderTitle>
                <p>{`Import sample data`}</p>
              </EuiModalHeaderTitle>
            </EuiModalHeader>
            <EuiModalBody>
              <>
                <EuiText size="s" color="subdued">
                  To start configuring an ingest flow, import a sample of your
                  data. You may ingest additional data using the Bulk API after
                  configuring the ingest flow.
                </EuiText>
                <EuiSpacer size="s" />
                <EuiButtonGroup
                  legend="Import options"
                  buttonSize="compressed"
                  idSelected={props.selectedOption}
                  options={[
                    {
                      id: SOURCE_OPTIONS.MANUAL,
                      label: 'Enter manually',
                    },

                    {
                      id: SOURCE_OPTIONS.UPLOAD,
                      label: 'Upload a file',
                    },
                    {
                      id: SOURCE_OPTIONS.EXISTING_INDEX,
                      label: 'Upload from an existing index',
                    },
                  ]}
                  onChange={(id) =>
                    props.setSelectedOption(id as SOURCE_OPTIONS)
                  }
                />
                <EuiSpacer size="m" />
                {props.selectedOption === SOURCE_OPTIONS.UPLOAD && (
                  <>
                    <EuiCompressedFilePicker
                      accept=".jsonl"
                      multiple={false}
                      initialPromptText="Upload file"
                      onChange={(files) => {
                        if (files && files.length > 0) {
                          // create a custom filereader to update form with file values
                          const fileReader = new FileReader();
                          fileReader.onload = (e) => {
                            if (e.target) {
                              formikProps.setFieldValue(
                                'docs',
                                e.target.result as string
                              );
                              formikProps.setFieldTouched('docs');
                            }
                          };
                          fileReader.readAsText(files[0]);
                        }
                      }}
                      display="default"
                    />
                    <EuiText
                      size="xs"
                      color="subdued"
                    >{`The file size must be ${MAX_BYTES_FORMATTED} bytes or less.`}</EuiText>
                    <EuiSpacer size="s" />
                  </>
                )}
                {props.selectedOption === SOURCE_OPTIONS.EXISTING_INDEX && (
                  <>
                    <EuiCompressedComboBox
                      placeholder="Select an index"
                      singleSelection={{ asPlainText: true }}
                      options={Object.values(indices || {}).map((option) => {
                        return { label: option.name };
                      })}
                      onChange={(options) => {
                        setSelectedIndex(getIn(options, '0.label'));
                      }}
                      selectedOptions={
                        selectedIndex !== undefined
                          ? [{ label: selectedIndex }]
                          : []
                      }
                      isClearable={true}
                    />
                    <EuiText
                      size="xs"
                      color="subdued"
                    >{`Only the first ${MAX_DOCS_TO_IMPORT} documents will be imported.`}</EuiText>
                    <EuiSpacer size="xs" />
                  </>
                )}
                <JsonLinesField
                  label="Documents to be imported"
                  fieldPath={'docs'}
                  helpText={
                    <EuiText size="s">
                      Documents must be in JSON lines format.{' '}
                      <EuiLink href={JSONLINES_LINK} target="_blank">
                        Learn more
                      </EuiLink>
                    </EuiText>
                  }
                  editorHeight="40vh"
                  readOnly={false}
                  validate={true}
                />
              </>
            </EuiModalBody>
            <EuiModalFooter>
              <EuiSmallButtonEmpty
                onClick={() => onClose()}
                color="primary"
                data-testid="closeSourceDataButton"
              >
                Cancel
              </EuiSmallButtonEmpty>
              <EuiSmallButton
                onClick={() => onUpdate()}
                isLoading={isUpdating}
                isDisabled={tempErrors} // blocking update until valid input is given
                fill={true}
                color="primary"
                data-testid="updateSourceDataButton"
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
