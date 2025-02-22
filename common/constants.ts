/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  InputMapEntry,
  MapEntry,
  PromptPreset,
  QueryPreset,
  WORKFLOW_STATE,
} from './interfaces';
import { customStringify } from './utils';

export const PLUGIN_ID = 'opensearch-flow';
export const PLUGIN_NAME = 'OpenSearch Flow';

/**
 * BACKEND FLOW FRAMEWORK APIs
 */
export const FLOW_FRAMEWORK_API_ROUTE_PREFIX = '/_plugins/_flow_framework';
export const FLOW_FRAMEWORK_WORKFLOW_ROUTE_PREFIX = `${FLOW_FRAMEWORK_API_ROUTE_PREFIX}/workflow`;
export const FLOW_FRAMEWORK_SEARCH_WORKFLOWS_ROUTE = `${FLOW_FRAMEWORK_WORKFLOW_ROUTE_PREFIX}/_search`;
export const FLOW_FRAMEWORK_SEARCH_WORKFLOW_STATE_ROUTE = `${FLOW_FRAMEWORK_WORKFLOW_ROUTE_PREFIX}/state/_search`;

/**
 * BACKEND ML PLUGIN APIs
 */
export const ML_API_ROUTE_PREFIX = '/_plugins/_ml';
export const ML_MODEL_ROUTE_PREFIX = `${ML_API_ROUTE_PREFIX}/models`;
export const ML_CONNECTOR_ROUTE_PREFIX = `${ML_API_ROUTE_PREFIX}/connectors`;
export const ML_SEARCH_MODELS_ROUTE = `${ML_MODEL_ROUTE_PREFIX}/_search`;
export const ML_SEARCH_CONNECTORS_ROUTE = `${ML_CONNECTOR_ROUTE_PREFIX}/_search`;

/**
 * OpenSearch APIs
 */
export const SEARCH_PIPELINE_ROUTE = '/_search/pipeline';

/**
 * NODE APIs
 */
export const BASE_NODE_API_PATH = '/api/flow_framework';

// OpenSearch node APIs
export const BASE_OPENSEARCH_NODE_API_PATH = `${BASE_NODE_API_PATH}/opensearch`;
export const CAT_INDICES_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/catIndices`;
export const GET_MAPPINGS_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/mappings`;
export const GET_INDEX_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/getIndex`;
export const SEARCH_INDEX_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/search`;
export const INGEST_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/ingest`;
export const BULK_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/bulk`;
export const SIMULATE_PIPELINE_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/simulatePipeline`;
export const INGEST_PIPELINE_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/getIngestPipeline`;
export const SEARCH_PIPELINE_NODE_API_PATH = `${BASE_OPENSEARCH_NODE_API_PATH}/getSearchPipeline`;

// Flow Framework node APIs
export const BASE_WORKFLOW_NODE_API_PATH = `${BASE_NODE_API_PATH}/workflow`;
export const GET_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}`;
export const SEARCH_WORKFLOWS_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/search`;
export const GET_WORKFLOW_STATE_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/state`;
export const CREATE_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/create`;
export const UPDATE_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/update`;
export const PROVISION_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/provision`;
export const DEPROVISION_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/deprovision`;
export const DELETE_WORKFLOW_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/delete`;
export const GET_PRESET_WORKFLOWS_NODE_API_PATH = `${BASE_WORKFLOW_NODE_API_PATH}/presets`;

// ML Plugin node APIs
export const BASE_MODEL_NODE_API_PATH = `${BASE_NODE_API_PATH}/model`;
export const BASE_CONNECTOR_NODE_API_PATH = `${BASE_NODE_API_PATH}/connector`;
export const SEARCH_MODELS_NODE_API_PATH = `${BASE_MODEL_NODE_API_PATH}/search`;
export const SEARCH_CONNECTORS_NODE_API_PATH = `${BASE_CONNECTOR_NODE_API_PATH}/search`;

/**
 * Remote model dimensions. Used for attempting to pre-fill dimension size
 * based on the specified remote model from a remote service, if found
 */

interface RemoteEmbeddingModelConfig {
  dimension: number;
  fieldName: string;
}

