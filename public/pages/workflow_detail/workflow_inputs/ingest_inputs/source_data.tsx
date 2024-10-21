/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { getIn, useFormikContext } from 'formik';
import {
  EuiSmallButton,
  EuiCompressedFilePicker,
  EuiFlexGroup,
  EuiFlexItem,
  EuiModal,
  EuiModalBody,
  EuiModalFooter,
  EuiModalHeader,
  EuiModalHeaderTitle,
  EuiSpacer,
  EuiText,
  EuiFilterGroup,
  EuiSmallFilterButton,
  EuiSuperSelectOption,
  EuiCompressedSuperSelect,
} from '@elastic/eui';
import { JsonField } from '../input_fields';
import {
  FETCH_ALL_QUERY,
  IndexMappings,
  MapEntry,
  SearchHit,
  Workflow,
  WorkflowConfig,
  WorkspaceFormValues,
  customStringify,
  isVectorSearchUseCase,
  toFormattedDate,
} from '../../../../../common';
import {
  AppState,
  getMappings,
  searchIndex,
  useAppDispatch,
} from '../../../../store';
import { getDataSourceId } from '../../../../utils';

interface SourceDataProps {
  workflow: Workflow | undefined;
  uiConfig: WorkflowConfig;
  setIngestDocs: (docs: string) => void;
  lastIngested: number | undefined;
}

enum SOURCE_OPTIONS {
  MANUAL = 'manual',
  UPLOAD = 'upload',
  EXISTING_INDEX = 'existing_index',
}

/**
 * Input component for configuring the source data for ingest.
 */
