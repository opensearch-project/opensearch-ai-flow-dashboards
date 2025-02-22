/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Schema, ObjectSchema } from 'yup';
import * as yup from 'yup';
import { getIn } from 'formik';
import {
  WorkflowConfig,
  WorkflowSchema,
  IngestConfig,
  SearchConfig,
  ProcessorsConfig,
  WorkflowSchemaObj,
  IndexConfig,
  IConfigField,
  SearchIndexConfig,
  MAX_DOCS,
  MAX_STRING_LENGTH,
  MAX_JSON_STRING_LENGTH,
  MAX_TEMPLATE_STRING_LENGTH,
  TRANSFORM_TYPE,
  MAX_BYTES,
  INDEX_NAME_REGEXP,
  Index,
} from '../../common';

/*
 **************** Schema / validation utils **********************
 */

export function uiConfigToSchema(
  config: WorkflowConfig,
  indices: { [key: string]: Index }
) {
  const schemaObj = {} as WorkflowSchemaObj;
  schemaObj['ingest'] = ingestConfigToSchema(config.ingest, indices);
  schemaObj['search'] = searchConfigToSchema(config.search);
  return yup.object(schemaObj) as WorkflowSchema;
}

function ingestConfigToSchema(
  ingestConfig: IngestConfig | undefined,
  indices: { [key: string]: Index }
): ObjectSchema<any> {
  const ingestSchemaObj = {} as { [key: string]: Schema };
  if (ingestConfig?.enabled) {
    ingestSchemaObj['docs'] = getFieldSchema({
      type: 'jsonLines',
    } as IConfigField);
    ingestSchemaObj['pipelineName'] = getFieldSchema(ingestConfig.pipelineName);
    ingestSchemaObj['enrich'] = processorsConfigToSchema(ingestConfig.enrich);
    ingestSchemaObj['index'] = indexConfigToSchema(ingestConfig.index, indices);
  }
  return yup.object(ingestSchemaObj);
}

function indexConfigToSchema(
  indexConfig: IndexConfig,
  indices: { [key: string]: Index }
): Schema {
  const indexSchemaObj = {} as { [key: string]: Schema };
  // Do a deeper check on the index name. Ensure the name is of valid format,
  // and that it doesn't name clash with an existing index.
  indexSchemaObj['name'] = yup
    .string()
    .test('name', 'Invalid index name', (name) => {
      return !(
        name === undefined ||
        name === '' ||
        name.length > 100 ||
        INDEX_NAME_REGEXP.test(name) === false
      );
    })
    .test(
      'name',
      'This index name is already in use. Use a different name',
      (name) => {
        return !(
          Object.values(indices || {})
            .map((index) => index.name)
            .includes(name || '') && name !== indexConfig?.name?.value
        );
      }
    )
    .required('Required') as yup.Schema;
  indexSchemaObj['mappings'] = getFieldSchema(indexConfig.mappings);
  indexSchemaObj['settings'] = getFieldSchema(indexConfig.settings);
  return yup.object(indexSchemaObj);
}

function searchConfigToSchema(
  searchConfig: SearchConfig | undefined
): ObjectSchema<any> {
  const searchSchemaObj = {} as { [key: string]: Schema };
  if (searchConfig) {
    searchSchemaObj['request'] = getFieldSchema({
      type: 'json',
    } as IConfigField);
    searchSchemaObj['pipelineName'] = getFieldSchema(searchConfig.pipelineName);
    searchSchemaObj['index'] = searchIndexToSchema(searchConfig.index);
    searchSchemaObj['enrichRequest'] = processorsConfigToSchema(
      searchConfig.enrichRequest
    );
    searchSchemaObj['enrichResponse'] = processorsConfigToSchema(
      searchConfig.enrichResponse
    );
  }
  return yup.object(searchSchemaObj);
}

function searchIndexToSchema(searchIndexConfig: SearchIndexConfig): Schema {
  const searchIndexSchemaObj = {} as { [key: string]: Schema };
  searchIndexSchemaObj['name'] = getFieldSchema(searchIndexConfig.name);
  return yup.object(searchIndexSchemaObj);
}

function processorsConfigToSchema(processorsConfig: ProcessorsConfig): Schema {
  const processorsSchemaObj = {} as { [key: string]: Schema };
  processorsConfig.processors.forEach((processorConfig) => {
    const processorSchemaObj = {} as { [key: string]: Schema };
    processorConfig.fields.forEach((field) => {
      processorSchemaObj[field.id] = getFieldSchema(field);
    });
    processorConfig.optionalFields?.forEach((optionalField) => {
      processorSchemaObj[optionalField.id] = getFieldSchema(
        optionalField,
        true
      );
    });
    processorsSchemaObj[processorConfig.id] = yup.object(processorSchemaObj);
  });

  return yup.object(processorsSchemaObj);
}

/*
 **************** Yup (validation) utils **********************
 */

