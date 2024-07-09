/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  EuiAccordion,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
} from '@elastic/eui';
import { JsonField } from '../input_fields';

interface AdvancedSettingsProps {
  onFormChange: () => void;
}

/**
 * Input component for configuring ingest-side advanced settings
 */
export function AdvancedSettings(props: AdvancedSettingsProps) {
  return (
    <EuiFlexGroup direction="column">
      <EuiFlexItem grow={false}>
        <EuiAccordion id="advancedSettings" buttonContent="Advanced settings">
          <EuiSpacer size="s" />
          <EuiFlexGroup direction="column">
            <EuiFlexItem>
              <JsonField
                label="Index mappings"
                fieldPath={'ingest.index.mappings'}
                onFormChange={props.onFormChange}
              />
            </EuiFlexItem>
            <EuiFlexItem>
              <JsonField
                label="Index settings"
                fieldPath={'ingest.index.settings'}
                onFormChange={props.onFormChange}
              />
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiAccordion>
      </EuiFlexItem>
    </EuiFlexGroup>
  );
}
