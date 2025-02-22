/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Node, Edge } from 'reactflow';
import { FormikValues } from 'formik';
import { ObjectSchema } from 'yup';
import {
  COMPONENT_CLASS,
  PROCESSOR_TYPE,
  TRANSFORM_TYPE,
  WORKFLOW_TYPE,
} from './constants';

export type Index = {
  name: string;
  health: 'green' | 'yellow' | 'red';
};

/**
 ********** WORKFLOW TYPES/INTERFACES **********
 */
export type MDSQueryParams = {
  dataSourceId?: string;
};

export type ConfigFieldType =
  | 'string'
  | 'json'
  | 'jsonArray'
  | 'jsonString'
  | 'jsonLines'
  | 'select'
  | 'model'
  | 'map'
  | 'mapArray'
  | 'boolean'
  | 'number'
  | 'inputMapArray'
  | 'outputMapArray';

export type ConfigFieldValue = string | {};

export interface IConfigField {
  type: ConfigFieldType;
  id: string;
  value?: ConfigFieldValue;
  selectOptions?: ConfigFieldValue[];
}

export interface IConfig {
  id: string;
  name: string;
  fields: IConfigField[];
  optionalFields?: IConfigField[];
}

export interface IProcessorConfig extends IConfig {
  type: PROCESSOR_TYPE;
}

export type ProcessorsConfig = {
  processors: IProcessorConfig[];
};

export type IndexConfig = {
  name: IConfigField;
  mappings: IConfigField;
  settings: IConfigField;
};

export type SearchIndexConfig = {
  name: IConfigField;
};

export type IngestConfig = {
  enabled: IConfigField;
  pipelineName: IConfigField;
  enrich: ProcessorsConfig;
  index: IndexConfig;
};

export type SearchConfig = {
  request: IConfigField;
  index: SearchIndexConfig;
  pipelineName: IConfigField;
  enrichRequest: ProcessorsConfig;
  enrichResponse: ProcessorsConfig;
};

export type WorkflowConfig = {
  ingest: IngestConfig;
  search: SearchConfig;
};

export type MapEntry = {
  key: string;
  value: string;
};

export type MapFormValue = MapEntry[];

export type MapArrayFormValue = MapFormValue[];

export type ExpressionVar = {
  name: string;
  transform: string;
};

export type Transform = {
  transformType: TRANSFORM_TYPE;
  value?: string;
  // Templates may persist their own set of nested transforms
  // to be dynamically injected into the template
  nestedVars?: ExpressionVar[];
};

export type InputMapEntry = {
  key: string;
  value: Transform;
};
export type OutputMapEntry = InputMapEntry;

export type InputMapFormValue = InputMapEntry[];
export type OutputMapFormValue = OutputMapEntry[];

export type InputMapArrayFormValue = InputMapFormValue[];
export type OutputMapArrayFormValue = OutputMapFormValue[];

export type WorkflowFormValues = {
  ingest: FormikValues;
  search: FormikValues;
};

export type WorkflowSchemaObj = {
  [key: string]: ObjectSchema<any, any, any>;
};
export type WorkflowSchema = ObjectSchema<WorkflowSchemaObj>;

/**
 ********** MODAL SUB-FORM TYPES/INTERFACES **********
 We persist sub-forms in the form modals s.t. data is only
 saved back to the parent form if the user explicitly saves.

 We define the structure of the forms here.
 */

// Ingest docs modal
export type IngestDocsFormValues = {
  docs: FormikValues;
};

// Search request modal
export type RequestFormValues = {
  request: ConfigFieldValue;
};

// Configure template modal
export type TemplateFormValues = Omit<Transform, 'transformType'>;

// Configure expression modal
export type ExpressionFormValues = {
  expression: string;
};

// Configure multi-expression modal
export type MultiExpressionFormValues = {
  expressions: ExpressionVar[];
};

/**
 ********** WORKSPACE TYPES/INTERFACES **********
 */

export type FieldType = 'string' | 'json' | 'select' | 'model';
export type FieldValue = string | {};
export type ComponentFormValues = FormikValues;
export type WorkspaceFormValues = {
  [componentId: string]: ComponentFormValues;
};
export type WorkspaceSchemaObj = {
  [componentId: string]: ObjectSchema<any, any, any>;
};
export type WorkspaceSchema = ObjectSchema<WorkspaceSchemaObj>;

