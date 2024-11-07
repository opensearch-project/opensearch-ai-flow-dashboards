/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Field, FieldProps } from 'formik';
import {
  EuiCompressedCheckbox,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIconTip,
  EuiText,
} from '@elastic/eui';

interface BooleanFieldProps {
  fieldPath: string; // the full path in string-form to the field (e.g., 'ingest.enrich.processors.text_embedding_processor.inputField')
  label: string;
  helpText?: string;
}

/**
 * An input field for a boolean value. Implemented as an EuiCompressedRadioGroup with 2 mutually exclusive options.
 */
export function BooleanField(props: BooleanFieldProps) {
  return (
    <Field name={props.fieldPath}>
      {({ field, form }: FieldProps) => {
        return (
          <EuiCompressedCheckbox
            data-testid={`checkbox-${field.name}`}
            id={`checkbox-${field.name}`}
            label={
              <>
                <EuiFlexGroup direction="row">
                  <EuiFlexItem grow={false}>
                    <EuiText size="s">{props.label}</EuiText>
                  </EuiFlexItem>
                  {props.helpText && (
                    <EuiFlexItem
                      grow={false}
                      style={{ marginLeft: '-8px', marginTop: '10px' }}
                    >
                      <EuiIconTip content={props.helpText} position="right" />
                    </EuiFlexItem>
                  )}
                </EuiFlexGroup>
              </>
            }
            checked={field.value === undefined || field.value === true}
            onChange={() => {
              form.setFieldValue(field.name, !field.value);
              form.setFieldTouched(field.name, true);
            }}
          />
        );
      }}
    </Field>
  );
}
