/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { getIn, useFormikContext } from 'formik';
import {
  EuiSmallButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
  EuiCodeBlock,
  EuiSmallButtonEmpty,
  EuiEmptyPrompt,
} from '@elastic/eui';
import {
  MapEntry,
  SOURCE_OPTIONS,
  Workflow,
  WorkflowConfig,
  WorkflowFormValues,
  isVectorSearchUseCase,
  toFormattedDate,
} from '../../../../../common';
import { SourceDataModal } from './source_data_modal';

interface SourceDataProps {
  workflow: Workflow | undefined;
  uiConfig: WorkflowConfig;
  setIngestDocs: (docs: string) => void;
  lastIngested: number | undefined;
}

/**
 * Input component for configuring the source data for ingest.
 */
export function SourceData(props: SourceDataProps) {
  const { values, setFieldValue } = useFormikContext<WorkflowFormValues>();

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
        <SourceDataModal
          workflow={props.workflow}
          uiConfig={props.uiConfig}
          selectedOption={selectedOption}
          setSelectedOption={setSelectedOption}
          setIsModalOpen={setIsEditModalOpen}
        />
      )}
      <EuiFlexGroup direction="column" gutterSize="s">
        <EuiFlexItem grow={false}>
          <EuiFlexGroup direction="row" justifyContent="spaceBetween">
            <EuiFlexItem grow={false}>
              <EuiText size="s">
                <h3>Import sample data</h3>
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem grow={false}>
              {docsPopulated ? (
                <EuiSmallButtonEmpty
                  onClick={() => setIsEditModalOpen(true)}
                  data-testid="editSourceDataButton"
                  iconType="pencil"
                  iconSide="left"
                >
                  Edit
                </EuiSmallButtonEmpty>
              ) : (
                <EuiSmallButton
                  fill={false}
                  style={{ width: '100px' }}
                  onClick={() => setIsEditModalOpen(true)}
                  data-testid="selectDataToImportButton"
                >
                  {`Select data`}
                </EuiSmallButton>
              )}
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiFlexItem>
        {props.lastIngested !== undefined && (
          <EuiFlexItem grow={false}>
            <EuiText size="s" color="subdued">
              {`Last ingested: ${toFormattedDate(props.lastIngested)}`}
            </EuiText>
          </EuiFlexItem>
        )}
        {docsPopulated ? (
          <>
            <EuiSpacer size="s" />
            <EuiFlexItem grow={true}>
              <EuiCodeBlock
                fontSize="s"
                language="json"
                overflowHeight={300}
                isCopyable={false}
                whiteSpace="pre"
                paddingSize="none"
              >
                {getIn(values, 'ingest.docs')}
              </EuiCodeBlock>
            </EuiFlexItem>
          </>
        ) : (
          <EuiEmptyPrompt
            title={<h2>No data selected</h2>}
            titleSize="s"
            body={
              <>
                <EuiText size="s">Select some sample data to import.</EuiText>
              </>
            }
          />
        )}
      </EuiFlexGroup>
    </>
  );
}

// helper fn to parse out some useful info from the ML ingest processor config, if applicable
// takes on the assumption the first processor is an ML inference processor, and should
// only be executed for workflows coming from preset vector search use cases.
export function getProcessorInfo(
  uiConfig: WorkflowConfig,
  values: WorkflowFormValues
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