export interface IComponentInput {
  id: string;
  label: string;
  acceptMultiple: boolean;
}

export interface IComponentOutput {
  id: string;
  label: string;
}

/**
 * An input field for a component. Specifies enough configuration for the
 * UI node to render it properly (help text, links, etc.)
 */
export interface IComponentField {
  label: string;
  type: FieldType;
  id: string;
  value?: FieldValue;
  placeholder?: string;
  helpText?: string;
  helpLink?: string;
}

/**
 * The base interface the components will implement.
 */
export interface IComponent {
  type: COMPONENT_CLASS;
  label: string;
  iconType?: string;
  description?: string;
  inputs?: IComponentInput[];
  outputs?: IComponentOutput[];
}

/**
 * We need to include some extra instance-specific data to the ReactFlow component
 * to perform extra functionality, such as deleting the node from the ReactFlowInstance.
 */
export interface IComponentData extends IComponent {
  id: string;
  selected?: boolean;
}

export type ReactFlowComponent = Node<IComponentData>;
export type ReactFlowEdge = Edge<{}> & {
  key: string;
  sourceClasses: COMPONENT_CLASS[];
  targetClasses: COMPONENT_CLASS[];
};

type ReactFlowViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type UIState = {
  schema_version: number;
  config: WorkflowConfig;
  type: WORKFLOW_TYPE;
  // Will be used in future when changing from form-based to flow-based configs via drag-and-drop
  workspace_flow?: WorkspaceFlowState;
};

export type WorkspaceFlowState = {
  nodes: ReactFlowComponent[];
  edges: ReactFlowEdge[];
  viewport?: ReactFlowViewport;
};

/**
 ********** USE CASE TEMPLATE TYPES/INTERFACES **********
 */

export type IngestProcessor = {};
export type SearchProcessor = {};
export type SearchRequestProcessor = SearchProcessor & {};
export type SearchResponseProcessor = SearchProcessor & {};
export type SearchPhaseResultsProcessor = SearchProcessor & {};

export type IngestPipelineConfig = {
  description?: string;
  processors: IngestProcessor[];
};

export type SearchPipelineConfig = {
  description?: string;
  request_processors?: SearchRequestProcessor[];
  response_processors?: SearchResponseProcessor[];
  phase_results_processors?: SearchPhaseResultsProcessor[];
};

export type MLInferenceProcessor = IngestProcessor & {
  ml_inference: {
    model_id: string;
    input_map?: {}[];
    output_map?: {}[];
    [key: string]: any;
  };
};

export type NormalizationProcessor = SearchProcessor & {
  normalization: {
    technique: string;
  };
  combination: {
    technique: string;
    parameters: {
      weights: number[];
    };
  };
};

export type IndexConfiguration = {
  settings: { [key: string]: any };
  mappings: IndexMappings;
};

export type IndexMappings = {
  properties: { [key: string]: any };
};

export type TemplateNode = {
  id: string;
  type: string;
  previous_node_inputs?: {};
  user_inputs?: {};
};

export type CreateIngestPipelineNode = TemplateNode & {
  user_inputs: {
    pipeline_id: string;
    model_id?: string;
    input_field?: string;
    output_field?: string;
    configurations: string;
  };
};

export type CreateSearchPipelineNode = TemplateNode & {
  user_inputs: {
    pipeline_id: string;
    configurations: string;
  };
};

export type CreateIndexNode = TemplateNode & {
  previous_node_inputs?: {
    [ingest_pipeline_step_id: string]: string;
  };
  user_inputs: {
    index_name: string;
    configurations: string;
  };
};

export type TemplateEdge = {
  source: string;
  dest: string;
};

export type TemplateFlow = {
  nodes: TemplateNode[];
  edges?: TemplateEdge[];
  user_params?: {};
};

export type TemplateFlows = {
  provision: TemplateFlow;
};

// A stateless template of a workflow
export type WorkflowTemplate = {
  // Name is the only required field: see https://opensearch.org/docs/latest/automating-configurations/api/create-workflow/#request-fields
  name: string;
  description?: string;
  // TODO: finalize on version type when that is implemented
  // https://github.com/opensearch-project/flow-framework/issues/526
  version?: any;
  workflows?: TemplateFlows;
  use_case?: string;
  // UI state and any ReactFlow state may not exist if a workflow is created via API/backend-only.
  ui_metadata?: UIState;
};