// Amazon BedRock
export const BEDROCK_CONFIGS = {
  [`amazon.titan-embed-text-v1`]: {
    dimension: 1536,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
  [`amazon.titan-embed-text-v2`]: {
    dimension: 1024,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
  [`amazon.titan-embed-image-v1`]: {
    dimension: 1024,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
  [`cohere.embed-english-v3`]: {
    dimension: 1024,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`cohere.embed-multilingual-v3`]: {
    dimension: 1024,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
};

// Cohere
export const COHERE_CONFIGS = {
  [`embed-english-v3.0`]: {
    dimension: 1024,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-english-light-v3.0`]: {
    dimension: 384,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-multilingual-v3.0`]: {
    dimension: 1024,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-multilingual-light-v3.0`]: {
    dimension: 384,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-english-v2.0`]: {
    dimension: 4096,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-english-light-v2.0`]: {
    dimension: 1024,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
  [`embed-multilingual-v2.0`]: {
    dimension: 768,
    fieldName: 'embeddings',
  } as RemoteEmbeddingModelConfig,
};

// OpenAI
export const OPENAI_CONFIGS = {
  [`text-embedding-3-small`]: {
    dimension: 1536,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
  [`text-embedding-3-large`]: {
    dimension: 3072,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
  [`text-embedding-ada-002`]: {
    dimension: 1536,
    fieldName: 'embedding',
  } as RemoteEmbeddingModelConfig,
};

/**
 * Various constants pertaining to Workflow configs
 */

export const UI_METADATA_SCHEMA_VERSION = 1;

// frontend-specific workflow types, derived from the available preset templates
export enum WORKFLOW_TYPE {
  SEMANTIC_SEARCH = 'Semantic Search',
  MULTIMODAL_SEARCH = 'Multimodal Search',
  HYBRID_SEARCH = 'Hybrid Search',
  RAG = 'RAG with Lexical Retrieval',
  VECTOR_SEARCH_WITH_RAG = 'RAG with Vector Retrieval',
  CUSTOM = 'Custom Search',
  UNKNOWN = 'Unknown',
}
export enum WORKFLOW_TYPE_LEGACY {
  SEMANTIC_SEARCH = 'Semantic Search',
  MULTIMODAL_SEARCH = 'Multimodal Search',
  HYBRID_SEARCH = 'Hybrid Search',
  CUSTOM = 'Custom Search',
  UNKNOWN = 'Unknown',
}
// If no datasource version is found, we default to 2.17.0
export const MIN_SUPPORTED_VERSION = '2.17.0';
// Min version to support ML processors
export const MINIMUM_FULL_SUPPORTED_VERSION = '2.19.0';

// the names should be consistent with the underlying implementation. used when generating the
// final ingest/search pipeline configurations.
export enum PROCESSOR_TYPE {
  ML = 'ml_inference',
  SPLIT = 'split',
  SORT = 'sort',
  TEXT_CHUNKING = 'text_chunking',
  NORMALIZATION = 'normalization-processor',
  COLLAPSE = 'collapse',
  RERANK = 'rerank',
  TEXT_EMBEDDING = 'text_embedding',
  TEXT_IMAGE_EMBEDDING = 'text_image_embedding',
  COPY = 'copy',
}

export enum MODEL_TYPE {
  TEXT_EMBEDDING = 'text_embedding',
  SPARSE_ENCODER = 'sparse_encoder',
}

export enum MODEL_CATEGORY {
  EMBEDDING = 'EMBEDDING',
  LLM = 'LLM',
}

/**
 * Various constants pertaining to the drag-and-drop UI components
 */
export enum COMPONENT_CATEGORY {
  INGEST = 'Ingest',
  SEARCH = 'Search',
}

export enum NODE_CATEGORY {
  CUSTOM = 'custom',
  INGEST_GROUP = 'ingestGroup',
  SEARCH_GROUP = 'searchGroup',
}

/**
 * A base set of component classes / types.
 */
export enum COMPONENT_CLASS {
  INDEX = 'index',
  KNN_INDEX = 'knn_index',
  TRANSFORMER = 'transformer',
  ML_TRANSFORMER = 'ml_transformer',
  SEARCH_REQUEST = 'search_request',
  DOCUMENT = 'document',
  SEARCH_RESPONSE = 'search_response',
}

/**
 * LINKS
 */
export const ML_INFERENCE_DOCS_LINK =
  'https://opensearch.org/docs/latest/ingest-pipelines/processors/ml-inference/#configuration-parameters';
export const ML_INFERENCE_RESPONSE_DOCS_LINK =
  'https://opensearch.org/docs/latest/search-plugins/search-pipelines/ml-inference-search-response/#request-fields';
export const ML_CHOOSE_MODEL_LINK =
  'https://opensearch.org/docs/latest/ml-commons-plugin/integrating-ml-models/#choosing-a-model';
export const ML_REMOTE_MODEL_LINK =
  'https://opensearch.org/docs/latest/ml-commons-plugin/remote-models/index/';
export const TEXT_CHUNKING_PROCESSOR_LINK =
  'https://opensearch.org/docs/latest/ingest-pipelines/processors/text-chunking/';
export const CREATE_WORKFLOW_LINK =
  'https://opensearch.org/docs/latest/automating-configurations/api/create-workflow/';
export const WORKFLOW_TUTORIAL_LINK =
  'https://opensearch.org/docs/latest/automating-configurations/workflow-tutorial/';
export const NORMALIZATION_PROCESSOR_LINK =
  'https://opensearch.org/docs/latest/search-plugins/search-pipelines/normalization-processor/';
export const GITHUB_FEEDBACK_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/issues/new/choose';
export const JSONPATH_DOCS_LINK = 'https://www.npmjs.com/package/jsonpath';
export const KNN_VECTOR_DOCS_LINK =
  'https://opensearch.org/docs/latest/field-types/supported-field-types/knn-vector/';
export const BULK_API_DOCS_LINK =
  'https://opensearch.org/docs/latest/api-reference/document-apis/bulk/';
export const SEARCH_PIPELINE_DOCS_LINK =
  'https://opensearch.org/docs/latest/search-plugins/search-pipelines/using-search-pipeline/';
export const ML_RESPONSE_PROCESSOR_EXAMPLE_DOCS_LINK =
  'https://opensearch.org/docs/latest/search-plugins/search-pipelines/ml-inference-search-response/#example-externally-hosted-text-embedding-model';
export const UPDATE_MODEL_DOCS_LINK =
  'https://opensearch.org/docs/latest/ml-commons-plugin/api/model-apis/update-model/';
export const JSONLINES_LINK = 'https://jsonlines.org/';

// Large Language Models Documentation Links
export const BEDROCK_CLAUDE_3_SONNET_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md#claude-3-sonnet-hosted-on-amazon-bedrock';

export const OPENAI_GPT35_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md#openai-gpt-35';

export const DEEPSEEK_CHAT_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md#deepseek-chat';

// Embedding Models Documentation Links
export const COHERE_EMBEDDING_MODEL_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md#cohere-embed';

export const BEDROCK_TITAN_EMBEDDING_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md#amazon-bedrock-titan-text-embedding';

// ML Models setup Documentation Link
export const ML_MODELS_SETUP_DOCS_LINK =
  'https://github.com/opensearch-project/dashboards-flow-framework/blob/main/documentation/models.md';

/**
 * Text chunking algorithm constants
 */
export enum TEXT_CHUNKING_ALGORITHM {
  FIXED_TOKEN_LENGTH = 'fixed_token_length',
  DELIMITER = 'delimiter',
}
export const FIXED_TOKEN_LENGTH_OPTIONAL_FIELDS = [
  'token_limit',
  'tokenizer',
  'overlap_rate',
];
export const DELIMITER_OPTIONAL_FIELDS = ['delimiter'];
export const SHARED_OPTIONAL_FIELDS = ['max_chunk_limit', 'description', 'tag'];

/**
 * DEFAULT FIELD VALUES
 */
export const DEFAULT_TEXT_FIELD = 'my_text';
export const DEFAULT_VECTOR_FIELD = 'my_embedding';
export const DEFAULT_IMAGE_FIELD = 'my_image';
export const DEFAULT_LLM_RESPONSE_FIELD = 'llm_response';

/**
 * QUERY PRESETS
 */
export const VECTOR_FIELD_PATTERN = `{{vector_field}}`;
export const TEXT_FIELD_PATTERN = `{{text_field}}`;
export const IMAGE_FIELD_PATTERN = `{{image_field}}`;
export const LABEL_FIELD_PATTERN = `{{label_field}}`;
export const QUERY_TEXT_PATTERN = `{{query_text}}`;
export const QUERY_IMAGE_PATTERN = `{{query_image}}`;
export const MODEL_ID_PATTERN = `{{model_id}}`;
export const VECTOR = 'vector';
export const VECTOR_PATTERN = `{{${VECTOR}}}`;
export const VECTOR_TEMPLATE_PLACEHOLDER = `\$\{${VECTOR}\}`;
export const DEFAULT_K = 10;
export const DEFAULT_FETCH_SIZE = 10;

// term-level queries
export const TERM_QUERY_TEXT = {
  query: {
    term: {
      [TEXT_FIELD_PATTERN]: {
        value: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const EXISTS_QUERY_TEXT = {
  query: {
    exists: {
      field: TEXT_FIELD_PATTERN,
    },
  },
};
export const FUZZY_QUERY_TEXT = {
  query: {
    fuzzy: {
      [TEXT_FIELD_PATTERN]: {
        value: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const WILDCARD_QUERY_TEXT = {
  query: {
    wildcard: {
      [TEXT_FIELD_PATTERN]: {
        wildcard: QUERY_TEXT_PATTERN,
        case_insensitive: false,
      },
    },
  },
};
export const PREFIX_QUERY_TEXT = {
  query: {
    prefix: {
      [TEXT_FIELD_PATTERN]: {
        value: QUERY_TEXT_PATTERN,
      },
    },
  },
};
// full-text queries
export const MATCH_QUERY_TEXT = {
  query: {
    match: {
      [TEXT_FIELD_PATTERN]: {
        query: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const MATCH_BOOLEAN_QUERY_TEXT = {
  query: {
    match_bool_prefix: {
      [TEXT_FIELD_PATTERN]: {
        query: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const MATCH_PHRASE_QUERY_TEXT = {
  query: {
    match_phrase: {
      [TEXT_FIELD_PATTERN]: {
        query: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const MATCH_PHRASE_PREFIX_QUERY_TEXT = {
  query: {
    match_phrase_prefix: {
      [TEXT_FIELD_PATTERN]: {
        query: QUERY_TEXT_PATTERN,
      },
    },
  },
};
export const QUERY_STRING_QUERY_TEXT = {
  query: {
    query_string: {
      query: QUERY_TEXT_PATTERN,
    },
  },
};
// misc / other queries
export const FETCH_ALL_QUERY = {
  query: {
    match_all: {},
  },
  size: DEFAULT_FETCH_SIZE,
};
export const FETCH_ALL_QUERY_LARGE = {
  query: {
    match_all: {},
  },
  size: 1000,
};
export const KNN_QUERY = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    knn: {
      [VECTOR_FIELD_PATTERN]: {
        vector: VECTOR_PATTERN,
        k: DEFAULT_K,
      },
    },
  },
  size: 10,
};
export const SEMANTIC_SEARCH_QUERY_NEURAL = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    neural: {
      [VECTOR_FIELD_PATTERN]: {
        query_text: QUERY_TEXT_PATTERN,
        model_id: MODEL_ID_PATTERN,
        k: DEFAULT_K,
      },
    },
  },
};
export const SEMANTIC_SEARCH_TEMPLATE_QUERY = {
  query: {
    template: {
      knn: {
        [VECTOR_FIELD_PATTERN]: {
          vector: VECTOR_PATTERN,
          k: 2,
        },
      },
    },
  },
  ext: {
    ml_inference: {
      text: QUERY_TEXT_PATTERN,
    },
  },
};

export const MULTIMODAL_SEARCH_QUERY_NEURAL = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    neural: {
      [VECTOR_FIELD_PATTERN]: {
        query_text: QUERY_TEXT_PATTERN,
        query_image: QUERY_IMAGE_PATTERN,
        model_id: MODEL_ID_PATTERN,
        k: DEFAULT_K,
      },
    },
  },
};
export const MULTIMODAL_SEARCH_QUERY_BOOL = {
  query: {
    bool: {
      must: [
        {
          match: {
            [TEXT_FIELD_PATTERN]: QUERY_TEXT_PATTERN,
          },
        },
        {
          match: {
            [IMAGE_FIELD_PATTERN]: QUERY_IMAGE_PATTERN,
          },
        },
      ],
    },
  },
};
export const HYBRID_SEARCH_QUERY_MATCH_KNN = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    hybrid: {
      queries: [
        {
          match: {
            [TEXT_FIELD_PATTERN]: {
              query: QUERY_TEXT_PATTERN,
            },
          },
        },
        {
          knn: {
            [VECTOR_FIELD_PATTERN]: {
              vector: VECTOR_PATTERN,
              k: DEFAULT_K,
            },
          },
        },
      ],
    },
  },
};
export const HYBRID_SEARCH_QUERY_MATCH_NEURAL = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    hybrid: {
      queries: [
        {
          match: {
            [TEXT_FIELD_PATTERN]: {
              query: QUERY_TEXT_PATTERN,
            },
          },
        },
        {
          neural: {
            [VECTOR_FIELD_PATTERN]: {
              query_text: QUERY_TEXT_PATTERN,
              model_id: MODEL_ID_PATTERN,
              k: DEFAULT_K,
            },
          },
        },
      ],
    },
  },
};
export const HYBRID_SEARCH_QUERY_MATCH_TERM = {
  _source: {
    excludes: [VECTOR_FIELD_PATTERN],
  },
  query: {
    hybrid: {
      queries: [
        {
          match: {
            [TEXT_FIELD_PATTERN]: {
              query: QUERY_TEXT_PATTERN,
            },
          },
        },
        {
          term: {
            [TEXT_FIELD_PATTERN]: {
              value: QUERY_TEXT_PATTERN,
            },
          },
        },
      ],
    },
  },
};

export const QUERY_PRESETS = [
  {
    name: 'Fetch all',
    query: customStringify(FETCH_ALL_QUERY),
  },
  {
    name: 'Term',
    query: customStringify(TERM_QUERY_TEXT),
  },
  {
    name: 'Match',
    query: customStringify(MATCH_QUERY_TEXT),
  },
  {
    name: 'Exists',
    query: customStringify(EXISTS_QUERY_TEXT),
  },
  {
    name: 'Fuzzy',
    query: customStringify(FUZZY_QUERY_TEXT),
  },
  {
    name: 'Wildcard',
    query: customStringify(WILDCARD_QUERY_TEXT),
  },
  {
    name: 'Prefix',
    query: customStringify(PREFIX_QUERY_TEXT),
  },
  {
    name: 'Match boolean',
    query: customStringify(MATCH_BOOLEAN_QUERY_TEXT),
  },
  {
    name: 'Match phrase',
    query: customStringify(MATCH_PHRASE_QUERY_TEXT),
  },
  {
    name: 'Match phrase prefix',
    query: customStringify(MATCH_PHRASE_PREFIX_QUERY_TEXT),
  },
  {
    name: 'Query string',
    query: customStringify(QUERY_STRING_QUERY_TEXT),
  },
  {
    name: 'Basic k-NN',
    query: customStringify(KNN_QUERY),
  },
  {
    name: WORKFLOW_TYPE.MULTIMODAL_SEARCH,
    query: customStringify(MULTIMODAL_SEARCH_QUERY_BOOL),
  },
  {
    name: 'Semantic search (neural query)',
    query: customStringify(SEMANTIC_SEARCH_QUERY_NEURAL),
  },
  {
    name: 'Semantic search (template query)',
    query: customStringify(SEMANTIC_SEARCH_TEMPLATE_QUERY),
  },
  {
    name: `Hybrid search (match & k-NN queries)`,
    query: customStringify(HYBRID_SEARCH_QUERY_MATCH_KNN),
  },
  {
    name: `Hybrid search (match & term queries)`,
    query: customStringify(HYBRID_SEARCH_QUERY_MATCH_TERM),
  },
] as QueryPreset[];

/**
 * DEFAULT TEMPLATE VAR NAMES
 */
export const DEFAULT_PROMPT_RESULTS_FIELD = 'results';
export const DEFAULT_PROMPT_QUESTION_FIELD = 'question';
export const DEFAULT_PROMPT_TEXT_CATEGORY_FIELD = 'textCategory';
export const DEFAULT_PROMPT_ROLE_FIELD = 'role';

/**
 * PROMPT PRESETS. Based off of https://docs.aws.amazon.com/bedrock/latest/userguide/prompt-templates-and-examples.html
 */
export const GENERAL_SUMMARIZE_PROMPT =
  'Read the following text: \
\n\n${parameters.' +
  DEFAULT_PROMPT_RESULTS_FIELD +
  '.toString()} \
\n\nSummarize the text in one sentence.';

export const GENERAL_QA_WITH_CONTEXT_PROMPT =
  'Read the following text, and answer the question at the end: \
\n\n${parameters.' +
  DEFAULT_PROMPT_RESULTS_FIELD +
  '.toString()} \
\n\n${parameters.' +
  DEFAULT_PROMPT_QUESTION_FIELD +
  '.toString()}';

export const GENERAL_QA_NO_CONTEXT_PROMPT =
  'Answer the following question: \
${parameters.' +
  DEFAULT_PROMPT_QUESTION_FIELD +
  '.toString()}';

export const GENERAL_TEXT_GENERATION_PROMPT =
  'Please write a ${parameters.' +
  DEFAULT_PROMPT_TEXT_CATEGORY_FIELD +
  '.toString()} in the voice of ${parameters.' +
  DEFAULT_PROMPT_ROLE_FIELD +
  '.toString()}';

export const CLAUDE_SUMMARIZE_PROMPT =
  'Human: read the following results inside the <text></text> XML tags:\n\n<text>\n\
${parameters.' +
  DEFAULT_PROMPT_RESULTS_FIELD +
  ".toString()}\n</text>\n\n\
Summarize the above results in one sentence. If you don't know the answer, just \
say I don't know.\
\n\nAssistant:";

export const CLAUDE_QA_WITH_CONTEXT_PROMPT =
  'Human: read the following results inside the <text></text> XML tags, and then answer the question:\
\n\n<text>\n\
${parameters.' +
  DEFAULT_PROMPT_RESULTS_FIELD +
  '.toString()}\n\
</text>\n\n' +
  '${parameters.' +
  DEFAULT_PROMPT_QUESTION_FIELD +
  '.toString()}\n\nAssistant:';

export const PROMPT_PRESETS = [
  {
    name: 'Summarize text',
    prompt: GENERAL_SUMMARIZE_PROMPT,
  },
  {
    name: 'Question-answer, with context',
    prompt: GENERAL_QA_WITH_CONTEXT_PROMPT,
  },
  {
    name: 'Question-answer, without context',
    prompt: GENERAL_QA_NO_CONTEXT_PROMPT,
  },
  {
    name: 'Text generation',
    prompt: GENERAL_TEXT_GENERATION_PROMPT,
  },
  {
    name: 'Summarize text (Claude)',
    prompt: CLAUDE_SUMMARIZE_PROMPT,
  },
  {
    name: 'Question-answer, with context (Claude)',
    prompt: CLAUDE_QA_WITH_CONTEXT_PROMPT,
  },
] as PromptPreset[];

/**
 * MISCELLANEOUS
 */
export enum PROCESSOR_CONTEXT {
  INGEST = 'ingest',
  SEARCH_REQUEST = 'search_request',
  SEARCH_RESPONSE = 'search_response',
}
export const NO_TRANSFORMATION = 'No transformation';
export enum TRANSFORM_CONTEXT {
  INPUT = 'input',
  OUTPUT = 'output',
}
export enum TRANSFORM_TYPE {
  STRING = 'Custom string',
  FIELD = 'Data field',
  EXPRESSION = 'JSONPath expression',
  TEMPLATE = 'Prompt',
}

export const INPUT_TRANSFORM_OPTIONS = [
  {
    id: TRANSFORM_TYPE.FIELD,
    description:
      'Use an existing field from your data as the model input field.',
  },
  {
    id: TRANSFORM_TYPE.EXPRESSION,
    description:
      'Extract data from a JSON structure and map the extracted data to the model input field.',
  },
  {
    id: TRANSFORM_TYPE.TEMPLATE,
    description: 'Configure a prompt to map data to the model input field.',
  },
  {
    id: TRANSFORM_TYPE.STRING,
    description: 'Use a custom string in the model input field.',
  },
];

export const OUTPUT_TRANSFORM_OPTIONS = [
  {
    id: NO_TRANSFORMATION,
    description: '',
  },
  {
    id: TRANSFORM_TYPE.FIELD,
    description: 'Copy the model output into a new document field.',
  },
  {
    id: TRANSFORM_TYPE.EXPRESSION,
    description:
      'Extract data from a JSON structure and map the extracted data to a new document field.',
  },
];

export const DEFAULT_NEW_WORKFLOW_NAME = 'new_workflow';
export const DEFAULT_NEW_WORKFLOW_DESCRIPTION = 'My new workflow';
export const DEFAULT_NEW_WORKFLOW_STATE_TYPE = ('NOT_STARTED' as any) as typeof WORKFLOW_STATE;
export const DATE_FORMAT_PATTERN = 'MM/DD/YY hh:mm A';
export const EMPTY_FIELD_STRING = '--';
export const OMIT_SYSTEM_INDEX_PATTERN = '*,-.*';
export const INDEX_NOT_FOUND_EXCEPTION = 'index_not_found_exception';
export const ERROR_GETTING_WORKFLOW_MSG = 'Failed to retrieve template';
export const INVALID_DATASOURCE_MSG = 'No Living connections';
export const NO_TEMPLATES_FOUND_MSG = 'There are no templates';
export const NO_MODIFICATIONS_FOUND_TEXT =
  'Template does not contain any modifications';
export const JSONPATH_ROOT_SELECTOR = '$';
export const REQUEST_PREFIX = '_request.';
export const REQUEST_PREFIX_WITH_JSONPATH_ROOT_SELECTOR = '$._request.';
export const WORKFLOW_NAME_RESTRICTIONS =
  'Invalid workflow name. Valid characters are a-z, A-Z, 0-9, -(hyphen), _(underscore).';
export enum SORT_ORDER {
  ASC = 'asc',
  DESC = 'desc',
}
export const MAX_DOCS = 1000;
export const MAX_DOCS_TO_IMPORT = 100;
export const MAX_STRING_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_JSON_STRING_LENGTH = 10000;
export const MAX_TEMPLATE_STRING_LENGTH = 10000;
export const MAX_BYTES = 1048576; // OSD REST request payload size limit
export const MAX_BYTES_FORMATTED = '1,048,576';
export const MAX_WORKFLOW_NAME_TO_DISPLAY = 40;
export const WORKFLOW_NAME_REGEXP = RegExp('^[a-zA-Z0-9_-]*$');
export const INDEX_NAME_REGEXP = WORKFLOW_NAME_REGEXP;
export const PROVISION_TIMEOUT = '10s'; // the timeout config for synchronous provisioning. https://github.com/opensearch-project/flow-framework/pull/990
export const EMPTY_MAP_ENTRY = { key: '', value: '' } as MapEntry;
export const EMPTY_INPUT_MAP_ENTRY = {
  key: '',
  value: {
    transformType: TRANSFORM_TYPE.FIELD,
    value: '',
  },
} as InputMapEntry;
export const EMPTY_OUTPUT_MAP_ENTRY = {
  ...EMPTY_INPUT_MAP_ENTRY,
  value: {
    ...EMPTY_INPUT_MAP_ENTRY.value,
    transformType: NO_TRANSFORMATION as TRANSFORM_TYPE,
  },
};
export const MODEL_OUTPUT_SCHEMA_NESTED_PATH =
  'output.properties.inference_results.items.properties.output.items.properties.dataAsMap.properties';
export const MODEL_OUTPUT_SCHEMA_FULL_PATH = 'output.properties';
export enum CONFIG_STEP {
  INGEST = 'Ingest pipeline',
  SEARCH = 'Search pipeline',
}
export enum SOURCE_OPTIONS {
  MANUAL = 'manual',
  UPLOAD = 'upload',
  EXISTING_INDEX = 'existing_index',
}
export enum INSPECTOR_TAB_ID {
  TEST = 'test',
  INGEST = 'ingest',
  ERRORS = 'errors',
  RESOURCES = 'resources',
}

export const INSPECTOR_TABS = [
  {
    id: INSPECTOR_TAB_ID.TEST,
    name: 'Test flow',
    disabled: false,
  },
  {
    id: INSPECTOR_TAB_ID.INGEST,
    name: 'Ingest response',
    disabled: false,
  },
  {
    id: INSPECTOR_TAB_ID.ERRORS,
    name: 'Errors',
    disabled: false,
  },
  {
    id: INSPECTOR_TAB_ID.RESOURCES,
    name: 'Resources',
    disabled: false,
  },
];