export function getFieldSchema(
  field: IConfigField,
  optional: boolean = false
): Schema {
  let baseSchema: Schema;
  const defaultStringSchema = yup
    .string()
    .trim()
    .min(1, 'Too short')
    .max(MAX_STRING_LENGTH, 'Too long');

  switch (field.type) {
    case 'string':
    case 'select': {
      baseSchema = defaultStringSchema;
      break;
    }
    case 'model': {
      baseSchema = yup.object().shape({
        id: defaultStringSchema.required(),
      });
      break;
    }
    case 'map': {
      baseSchema = yup.array().of(
        yup.object().shape({
          key: defaultStringSchema.required(),
          value: defaultStringSchema.required(),
        })
      );
      break;
    }
    case 'json': {
      baseSchema = yup.string().test('json', 'Invalid JSON', (value) => {
        try {
          // @ts-ignore
          JSON.parse(value);
          return true;
        } catch (error) {
          return false;
        }
      });

      break;
    }
    case 'jsonArray': {
      baseSchema = yup
        .string()
        .test('jsonArray', 'Invalid JSON array', (value) => {
          try {
            // @ts-ignore
            return Array.isArray(JSON.parse(value));
          } catch (error) {
            return false;
          }
        })
        .test(
          'jsonArray',
          `Array length cannot exceed ${MAX_DOCS}`,
          (value) => {
            try {
              // @ts-ignore
              return JSON.parse(value).length <= MAX_DOCS;
            } catch (error) {
              return false;
            }
          }
        )
        .test(
          'jsonArray',
          `The data size exceeds the limit of ${MAX_BYTES} bytes`,
          (value) => {
            try {
              // @ts-ignore
              return new TextEncoder().encode(value)?.length < MAX_BYTES;
            } catch (error) {
              return false;
            }
          }
        );
      break;
    }
    case 'jsonLines': {
      baseSchema = yup
        .string()
        .test('jsonLines', 'Invalid JSON lines format', (value) => {
          let isValid = true;
          try {
            value?.split('\n').forEach((line: string) => {
              if (line.trim() !== '') {
                try {
                  JSON.parse(line);
                } catch (e) {
                  isValid = false;
                }
              }
            });
          } catch (error) {
            isValid = false;
          }
          return isValid;
        })
        .test(
          'jsonLines',
          `The data size exceeds the limit of ${MAX_BYTES} bytes`,
          (value) => {
            try {
              // @ts-ignore
              return new TextEncoder().encode(value)?.length < MAX_BYTES;
            } catch (error) {
              return false;
            }
          }
        );
      break;
    }
    case 'jsonString': {
      baseSchema = yup
        .string()
        .min(1, 'Too short')
        .max(MAX_JSON_STRING_LENGTH, 'Too long');
      break;
    }
    case 'mapArray': {
      baseSchema = yup.array().of(
        yup.array().of(
          yup.object().shape({
            key: defaultStringSchema.required(),
            value: defaultStringSchema.required(),
          })
        )
      );
      break;
    }
    // an array of an array of transforms.
    // this format comes from the ML inference processor input map.
    case 'inputMapArray': {
      baseSchema = yup.array().of(
        yup.array().of(
          yup.object().shape({
            key: defaultStringSchema.required(),
            value: yup.object().shape({
              transformType: defaultStringSchema.required(),
              value: yup
                .string()
                .when('transformType', (transformType, schema) => {
                  const finalType = getIn(
                    transformType,
                    '0',
                    TRANSFORM_TYPE.FIELD
                  ) as TRANSFORM_TYPE;
                  // accept longer string lengths if the input is a template
                  if (finalType === TRANSFORM_TYPE.TEMPLATE) {
                    return yup
                      .string()
                      .min(1, 'Too short')
                      .max(MAX_TEMPLATE_STRING_LENGTH, 'Too long')
                      .required();
                  } else {
                    return defaultStringSchema.required();
                  }
                }),
              nestedVars: yup.array().of(
                yup.object().shape({
                  name: defaultStringSchema.required(),
                  transform: defaultStringSchema.required(),
                })
              ),
            }),
          })
        )
      );
      break;
    }
    case 'outputMapArray': {
      baseSchema = yup.array().of(
        yup.array().of(
          yup.object().shape({
            key: defaultStringSchema.required(),
            value: yup.object().shape({
              transformType: defaultStringSchema.required(),
              // values are only required based on certain transform types
              value: yup
                .string()
                .when('transformType', (transformType, schema) => {
                  const finalType = getIn(
                    transformType,
                    '0',
                    TRANSFORM_TYPE.FIELD
                  ) as TRANSFORM_TYPE;
                  if (finalType === TRANSFORM_TYPE.FIELD) {
                    return defaultStringSchema.required();
                  } else {
                    return schema.optional();
                  }
                }),
              nestedVars: yup
                .array()
                .when('transformType', (transformType, arraySchema) => {
                  const finalType = getIn(
                    transformType,
                    '0',
                    TRANSFORM_TYPE.FIELD
                  ) as TRANSFORM_TYPE;
                  const finalArraySchema = arraySchema.of(
                    yup.object().shape({
                      name: defaultStringSchema.required(),
                      transform: defaultStringSchema.required(),
                    })
                  );
                  // the expression type must contain a list of final expressions
                  if (finalType === TRANSFORM_TYPE.EXPRESSION) {
                    return finalArraySchema.min(1, 'No transforms defined');
                  } else {
                    return finalArraySchema;
                  }
                }),
            }),
          })
        )
      );
      break;
    }
    case 'boolean': {
      baseSchema = yup.boolean();
      break;
    }
    case 'number': {
      baseSchema = yup.number();
      break;
    }
  }

  return optional ? baseSchema.optional() : baseSchema.required('Required');
}