// An instance of a workflow based on a workflow template
export type Workflow = WorkflowTemplate & {
  // won't exist until created in backend
  id?: string;
  // won't exist until created in backend
  lastUpdated?: number;
  // won't exist until launched/provisioned in backend
  lastLaunched?: number;
  // won't exist until launched/provisioned in backend
  state?: WORKFLOW_STATE;
  // won't exist until launched/provisioned in backend
  error?: string;
  // won't exist until launched/provisioned in backend
  resourcesCreated?: WorkflowResource[];
};

/**
 ********** ML PLUGIN TYPES/INTERFACES **********
 */

// Based off of https://github.com/opensearch-project/ml-commons/blob/main/common/src/main/java/org/opensearch/ml/common/model/MLModelState.java
export enum MODEL_STATE {
  REGISTERED = 'Registered',
  REGISTERING = 'Registering',
  DEPLOYING = 'Deploying',
  DEPLOYED = 'Deployed',
  PARTIALLY_DEPLOYED = 'Partially deployed',
  UNDEPLOYED = 'Undeployed',
  DEPLOY_FAILED = 'Deploy failed',
}

// Based off of https://github.com/opensearch-project/ml-commons/blob/main/common/src/main/java/org/opensearch/ml/common/FunctionName.java
export enum MODEL_ALGORITHM {
  LINEAR_REGRESSION = 'Linear regression',
  KMEANS = 'K-means',
  AD_LIBSVM = 'AD LIBSVM',
  SAMPLE_ALGO = 'Sample algorithm',
  LOCAL_SAMPLE_CALCULATOR = 'Local sample calculator',
  FIT_RCF = 'Fit RCF',
  BATCH_RCF = 'Batch RCF',
  ANOMALY_LOCALIZATION = 'Anomaly localization',
  RCF_SUMMARIZE = 'RCF summarize',
  LOGISTIC_REGRESSION = 'Logistic regression',
  TEXT_EMBEDDING = 'Text embedding',
  METRICS_CORRELATION = 'Metrics correlation',
  REMOTE = 'Remote',
  SPARSE_ENCODING = 'Sparse encoding',
  SPARSE_TOKENIZE = 'Sparse tokenize',
  TEXT_SIMILARITY = 'Text similarity',
  QUESTION_ANSWERING = 'Question answering',
  AGENT = 'Agent',
}

export type ModelConfig = {
  modelType?: string;
  embeddingDimension?: number;
};

// Based off of JSONSchema. For more info, see https://json-schema.org/understanding-json-schema/reference/type
export type ModelInput = {
  type: string;
  description?: string;
  items?: ModelInput;
  properties?: ModelInputMap;
};

export type ModelOutput = ModelInput;

export type ModelInputMap = { [key: string]: ModelInput };
export type ModelOutputMap = { [key: string]: ModelOutput };

// For rendering options, we extract the name (the key in the input/output obj) and combine into a single obj
export type ModelInputFormField = ModelInput & {
  label: string;
};

export type ModelOutputFormField = ModelInputFormField;

export type ModelInterface = {
  input?: ModelInput;
  output?: ModelOutput;
};

export type ConnectorParameters = {
  model?: string;
  dimensions?: number;
};

export type Model = {
  id: string;
  name: string;
  algorithm: MODEL_ALGORITHM;
  state: MODEL_STATE;
  modelConfig?: ModelConfig;
  interface?: ModelInterface;
  connectorId?: string;
};

export type Connector = {
  id: string;
  name: string;
  parameters?: ConnectorParameters;
};

export type ModelDict = {
  [modelId: string]: Model;
};

export type ConnectorDict = {
  [connectorId: string]: Connector;
};

export type ModelFormValue = {
  id: string;
  algorithm?: MODEL_ALGORITHM;
};

/**
 ********** MISC TYPES/INTERFACES ************
 */

// Based off of https://github.com/opensearch-project/flow-framework/blob/main/src/main/java/org/opensearch/flowframework/model/State.java
export enum WORKFLOW_STATE {
  NOT_STARTED = 'Not started',
  PROVISIONING = 'Provisioning',
  FAILED = 'Failed',
  COMPLETED = 'Completed',
}

export type WorkflowResource = {
  id: string;
  stepType: WORKFLOW_STEP_TYPE;
  type: WORKFLOW_RESOURCE_TYPE;
};

