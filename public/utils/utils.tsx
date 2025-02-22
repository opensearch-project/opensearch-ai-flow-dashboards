/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import yaml from 'js-yaml';
import jsonpath from 'jsonpath';
import { capitalize, escape, findKey, get, isEmpty, set, unset } from 'lodash';
import { EuiText } from '@elastic/eui';
import semver from 'semver';
import queryString from 'query-string';
import { useLocation } from 'react-router-dom';
import {
  JSONPATH_ROOT_SELECTOR,
  MODEL_OUTPUT_SCHEMA_FULL_PATH,
  MODEL_OUTPUT_SCHEMA_NESTED_PATH,
  ModelInputFormField,
  ModelInterface,
  ModelOutput,
  ModelOutputFormField,
  PROCESSOR_CONTEXT,
  REQUEST_PREFIX,
  REQUEST_PREFIX_WITH_JSONPATH_ROOT_SELECTOR,
  SimulateIngestPipelineDoc,
  SimulateIngestPipelineResponse,
  TRANSFORM_CONTEXT,
  WORKFLOW_RESOURCE_TYPE,
  WORKFLOW_STEP_TYPE,
  Workflow,
  WorkflowResource,
  BEDROCK_CONFIGS,
  COHERE_CONFIGS,
  OPENAI_CONFIGS,
  customStringify,
  NO_TRANSFORMATION,
  TRANSFORM_TYPE,
  VECTOR_FIELD_PATTERN,
  VECTOR_PATTERN,
  TEXT_FIELD_PATTERN,
  IMAGE_FIELD_PATTERN,
  LABEL_FIELD_PATTERN,
  MODEL_ID_PATTERN,
  WORKFLOW_TYPE,
  MIN_SUPPORTED_VERSION,
} from '../../common';
import {
  getCore,
  getDataSourceEnabled,
  getRouteService,
  getSavedObjectsClient,
} from '../services';
import {
  Connector,
  IngestPipelineErrors,
  InputMapEntry,
  MapFormValue,
  MDSQueryParams,
  ModelInputMap,
  ModelOutputMap,
  OutputMapEntry,
  OutputMapFormValue,
  QueryParam,
  SearchPipelineErrors,
  SearchResponseVerbose,
  SimulateIngestPipelineResponseVerbose,
} from '../../common/interfaces';
import * as pluginManifest from '../../opensearch_dashboards.json';
import { DataSourceAttributes } from '../../../../src/plugins/data_source/common/data_sources';
import { SavedObject } from '../../../../src/core/public';

