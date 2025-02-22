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
  EuiPopover,
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
import { BulkPopoverContent } from './bulk_popover_content';

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
    const lines = getIn(values, 'ingest.docs', '').split('\n') as string[];
    lines.forEach((line) => docs.push(JSON.parse(line)));
  } catch {}
  const docsPopulated = docs.length > 0;

  // selected option state
  const [selectedOption, setSelectedOption] = useState<SOURCE_OPTIONS>(
    SOURCE_OPTIONS.MANUAL
  );

  // edit modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // bulk API popover state
  const [bulkPopoverOpen, setBulkPopoverOpen] = useState<boolean>(false);

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
            {docsPopulated && (
              <EuiFlexItem grow={false}>
                <EuiSmallButtonEmpty
                  onClick={() => setIsEditModalOpen(true)}
                  data-testid="editSourceDataButton"
                  iconType="pencil"
                  iconSide="left"
                >
                  Edit
                </EuiSmallButtonEmpty>
              </EuiFlexItem>
            )}
          </EuiFlexGroup>
        </EuiFlexItem>
        {props.lastIngested !== undefined && (
          <>
            <EuiFlexItem grow={false}>
              <EuiText size="s">
                {`Last ingested: ${toFormattedDate(props.lastIngested)}`}
              </EuiText>
            </EuiFlexItem>
            <EuiFlexItem>
              <EuiFlexGroup
                direction="row"
                gutterSize="none"
                justifyContent="flexStart"
                style={{ marginTop: '-8px' }}
              >
                <EuiFlexItem grow={false}>
                  <EuiText size="s">
                    Ingest additional data with the bulk API.
                  </EuiText>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiPopover
                    isOpen={bulkPopoverOpen}
                    initialFocus={false}
                    anchorPosition="downCenter"
                    closePopover={() => setBulkPopoverOpen(false)}
                    button={
                      <EuiSmallButtonEmpty
                        style={{ marginTop: '-4px' }}
                        onClick={() => {
                          setBulkPopoverOpen(!bulkPopoverOpen);
                        }}
                      >
                        Learn more
                      </EuiSmallButtonEmpty>
                    }
                  >
                    <BulkPopoverContent
                      indexName={getIn(values, 'ingest.index.name')}
                    />
                  </EuiPopover>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </>
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
            iconType="document"
            title={<h2>No data imported</h2>}
            titleSize="s"
            body={
              <>
                <EuiText size="s">
                  Import a data sample to start configuring your ingest flow.
                </EuiText>
                <EuiSpacer size="m" />
                <EuiSmallButton
                  fill={true}
                  style={{ width: '130px' }}
                  onClick={() => setIsEditModalOpen(true)}
                  data-testid="selectDataToImportButton"
                  iconType="plus"
                  iconSide="left"
                >
                  {`Import data`}
                </EuiSmallButton>
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