// Based off of https://github.com/opensearch-project/flow-framework/blob/main/src/main/java/org/opensearch/flowframework/common/WorkflowResources.java
export enum WORKFLOW_RESOURCE_TYPE {
  PIPELINE_ID = 'Ingest pipeline',
  INDEX_NAME = 'Index',
  MODEL_ID = 'Model',
  MODEL_GROUP_ID = 'Model group',
  CONNECTOR_ID = 'Connector',
}

export enum WORKFLOW_STEP_TYPE {
  CREATE_INGEST_PIPELINE_STEP_TYPE = 'create_ingest_pipeline',
  CREATE_SEARCH_PIPELINE_STEP_TYPE = 'create_search_pipeline',
  CREATE_INDEX_STEP_TYPE = 'create_index',
}

// We cannot disambiguate ingest vs. search pipelines based on workflow resource type. To work around
// that, we maintain this map from workflow step type -> formatted type
export enum WORKFLOW_STEP_TO_RESOURCE_TYPE_MAP {
  'create_ingest_pipeline' = 'Ingest pipeline',
  'create_search_pipeline' = 'Search pipeline',
  'create_index' = 'Index',
}

export type WorkflowDict = {
  [workflowId: string]: Workflow;
};

export type QueryPreset = {
  name: string;
  query: string;
};

export type PromptPreset = {
  name: string;
  prompt: string;
};

export type QuickConfigureFields = {
  embeddingModelId?: string;
  llmId?: string;
  vectorField?: string;
  textField?: string;
  imageField?: string;
  labelField?: string;
  promptField?: string;
  embeddingLength?: number;
  llmResponseField?: string;
};

export type QueryParamType = 'Text' | 'Binary';

export type QueryParam = {
  name: string;
  type: QueryParamType;
  value: string;
};

export type CachedFormikState = {
  errors?: {};
  touched?: {};
};

export type IngestPipelineErrors = {
  [idx: number]: { processorType: string; errorMsg: string };
};

/**
 ********** OPENSEARCH TYPES/INTERFACES ************
 */

// from https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest/#example-specify-a-pipeline-in-the-path
export type SimulateIngestPipelineDoc = {
  _index: string;
  _id: string;
  _source: any;
};

// from https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest/#example-specify-a-pipeline-in-the-path
export type SimulateIngestPipelineDocResponse = {
  doc: SimulateIngestPipelineDoc & {
    _ingest: {
      timestamp: string;
    };
  };
  error?: {
    reason: string;
  };
};

// from https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest/#example-specify-a-pipeline-in-the-path
export type SimulateIngestPipelineResponse = {
  docs: SimulateIngestPipelineDocResponse[];
};

// verbose mode
// from https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest/#query-parameters
export type SimulateIngestPipelineDocResponseVerbose = SimulateIngestPipelineDocResponse & {
  processor_type: string;
  status: 'success' | 'error';
  description?: string;
};

// verbose mode
// from https://opensearch.org/docs/latest/ingest-pipelines/simulate-ingest/#query-parameters
export type SimulateIngestPipelineResponseVerbose = {
  docs: [
    {
      processor_results: SimulateIngestPipelineDocResponseVerbose[];
    }
  ];
};

export type SearchHit = SimulateIngestPipelineDoc;

export type SearchResponse = {
  took: number;
  timed_out: boolean;
  _shards: {
    total: number;
    successful: number;
    skipped: number;
    failed: number;
  };
  hits: {
    total: {
      value: number;
      relation: string;
    };
    max_score: number;
    hits: SearchHit[];
  };
  aggregations?: {};
  ext?: {};
};

export type SearchProcessorInputData = {
  _index: string;
  _id: string;
  _score: number;
  _source: {};
};
export type SearchProcessorOutputData = SearchProcessorInputData;

export type SearchProcessorResult = {
  processor_name: string;
  duration_millis: number;
  status: 'success' | 'fail';
  error?: string;
  input_data: SearchProcessorInputData[] | null;
  output_data: SearchProcessorOutputData[] | null;
};

export type SearchResponseVerbose = SearchResponse & {
  processor_results: SearchProcessorResult[];
};

export type SearchPipelineErrors = IngestPipelineErrors;

export type IndexResponse = {
  indexName: string;
  indexDetails: IndexConfiguration;
};

export type IngestPipelineResponse = {
  pipelineId: string;
  ingestPipelineDetails: IngestPipelineConfig;
};

export type SearchPipelineResponse = {
  pipelineId: string;
  searchPipelineDetails: SearchPipelineConfig;
};
