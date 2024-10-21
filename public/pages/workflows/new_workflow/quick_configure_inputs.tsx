/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  EuiCompressedFormRow,
  EuiText,
  EuiSpacer,
  EuiCompressedSuperSelect,
  EuiSuperSelectOption,
  EuiAccordion,
  EuiCompressedFieldText,
  EuiCompressedFieldNumber,
} from '@elastic/eui';
import {
  BEDROCK_DIMENSIONS,
  COHERE_DIMENSIONS,
  DEFAULT_IMAGE_FIELD,
  DEFAULT_LABEL_FIELD,
  DEFAULT_LLM_RESPONSE_FIELD,
  DEFAULT_TEXT_FIELD,
  DEFAULT_VECTOR_FIELD,
  MODEL_STATE,
  Model,
  OPENAI_DIMENSIONS,
  QuickConfigureFields,
  WORKFLOW_TYPE,
} from '../../../../common';
import { AppState } from '../../../store';

interface QuickConfigureInputsProps {
  workflowType?: WORKFLOW_TYPE;
  setFields(fields: QuickConfigureFields): void;
}

// Dynamic component to allow optional input configuration fields for different use cases.
// Hooks back to the parent component with such field values
export function QuickConfigureInputs(props: QuickConfigureInputsProps) {
  const { models, connectors } = useSelector((state: AppState) => state.ml);

  // Deployed models state
  const [deployedModels, setDeployedModels] = useState<Model[]>([]);

  // Hook to update available deployed models
  useEffect(() => {
    if (models) {
      setDeployedModels(
        Object.values(models).filter(
          (model) => model.state === MODEL_STATE.DEPLOYED
        )
      );
    }
  }, [models]);

  // Local field values state
  const [fieldValues, setFieldValues] = useState<QuickConfigureFields>({});

  // on initial load, and when there are any deployed models found, set
  // defaults for the field values for certain workflow types
  useEffect(() => {
    let defaultFieldValues = {} as QuickConfigureFields;
    switch (props.workflowType) {
      case WORKFLOW_TYPE.SEMANTIC_SEARCH:
      case WORKFLOW_TYPE.HYBRID_SEARCH: {
        defaultFieldValues = {
          textField: DEFAULT_TEXT_FIELD,
          vectorField: DEFAULT_VECTOR_FIELD,
        };
        break;
      }
      case WORKFLOW_TYPE.MULTIMODAL_SEARCH: {
        defaultFieldValues = {
          textField: DEFAULT_TEXT_FIELD,
          vectorField: DEFAULT_VECTOR_FIELD,
          imageField: DEFAULT_IMAGE_FIELD,
        };
        break;
      }
      case WORKFLOW_TYPE.SENTIMENT_ANALYSIS: {
        defaultFieldValues = {
          textField: DEFAULT_TEXT_FIELD,
          labelField: DEFAULT_LABEL_FIELD,
        };
        break;
      }
      case WORKFLOW_TYPE.RAG: {
        defaultFieldValues = {
          textField: DEFAULT_TEXT_FIELD,
          llmResponseField: DEFAULT_LLM_RESPONSE_FIELD,
        };
        break;
      }
      case WORKFLOW_TYPE.CUSTOM:
      default:
        break;
    }
    if (deployedModels.length > 0) {
      defaultFieldValues = {
        ...defaultFieldValues,
        modelId: deployedModels[0].id,
      };
    }
    setFieldValues(defaultFieldValues);
  }, [deployedModels]);

  // Hook to update the parent field values
  useEffect(() => {
    props.setFields(fieldValues);
  }, [fieldValues]);

  // Try to pre-fill the dimensions based on the chosen model
  useEffect(() => {
    const selectedModel = deployedModels.find(
      (model) => model.id === fieldValues.modelId
    );
    if (selectedModel?.connectorId !== undefined) {
      const connector = connectors[selectedModel.connectorId];
      if (connector !== undefined) {
        // some APIs allow specifically setting the dimensions at runtime,
        // so we check for that first.
        if (connector.parameters?.dimensions !== undefined) {
          setFieldValues({
            ...fieldValues,
            embeddingLength: connector.parameters?.dimensions,
          });
        } else if (connector.parameters?.model !== undefined) {
          const dimensions =
            // @ts-ignore
            COHERE_DIMENSIONS[connector.parameters?.model] ||
            // @ts-ignore
            OPENAI_DIMENSIONS[connector.parameters?.model] ||
            // @ts-ignore
            BEDROCK_DIMENSIONS[connector.parameters?.model];
          if (dimensions !== undefined) {
            setFieldValues({
              ...fieldValues,
              embeddingLength: dimensions,
            });
          }
        } else {
          setFieldValues({
            ...fieldValues,
            embeddingLength: undefined,
          });
        }
      }
    }
  }, [fieldValues.modelId, deployedModels, connectors]);

  return (
    <>
      {props.workflowType !== WORKFLOW_TYPE.CUSTOM ? (
        <>
          <EuiSpacer size="m" />
          <EuiAccordion
            id="optionalConfiguration"
            buttonContent="Optional configuration"
            initialIsOpen={false}
            data-testid="optionalConfigurationButton"
          >
            <EuiSpacer size="m" />
            <EuiCompressedFormRow
              fullWidth={true}
              label={
                props.workflowType === WORKFLOW_TYPE.SENTIMENT_ANALYSIS
                  ? 'Model'
                  : props.workflowType === WORKFLOW_TYPE.RAG
                  ? 'Large language model'
                  : 'Embedding model'
              }
              isInvalid={false}
              helpText={
                props.workflowType === WORKFLOW_TYPE.SENTIMENT_ANALYSIS
                  ? 'The sentiment analysis model'
                  : props.workflowType === WORKFLOW_TYPE.RAG
                  ? 'The large language model to generate user-friendly responses'
                  : 'The model to generate embeddings'
              }
            >
              <EuiCompressedSuperSelect
                data-testid="selectDeployedModel"
                fullWidth={true}
                options={deployedModels.map(
                  (option) =>
                    ({
                      value: option.id,
                      inputDisplay: (
                        <>
                          <EuiText size="s">{option.name}</EuiText>
                        </>
                      ),
                      dropdownDisplay: (
                        <>
                          <EuiText size="s">{option.name}</EuiText>
                          <EuiText size="xs" color="subdued">
                            Deployed
                          </EuiText>
                          <EuiText size="xs" color="subdued">
                            {option.algorithm}
                          </EuiText>
                        </>
                      ),
                      disabled: false,
                    } as EuiSuperSelectOption<string>)
                )}
                valueOfSelected={fieldValues?.modelId || ''}
                onChange={(option: string) => {
                  setFieldValues({
                    ...fieldValues,
                    modelId: option,
                  });
                }}
                isInvalid={false}
              />
            </EuiCompressedFormRow>
            <EuiSpacer size="s" />
            <EuiCompressedFormRow
              fullWidth={true}
              label={'Text field'}
              isInvalid={false}
              helpText={`The name of the text document field to be ${
                props.workflowType === WORKFLOW_TYPE.SENTIMENT_ANALYSIS
                  ? 'analyzed'
                  : props.workflowType === WORKFLOW_TYPE.RAG
                  ? 'used as context to the large language model (LLM)'
                  : 'embedded'
              }`}
            >
              <EuiCompressedFieldText
                data-testid="textFieldQuickConfigure"
                fullWidth={true}
                value={fieldValues?.textField || ''}
                onChange={(e) => {
                  setFieldValues({
                    ...fieldValues,
                    textField: e.target.value,
                  });
                }}
              />
            </EuiCompressedFormRow>
            <EuiSpacer size="s" />
            {props.workflowType === WORKFLOW_TYPE.MULTIMODAL_SEARCH && (
              <>
                <EuiCompressedFormRow
                  fullWidth={true}
                  label={'Image field'}
                  isInvalid={false}
                  helpText="The name of the document field containing the image binary"
                >
                  <EuiCompressedFieldText
                    fullWidth={true}
                    value={fieldValues?.imageField || ''}
                    onChange={(e) => {
                      setFieldValues({
                        ...fieldValues,
                        imageField: e.target.value,
                      });
                    }}
                  />
                </EuiCompressedFormRow>
                <EuiSpacer size="s" />
              </>
            )}
            {(props.workflowType === WORKFLOW_TYPE.SEMANTIC_SEARCH ||
              props.workflowType === WORKFLOW_TYPE.MULTIMODAL_SEARCH ||
              props.workflowType === WORKFLOW_TYPE.HYBRID_SEARCH) && (
              <>
                <EuiCompressedFormRow
                  fullWidth={true}
                  label={'Vector field'}
                  isInvalid={false}
                  helpText="The name of the document field containing the vector embedding"
                >
                  <EuiCompressedFieldText
                    fullWidth={true}
                    value={fieldValues?.vectorField || ''}
                    onChange={(e) => {
                      setFieldValues({
                        ...fieldValues,
                        vectorField: e.target.value,
                      });
                    }}
                  />
                </EuiCompressedFormRow>
                <EuiSpacer size="s" />
                <EuiCompressedFormRow
                  fullWidth={true}
                  label={'Embedding length'}
                  isInvalid={false}
                  helpText="The length / dimension of the generated vector embeddings. Autofilled values may be inaccurate."
                >
                  <EuiCompressedFieldNumber
                    fullWidth={true}
                    value={fieldValues?.embeddingLength || ''}
                    onChange={(e) => {
                      setFieldValues({
                        ...fieldValues,
                        embeddingLength: Number(e.target.value),
                      });
                    }}
                  />
                </EuiCompressedFormRow>
              </>
            )}
            {props.workflowType === WORKFLOW_TYPE.SENTIMENT_ANALYSIS && (
              <EuiCompressedFormRow
                fullWidth={true}
                label={'Label field'}
                isInvalid={false}
                helpText="The name of the document field containing the sentiment label"
              >
                <EuiCompressedFieldText
                  fullWidth={true}
                  value={fieldValues?.labelField || ''}
                  onChange={(e) => {
                    setFieldValues({
                      ...fieldValues,
                      labelField: e.target.value,
                    });
                  }}
                />
              </EuiCompressedFormRow>
            )}
            {props.workflowType === WORKFLOW_TYPE.RAG && (
              <EuiCompressedFormRow
                fullWidth={true}
                label={'LLM response field'}
                isInvalid={false}
                helpText="The name of the field containing the large language model (LLM) response"
              >
                <EuiCompressedFieldText
                  fullWidth={true}
                  value={fieldValues?.llmResponseField || ''}
                  onChange={(e) => {
                    setFieldValues({
                      ...fieldValues,
                      llmResponseField: e.target.value,
                    });
                  }}
                />
              </EuiCompressedFormRow>
            )}
          </EuiAccordion>
        </>
      ) : undefined}
    </>
  );
}