export function SourceData(props: SourceDataProps) {
  const dispatch = useAppDispatch();
  const dataSourceId = getDataSourceId();
  const { values, setFieldValue } = useFormikContext<WorkspaceFormValues>();
  const indices = useSelector((state: AppState) => state.opensearch.indices);

  // empty/populated docs state
  let docs = [];
  try {
    docs = JSON.parse(getIn(values, 'ingest.docs', []));
  } catch {}
  const docsPopulated = docs.length > 0;

  // selected option state
  const [selectedOption, setSelectedOption] = useState<SOURCE_OPTIONS>(
    SOURCE_OPTIONS.MANUAL
  );

  // edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // files state. when a file is read, update the form value.
  const fileReader = new FileReader();
  fileReader.onload = (e) => {
    if (e.target) {
      setFieldValue('ingest.docs', e.target.result);
    }
  };

  // selected index state. when an index is selected, update several form values (if vector search)
  const [selectedIndex, setSelectedIndex] = useState<string | undefined>(
    undefined
  );
  useEffect(() => {
    if (selectedIndex !== undefined) {
      // 1. fetch and set sample docs
      dispatch(
        searchIndex({
          apiBody: {
            index: selectedIndex,
            body: FETCH_ALL_QUERY,
            searchPipeline: '_none',
          },
          dataSourceId,
        })
      )
        .unwrap()
        .then((resp) => {
          const docObjs = resp.hits?.hits
            ?.slice(0, 5)
            ?.map((hit: SearchHit) => hit?._source);
          setFieldValue('ingest.docs', customStringify(docObjs));
        });

      // 2. fetch index mappings, and try to set defaults for the ML processor configs, if applicable
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
                }
              }
            }
          });
      }
    }
  }, [selectedIndex]);

  // hook to clear out the selected index when switching options
  useEffect(() => {
    if (selectedOption !== SOURCE_OPTIONS.EXISTING_INDEX) {
      setSelectedIndex(undefined);
    }
  }, [selectedOption]);

  // hook to listen when the docs form value changes.
  useEffect(() => {
    if (values?.ingest?.docs) {
      props.setIngestDocs(values.ingest.docs);
    }

    // try to clear out any default values for the ML ingest processor, if applicable
    if (
      isVectorSearchUseCase(props.workflow) &&
      isEditModalOpen &&
      selectedOption !== SOURCE_OPTIONS.EXISTING_INDEX
    ) {
      let sampleDoc = undefined as {} | undefined;
      try {
        sampleDoc = JSON.parse(values.ingest.docs)[0];
      } catch (error) {}
      if (sampleDoc !== undefined) {
        const { processorId, inputMapEntry } = getProcessorInfo(
          props.uiConfig,
          values
        );
        if (processorId !== undefined && inputMapEntry !== undefined) {
          if (inputMapEntry !== undefined) {
            const textFieldFormPath = `ingest.enrich.${processorId}.input_map.0.0.value`;
            const curTextField = getIn(values, textFieldFormPath) as string;
            if (!Object.keys(sampleDoc).includes(curTextField)) {
              setFieldValue(textFieldFormPath, '');
            }
          }
        }
      }
    }
  }, [values?.ingest?.docs]);

  return (
    <>
      {isEditModalOpen && (
        <EuiModal
          onClose={() => setIsEditModalOpen(false)}
          style={{ width: '70vw' }}
        >
          <EuiModalHeader>
            <EuiModalHeaderTitle>
              <p>{`Import data`}</p>
            </EuiModalHeaderTitle>
          </EuiModalHeader>
          <EuiModalBody>
            <>
              <EuiFilterGroup>
                <EuiSmallFilterButton
                  id={SOURCE_OPTIONS.MANUAL}
                  hasActiveFilters={selectedOption === SOURCE_OPTIONS.MANUAL}
                  onClick={() => setSelectedOption(SOURCE_OPTIONS.MANUAL)}
                  data-testid="manualEditSourceDataButton"
                >
                  Manual
                </EuiSmallFilterButton>
                <EuiSmallFilterButton
                  id={SOURCE_OPTIONS.UPLOAD}
                  hasActiveFilters={selectedOption === SOURCE_OPTIONS.UPLOAD}
                  onClick={() => setSelectedOption(SOURCE_OPTIONS.UPLOAD)}
                  data-testid="uploadSourceDataButton"
                >
                  Upload
                </EuiSmallFilterButton>
                <EuiSmallFilterButton
                  id={SOURCE_OPTIONS.EXISTING_INDEX}
                  hasActiveFilters={
                    selectedOption === SOURCE_OPTIONS.EXISTING_INDEX
                  }
                  onClick={() =>
                    setSelectedOption(SOURCE_OPTIONS.EXISTING_INDEX)
                  }
                  data-testid="selectIndexSourceDataButton"
                >
                  Existing index
                </EuiSmallFilterButton>
              </EuiFilterGroup>
              <EuiSpacer size="m" />
              {selectedOption === SOURCE_OPTIONS.UPLOAD && (
                <>
                  <EuiCompressedFilePicker
                    accept="application/json"
                    multiple={false}
                    initialPromptText="Upload file"
                    onChange={(files) => {
                      if (files && files.length > 0) {
                        fileReader.readAsText(files[0]);
                      }
                    }}
                    display="default"
                  />
                  <EuiSpacer size="s" />
                </>
              )}
              {selectedOption === SOURCE_OPTIONS.EXISTING_INDEX && (
                <>
                  <EuiText color="subdued" size="s">
                    Up to 5 sample documents will be automatically populated.
                  </EuiText>
                  <EuiSpacer size="s" />
                  <EuiCompressedSuperSelect
                    options={Object.values(indices).map(
                      (option) =>
                        ({
                          value: option.name,
                          inputDisplay: (
                            <EuiText size="s">{option.name}</EuiText>
                          ),
                          disabled: false,
                        } as EuiSuperSelectOption<string>)
                    )}
                    valueOfSelected={selectedIndex}
                    onChange={(option) => {
                      setSelectedIndex(option);
                    }}
                    isInvalid={false}
                  />
                  <EuiSpacer size="xs" />
                </>
              )}
              <JsonField
                label="Documents to be imported"
                fieldPath={'ingest.docs'}
                helpText="Documents should be formatted as a valid JSON array."
                editorHeight="25vh"
                readOnly={false}
              />
            </>
          </EuiModalBody>
          <EuiModalFooter>
            <EuiSmallButton
              onClick={() => setIsEditModalOpen(false)}
              fill={false}
              color="primary"
              data-testid="closeSourceDataButton"
            >
              Close
            </EuiSmallButton>
          </EuiModalFooter>
        </EuiModal>
      )}
      <EuiFlexGroup direction="column" gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiText size="s">
            <h3>Source data</h3>
          </EuiText>
        </EuiFlexItem>
        {props.lastIngested !== undefined && (
          <EuiFlexItem grow={false}>
            <EuiText size="s" color="subdued">
              {`Last ingested: ${toFormattedDate(props.lastIngested)}`}
            </EuiText>
          </EuiFlexItem>
        )}

        <EuiFlexItem grow={false}>
          <EuiSmallButton
            fill={false}
            style={{ width: '100px' }}
            onClick={() => setIsEditModalOpen(true)}
            data-testid="editSourceDataButton"
          >
            {docsPopulated ? `Edit` : `Select data`}
          </EuiSmallButton>
        </EuiFlexItem>
        {docsPopulated && (
          <EuiFlexItem grow={false}>
            <JsonField
              label="Documents to be imported"
              fieldPath={'ingest.docs'}
              helpText="Documents should be formatted as a valid JSON array."
              editorHeight="25vh"
              readOnly={true}
            />
          </EuiFlexItem>
        )}
      </EuiFlexGroup>
    </>
  );
}

// helper fn to parse out some useful info from the ML ingest processor config, if applicable
// takes on the assumption the first processor is an ML inference processor, and should
// only be executed for workflows coming from preset vector search use cases.
function getProcessorInfo(
  uiConfig: WorkflowConfig,
  values: WorkspaceFormValues
): {
  processorId: string | undefined;
  inputMapEntry: MapEntry | undefined;
} {
  const ingestProcessorId = uiConfig.ingest.enrich.processors[0]?.id as
    | string
    | undefined;
  return {
    processorId: ingestProcessorId,
    inputMapEntry:
      (getIn(
        values,
        `ingest.enrich.${ingestProcessorId}.input_map.0.0`,
        undefined
      ) as MapEntry) || undefined,
  };
}