// Generate a random ID. Optionally add a prefix. Optionally
// override the default # characters to generate.
export function generateId(prefix?: string, numChars: number = 16): string {
  const uniqueChar = () => {
    // eslint-disable-next-line no-bitwise
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
  };
  const uniqueId = `${uniqueChar()}${uniqueChar()}${uniqueChar()}${uniqueChar()}`;
  return `${prefix || ''}_${uniqueId.substring(0, numChars)}`;
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasProvisionedIngestResources(
  workflow: Workflow | undefined
): boolean {
  let result = false;
  workflow?.resourcesCreated?.some((resource) => {
    if (
      resource.stepType ===
        WORKFLOW_STEP_TYPE.CREATE_INGEST_PIPELINE_STEP_TYPE ||
      resource.stepType === WORKFLOW_STEP_TYPE.CREATE_INDEX_STEP_TYPE
    ) {
      result = true;
    }
  });
  return result;
}

export function hasProvisionedSearchResources(
  workflow: Workflow | undefined
): boolean {
  let result = false;
  workflow?.resourcesCreated?.some((resource) => {
    if (
      resource.stepType === WORKFLOW_STEP_TYPE.CREATE_SEARCH_PIPELINE_STEP_TYPE
    ) {
      result = true;
    }
  });
  return result;
}

// returns a comma-delimited string of all resource IDs that need to be force deleted.
// see https://github.com/opensearch-project/flow-framework/pull/763
export function getResourcesToBeForceDeleted(
  workflow: Workflow | undefined
): string | undefined {
  const resources = workflow?.resourcesCreated?.filter(
    (workflowResource) =>
      workflowResource.type === WORKFLOW_RESOURCE_TYPE.INDEX_NAME ||
      workflowResource.type === WORKFLOW_RESOURCE_TYPE.PIPELINE_ID
  );

  if (resources !== undefined && resources.length > 0) {
    return resources
      .map((resource) => resource.id)
      .map(String)
      .join(',');
  } else {
    return undefined;
  }
}

export function getObjFromJsonOrYamlString(
  fileContents?: string
): object | undefined {
  try {
    // @ts-ignore
    const jsonObj = JSON.parse(fileContents);
    return jsonObj;
  } catch (e) {}
  try {
    // @ts-ignore
    const yamlObj = yaml.load(fileContents) as object;
    return yamlObj;
  } catch (e) {}
  return undefined;
}

// Based off of https://opensearch.org/docs/latest/automating-configurations/api/create-workflow/#request-fields
// Only "name" field is required
export function isValidWorkflow(workflowObj: any): boolean {
  return workflowObj?.name !== undefined;
}

export function isValidUiWorkflow(workflowObj: any): boolean {
  return (
    isValidWorkflow(workflowObj) &&
    workflowObj?.ui_metadata?.config !== undefined &&
    workflowObj?.ui_metadata?.type !== undefined &&
    Object.values(WORKFLOW_TYPE).includes(workflowObj?.ui_metadata?.type)
  );
}

// Docs are expected to be in a certain format to be passed to the simulate ingest pipeline API.
// for details, see https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest
export function prepareDocsForSimulate(
  docs: string,
  indexName: string
): SimulateIngestPipelineDoc[] {
  const preparedDocs = [] as SimulateIngestPipelineDoc[];
  let docObjs = [] as {}[];
  try {
    const lines = docs?.split('\n') as string[];
    lines.forEach((line) => docObjs.push(JSON.parse(line)));
  } catch {}
  docObjs?.forEach((doc) => {
    preparedDocs.push({
      _index: indexName,
      _id: generateId(),
      _source: doc,
    });
  });
  return preparedDocs;
}

// Docs are returned in a certain format from the simulate ingest pipeline API. We want
// to format them into a more readable string to display
export function unwrapTransformedDocs(
  simulatePipelineResponse: SimulateIngestPipelineResponse
): any[] {
  let errorDuringSimulate = undefined as string | undefined;
  const transformedDocsSources = simulatePipelineResponse.docs.map(
    (transformedDoc) => {
      if (transformedDoc.error !== undefined) {
        errorDuringSimulate = transformedDoc.error.reason || '';
      } else {
        return transformedDoc.doc._source;
      }
    }
  );

  // there is an edge case where simulate may fail if there is some server-side or OpenSearch issue when
  // running ingest (e.g., hitting rate limits on remote model)
  // We pull out any returned error from a document and propagate it to the user.
  if (errorDuringSimulate !== undefined) {
    getCore().notifications.toasts.addDanger(
      `Failed to simulate ingest on all documents: ${errorDuringSimulate}`
    );
  }
  return transformedDocsSources;
}

// Extract any processor-level errors from a verbose simulate ingest pipeline API call
export function getIngestPipelineErrors(
  simulatePipelineResponse: SimulateIngestPipelineResponseVerbose
): IngestPipelineErrors {
  let ingestPipelineErrors = {} as IngestPipelineErrors;
  simulatePipelineResponse.docs?.forEach((docResult) => {
    docResult.processor_results.forEach((processorResult, idx) => {
      if (processorResult.error?.reason !== undefined) {
        ingestPipelineErrors[idx] = {
          processorType: processorResult.processor_type,
          errorMsg: processorResult.error.reason,
        };
      }
    });
  });
  return ingestPipelineErrors;
}

// Extract any processor-level errors from a verbose search API call
export function getSearchPipelineErrors(
  searchResponseVerbose: SearchResponseVerbose
): SearchPipelineErrors {
  let searchPipelineErrors = {} as SearchPipelineErrors;
  searchResponseVerbose.processor_results?.forEach((processorResult, idx) => {
    if (processorResult?.error !== undefined) {
      searchPipelineErrors[idx] = {
        processorType: processorResult.processor_name,
        errorMsg: processorResult.error,
      };
    }
  });
  return searchPipelineErrors;
}

// Generate a more UI-friendly layout of a processor error
export function formatProcessorError(processorError: {
  processorType: string;
  errorMsg: string;
}): ReactNode {
  return (
    <>
      <EuiText size="s">
        {`Processor type:`} <b>{capitalize(processorError.processorType)}</b>
      </EuiText>
      <EuiText size="s">
        {`Error:`} <b>{processorError.errorMsg}</b>
      </EuiText>
    </>
  );
}

// ML inference processors will use standard dot notation or JSONPath depending on the input.
// We follow the same logic here to generate consistent results.
export function generateTransform(
  input: {} | [],
  map: (InputMapEntry | OutputMapEntry)[],
  context: PROCESSOR_CONTEXT,
  transformContext: TRANSFORM_CONTEXT,
  queryContext?: {}
): {} {
  let output = {};
  map.forEach((mapEntry) => {
    try {
      const transformedResult = getTransformedResult(
        input,
        mapEntry.value.value || '',
        context,
        transformContext,
        queryContext
      );
      output = {
        ...output,
        [mapEntry.key]: transformedResult || '',
      };
    } catch (e: any) {}
  });
  return output;
}

// Similar to generateTransform, but collapse the values of the input array into
// a single field value in the transformed output.
// A specialty scenario for when configuring input on search response processors, one-to-one is false,
// and the input is an array.
export function generateArrayTransform(
  input: [],
  map: (InputMapEntry | OutputMapEntry)[],
  context: PROCESSOR_CONTEXT,
  transformContext: TRANSFORM_CONTEXT,
  queryContext?: {}
): {}[] {
  let output = [] as {}[];
  map.forEach((mapEntry) => {
    try {
      // If users define a path using the special query request
      // prefix, parse the query context, instead of the other input.
      let transformedResult;
      if (
        (mapEntry.value.value?.startsWith(REQUEST_PREFIX) ||
          mapEntry.value.value?.startsWith(
            REQUEST_PREFIX_WITH_JSONPATH_ROOT_SELECTOR
          )) &&
        queryContext !== undefined &&
        !isEmpty(queryContext)
      ) {
        transformedResult = getTransformedResult(
          {},
          mapEntry.value.value,
          context,
          transformContext,
          queryContext
        );
      } else {
        transformedResult = input.map((inputEntry) =>
          getTransformedResult(
            inputEntry,
            mapEntry.value.value || '',
            context,
            transformContext,
            queryContext
          )
        );
      }
      output = {
        ...output,
        [mapEntry.key]: transformedResult || '',
      };
    } catch (e: any) {}
  });
  return output;
}

function getTransformedResult(
  input: {},
  path: string,
  context: PROCESSOR_CONTEXT,
  transformContext: TRANSFORM_CONTEXT,
  queryContext?: {}
): any {
  // Regular dot notation can only be executed if 1/ the JSONPath selector is not explicitly defined,
  // and 2/ it is in the context of ingest, and 3/ it is transforming the input (the source document).
  // For all other scenarios, it can only be JSONPath, due to backend parsing limitations.
  if (
    !path.startsWith(JSONPATH_ROOT_SELECTOR) &&
    context === PROCESSOR_CONTEXT.INGEST &&
    transformContext === TRANSFORM_CONTEXT.INPUT
  ) {
    // sub-edge case: if the path is ".", it implies returning
    // the entire value. This may happen if full_response_path=false
    // and the input is the entire result with nothing else to parse out.
    // get() does not cover this case, so we override manually.
    if (path === '.') {
      return input;
    } else {
      return get(input, path);
    }
    // If users define a path using the special query request
    // prefix, parse the query context, instead of the other input.
  } else if (
    (path.startsWith(REQUEST_PREFIX) ||
      path.startsWith(REQUEST_PREFIX_WITH_JSONPATH_ROOT_SELECTOR)) &&
    queryContext !== undefined &&
    !isEmpty(queryContext)
  ) {
    const updatedPath = path.startsWith(REQUEST_PREFIX)
      ? path.replace(REQUEST_PREFIX, '')
      : path.replace(REQUEST_PREFIX_WITH_JSONPATH_ROOT_SELECTOR, '');
    return executeJsonPath(queryContext, updatedPath);
  } else {
    return executeJsonPath(input, path);
  }
}

// The backend sets a JSONPath setting ALWAYS_RETURN_LIST=false, which
// dynamically returns a list or single value, based on whether
// the path is definite or not. We try to mimic that with a
// custom fn isIndefiniteJsonPath(), since this setting, nor
// knowing if the path is definite or indefinite, is not exposed
// by any known jsonpath JS-based / NPM libraries.
// if found to be definite, we remove the outermost array, which
// will always be returned by default when running query().
function executeJsonPath(input: {}, path: string): any[] {
  const isIndefinite = isIndefiniteJsonPath(path);
  const res = jsonpath.query(input, path);
  if (isIndefinite) {
    return res;
  } else {
    return res[0];
  }
}

// Indefinite/definite path defns:
// https://github.com/json-path/JsonPath?tab=readme-ov-file#what-is-returned-when
// Note this may not cover every use case, as the true definition requires low-level
// branch navigation of the path nodes, which is not exposed by this npm library.
// Hence, we do our best to cover the majority of use cases and common patterns.
function isIndefiniteJsonPath(path: string): boolean {
  // regex has 3 overall OR checks:
  // 1. consecutive '.'s, indicating deep scan - \.{2}
  // 2. ?(<anything>), indicating an expression - \?\(.*\)
  // 3. multiple array indices - \[\d+,\d+\] | \[.*:.*\] | \[\*\]
  // if any are met, then we call the path indefinite.
  const indefiniteRegEx = new RegExp(
    /\.{2}|\?\(.*\)|\[\d+,\d+\]|\[.*:.*\]|\[\*\]/,
    'g'
  );
  return indefiniteRegEx.test(path);
}

// Derive the collection of model inputs from the model interface JSONSchema into a form-ready list
export function parseModelInputs(
  modelInterface: ModelInterface | undefined
): ModelInputFormField[] {
  const modelInputsObj = parseModelInputsObj(modelInterface);
  return Object.keys(modelInputsObj).map(
    (inputName: string) =>
      ({
        label: inputName,
        ...modelInputsObj[inputName],
      } as ModelInputFormField)
  );
}

// Derive the collection of model inputs as an obj
export function parseModelInputsObj(
  modelInterface: ModelInterface | undefined
): ModelInputMap {
  return get(
    modelInterface,
    // model interface input values will always be nested under a base "parameters" obj.
    // we iterate through the obj properties to extract the individual inputs
    'input.properties.parameters.properties',
    {}
  ) as ModelInputMap;
}

// Derive the collection of model outputs from the model interface JSONSchema into a form-ready list.
// Expose the full path or nested path depending on fullResponsePath
export function parseModelOutputs(
  modelInterface: ModelInterface | undefined,
  fullResponsePath: boolean = false
): ModelOutputFormField[] {
  const modelOutputsObj = get(
    modelInterface,
    fullResponsePath
      ? MODEL_OUTPUT_SCHEMA_FULL_PATH
      : MODEL_OUTPUT_SCHEMA_NESTED_PATH,
    {}
  ) as {
    [key: string]: ModelOutput;
  };
  return Object.keys(modelOutputsObj).map(
    (outputName: string) =>
      ({
        label: outputName,
        ...modelOutputsObj[outputName],
      } as ModelOutputFormField)
  );
}

// Derive the collection of model outputs as an obj.
// Expose the full path or nested path depending on fullResponsePath
export function parseModelOutputsObj(
  modelInterface: ModelInterface | undefined,
  fullResponsePath: boolean = false
): ModelOutputMap {
  return get(
    modelInterface,
    fullResponsePath
      ? MODEL_OUTPUT_SCHEMA_FULL_PATH
      : MODEL_OUTPUT_SCHEMA_NESTED_PATH,
    {}
  ) as ModelOutputMap;
}
export const getDataSourceFromURL = (location: {
  search: string;
}): MDSQueryParams => {
  const queryParams = queryString.parse(location.search);
  const dataSourceId = queryParams.dataSourceId;
  return {
    dataSourceId:
      typeof dataSourceId === 'string' ? escape(dataSourceId) : undefined,
  };
};

export const constructHrefWithDataSourceId = (
  basePath: string,
  dataSourceId: string = ''
): string => {
  const dataSourceEnabled = getDataSourceEnabled().enabled;
  const url = new URLSearchParams();
  if (dataSourceEnabled && dataSourceId !== undefined) {
    url.set('dataSourceId', dataSourceId);
  }
  return `#${basePath}?${url.toString()}`;
};

export const constructUrlWithParams = (
  basePath: string,
  workflowId?: string,
  dataSourceId?: string
): string => {
  const path = workflowId ? `${basePath}/${workflowId}` : basePath;
  return `${path}${
    dataSourceId !== undefined ? `?dataSourceId=${dataSourceId}` : ''
  }`;
};

export const getDataSourceId = () => {
  const location = useLocation();
  const mdsQueryParams = getDataSourceFromURL(location);
  return mdsQueryParams.dataSourceId;
};

export const isDataSourceReady = (dataSourceId?: string) => {
  const dataSourceEnabled = getDataSourceEnabled().enabled;
  return !dataSourceEnabled || (dataSourceId && dataSourceId !== '');
};

// converts camelCase to a space-delimited string with the first word capitalized.
// useful for converting config IDs (in snake_case) to a formatted form title
export function camelCaseToTitleString(snakeCaseString: string): string {
  return snakeCaseString
    .split('_')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const dataSourceFilterFn = (
  dataSource: SavedObject<DataSourceAttributes>
) => {
  const dataSourceVersion = dataSource?.attributes?.dataSourceVersion || '';
  const installedPlugins = dataSource?.attributes?.installedPlugins || [];
  return (
    semver.satisfies(
      dataSourceVersion,
      pluginManifest.supportedOSDataSourceVersions
    ) &&
    pluginManifest.requiredOSDataSourcePlugins.every((plugin) =>
      installedPlugins.includes(plugin)
    )
  );
};

export const extractIdsByStepType = (resources: WorkflowResource[]) => {
  const ids = resources.reduce(
    (
      acc: {
        indexIds: string[];
        ingestPipelineIds: string[];
        searchPipelineIds: string[];
      },
      item: WorkflowResource
    ) => {
      switch (item.stepType) {
        case WORKFLOW_STEP_TYPE.CREATE_INDEX_STEP_TYPE:
          acc.indexIds.push(item.id);
          break;
        case WORKFLOW_STEP_TYPE.CREATE_INGEST_PIPELINE_STEP_TYPE:
          acc.ingestPipelineIds.push(item.id);
          break;
        case WORKFLOW_STEP_TYPE.CREATE_SEARCH_PIPELINE_STEP_TYPE:
          acc.searchPipelineIds.push(item.id);
          break;
      }
      return acc;
    },
    { indexIds: [], ingestPipelineIds: [], searchPipelineIds: [] }
  );

  return {
    indexIds: ids.indexIds.join(','),
    ingestPipelineIds: ids.ingestPipelineIds.join(','),
    searchPipelineIds: ids.searchPipelineIds.join(','),
  };
};

export const getErrorMessageForStepType = (
  stepType: WORKFLOW_STEP_TYPE,
  getIndexErrorMessage: string,
  getIngestPipelineErrorMessage: string,
  getSearchPipelineErrorMessage: string
) => {
  switch (stepType) {
    case WORKFLOW_STEP_TYPE.CREATE_INDEX_STEP_TYPE:
      return getIndexErrorMessage;

    case WORKFLOW_STEP_TYPE.CREATE_INGEST_PIPELINE_STEP_TYPE:
      return getIngestPipelineErrorMessage;

    case WORKFLOW_STEP_TYPE.CREATE_SEARCH_PIPELINE_STEP_TYPE:
      return getSearchPipelineErrorMessage;

    default:
      return '';
  }
};

// Sanitize the nested keys in a given JSONPath definition.
// to ensure it works consistently on the frontend & backend. There are several discrepancies
// between the frontend and the backend packages, such that some
// scenarios will succeed on the frontend and fail on the backend,
// or vice versa.
export function sanitizeJSONPath(path: string): string {
  return path?.split('.').reduce((prevValue, curValue, idx) => {
    // Case 1: accessing array via dot notation. Fails on the backend.
    if (!isNaN(parseInt(curValue))) {
      return prevValue + `[${curValue}]`;
      // Case 2: accessing key with a dash via dot notation. Fails on the frontend.
    } else if (curValue.includes('-')) {
      return prevValue + `["${curValue}"]`;
    } else {
      return prevValue + '.' + curValue;
    }
  });
}

// given a stringified query, extract out all unique placeholder vars
// that follow the pattern {{some-placeholder}}
export function getPlaceholdersFromQuery(queryString: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  return [
    // convert to set to collapse duplicate names
    ...new Set([...queryString.matchAll(regex)].map((match) => match[1])),
  ];
}

// simple fn to check if the values in an arr are the same. used for
// checking if the same set of placeholders exists when a new query is selected,
// or an existing query is updated.
export function containsSameValues(arr1: string[], arr2: string[]) {
  if (arr1.length !== arr2.length) {
    return false;
  }
  arr1.sort();
  arr2.sort();
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}

// simple util fn to check for empty/missing query param values
export function containsEmptyValues(params: QueryParam[]): boolean {
  let containsEmpty = false;
  params.forEach((param) => {
    if (isEmpty(param.value)) {
      containsEmpty = true;
    }
  });
  return containsEmpty;
}

// simple util fn to inject parameters in the base query string with its associated value
export function injectParameters(
  params: QueryParam[],
  queryString: string
): string {
  let finalQueryString = queryString;
  params.forEach((param) => {
    finalQueryString = finalQueryString.replace(
      new RegExp(`{{${param.name}}}`, 'g'),
      param.value
    );
  });
  return finalQueryString;
}

// Fetch embedding dimensions, if the selected model is a known one
export function getEmbeddingModelDimensions(
  connector: Connector
): number | undefined {
  // some APIs allow specifically setting the dimensions at runtime,
  // so we check for that first.
  if (connector?.parameters?.dimensions !== undefined) {
    return connector.parameters?.dimensions;
  } else if (connector?.parameters?.model !== undefined) {
    return (
      // @ts-ignore
      COHERE_CONFIGS[connector.parameters?.model]?.dimension ||
      // @ts-ignore
      OPENAI_CONFIGS[connector.parameters?.model]?.dimension ||
      // @ts-ignore
      BEDROCK_CONFIGS[connector.parameters?.model]?.dimension
    );
  } else {
    return undefined;
  }
}

// Check if an index is a knn index
export function isKnnIndex(existingSettings: string): boolean {
  try {
    return get(JSON.parse(existingSettings), 'index.knn', false);
  } catch (error) {
    console.error('Could not parse index settings: ', error);
    return false;
  }
}

// Update the index settings based on parameters passed.
// Currently just used for updating the `knn` flag.
export function getUpdatedIndexSettings(
  existingSettings: string,
  knnBool: boolean
): string {
  try {
    return customStringify(
      set(JSON.parse(existingSettings), 'index.knn', knnBool)
    );
  } catch {
    return existingSettings;
  }
}

// Get any embedding fields, if a known embedding model
function getEmbeddingFieldFromConnector(
  connector: Connector
): string | undefined {
  if (connector?.parameters?.model !== undefined) {
    return (
      // @ts-ignore
      COHERE_CONFIGS[connector?.parameters?.model]?.fieldName ||
      // @ts-ignore
      OPENAI_CONFIGS[connector?.parameters?.model]?.fieldName ||
      // @ts-ignore
      BEDROCK_CONFIGS[connector?.parameters?.model]?.fieldName
    );
  } else {
    return undefined;
  }
}

// Try to determine the embedding field based on the processor config.
// First check if it is a known model, then make a best guess based on
// the output map configuration, if there is any transformations made
export function getEmbeddingField(
  connector: Connector,
  processorConfig: any
): string | undefined {
  let embeddingField = getEmbeddingFieldFromConnector(connector);
  const outputMap = processorConfig?.output_map as OutputMapFormValue;
  // legacy text_embedding / text_image_embedding processors store vector fields
  // in different configs
  const fieldMap = processorConfig?.field_map as MapFormValue; // text embedding processor
  const embedding = processorConfig?.embedding; // text/image embedding processor
  if (
    outputMap !== undefined &&
    outputMap[0] !== undefined &&
    Array.isArray(outputMap[0]) &&
    outputMap[0].length > 0
  ) {
    const relevantOutputMapEntry =
      embeddingField !== undefined
        ? outputMap[0].find(
            (outputMapEntry) => outputMapEntry.key === embeddingField
          )
        : outputMap[0][0];
    switch (relevantOutputMapEntry?.value?.transformType) {
      case TRANSFORM_TYPE.FIELD: {
        embeddingField = relevantOutputMapEntry?.value?.value;
        break;
      }
      case TRANSFORM_TYPE.EXPRESSION: {
        embeddingField = get(relevantOutputMapEntry, 'value.nestedVars.0.name');
        break;
      }
      case NO_TRANSFORMATION:
      case undefined:
      default: {
        embeddingField = relevantOutputMapEntry?.key;
        break;
      }
    }
  } else if (embedding !== undefined) {
    embeddingField = embedding;
  } else if (fieldMap !== undefined) {
    embeddingField = get(fieldMap, '0.value', embeddingField);
  }
  return embeddingField;
}

// Update the index mappings based on parameters passed.
// Currently used for updating the knn_vector field configuration, & removing
// any old/existing knn_vector field in the process.
export function getUpdatedIndexMappings(
  existingMappings: string,
  embeddingFieldName: string,
  dimension: number
): string {
  try {
    const mappingsWithRemovedVectorField = removeVectorFieldFromIndexMappings(
      existingMappings
    );
    return customStringify(
      set(
        JSON.parse(mappingsWithRemovedVectorField),
        `properties.${embeddingFieldName}`,
        {
          type: 'knn_vector',
          dimension,
        }
      )
    );
  } catch {
    return existingMappings;
  }
}

export function removeVectorFieldFromIndexMappings(
  existingMappings: string
): string {
  try {
    let existingMappingsObj = JSON.parse(existingMappings);
    const existingEmbeddingField = findKey(
      existingMappingsObj?.properties,
      (field) => field.type === 'knn_vector'
    );
    if (existingEmbeddingField !== undefined) {
      unset(existingMappingsObj?.properties, existingEmbeddingField);
    }
    return customStringify(existingMappingsObj);
  } catch {
    return existingMappings;
  }
}

// Parse out any hidden errors within a 2xx ingest response
export function parseErrorsFromIngestResponse(
  ingestResponse: any
): string | undefined {
  if (get(ingestResponse, 'errors', false)) {
    return get(
      ingestResponse,
      'items.0.index.error.reason',
      'Error ingesting documents'
    );
  }
  return;
}

// Update the target query string placeholders into valid placeholder format. Used to disambiguate
// placeholders (${text_field}) vs. dynamic parameters (e.g., "{{query_text}}")
export function injectPlaceholdersInQueryString(query: string): string {
  return query
    .replace(new RegExp(`"${VECTOR_FIELD_PATTERN}"`, 'g'), `\$\{vector_field\}`)
    .replace(new RegExp(`"${VECTOR_PATTERN}"`, 'g'), `\$\{vector\}`)
    .replace(new RegExp(`"${TEXT_FIELD_PATTERN}"`, 'g'), `\$\{text_field\}`)
    .replace(new RegExp(`"${IMAGE_FIELD_PATTERN}"`, 'g'), `\$\{image_field\}`)
    .replace(new RegExp(`"${LABEL_FIELD_PATTERN}"`, 'g'), `\$\{label_field\}`)
    .replace(new RegExp(`"${MODEL_ID_PATTERN}"`, 'g'), `\$\{model_id\}`);
}

// Utility fn to parse out a JSON obj and find some value for a given field.
// Primarily used to traverse index mappings and check that values are valid.
export function getFieldValue(jsonObj: {}, fieldName: string): any | undefined {
  if (typeof jsonObj !== 'object' || jsonObj === undefined) return undefined;
  if (fieldName in jsonObj) {
    return get(jsonObj, fieldName) as any;
  }
  for (const key in jsonObj) {
    const result = getFieldValue(get(jsonObj, key), fieldName);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}

// Get the version from the selected data source
export const getEffectiveVersion = async (
  dataSourceId: string | undefined
): Promise<string> => {
  try {
    if (dataSourceId === undefined) {
      throw new Error('Data source is required');
    }

    if (dataSourceId === '') {
      // Use route service for local cluster case
      return await getRouteService().getLocalClusterVersion();
    }

    const dataSource = await getSavedObjectsClient().get<DataSourceAttributes>(
      'data-source',
      dataSourceId
    );
    const version =
      dataSource?.attributes?.dataSourceVersion || MIN_SUPPORTED_VERSION;
    return version;
  } catch (error) {
    console.error('Error getting version:', error);
    return MIN_SUPPORTED_VERSION;
  }
};
