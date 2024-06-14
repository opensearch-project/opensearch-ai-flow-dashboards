/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { EuiFlexGroup, EuiFlexItem, EuiText } from '@elastic/eui';
import { ProcessorsTitle } from '../../../../general_components';
import { WorkflowConfig } from '../../../../../common';

interface EnrichSearchRequestProps {
  uiConfig: WorkflowConfig;
}

/**
 * Input component for enriching a search request (configuring search request processors, etc.)
 */
export function EnrichSearchRequest(props: EnrichSearchRequestProps) {
  return (
    <EuiFlexGroup direction="column">
      <ProcessorsTitle
        title="Enhance query request"
        processorCount={
          props.uiConfig.search.enrichRequest.processors?.length || 0
        }
      />
      <EuiFlexItem>
        <EuiText grow={false}>TODO</EuiText>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
