/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import moment from 'moment';
import { DATE_FORMAT_PATTERN, WORKFLOW_TYPE, Workflow } from './';
import { isEmpty } from 'lodash';

export function toFormattedDate(timestampMillis: number): String {
  return moment(new Date(timestampMillis)).format(DATE_FORMAT_PATTERN);
}

const PERMISSIONS_ERROR_PATTERN = /no permissions for \[(.+)\] and User \[name=(.+), backend_roles/;

export const prettifyErrorMessage = (rawErrorMessage: string) => {
  if (isEmpty(rawErrorMessage) || rawErrorMessage === 'undefined') {
    return 'Unknown error is returned.';
  }
  const match = rawErrorMessage.match(PERMISSIONS_ERROR_PATTERN);
  if (isEmpty(match)) {
    return rawErrorMessage;
  } else {
    return `User ${match[2]} has no permissions to [${match[1]}].`;
  }
};

export function getCharacterLimitedString(
  input: string | undefined,
  limit: number
): string {
  return input !== undefined
    ? input.length > limit
      ? input.substring(0, limit - 3) + '...'
      : input
    : '';
}

export function customStringify(jsonObj: {} | []): string {
  return JSON.stringify(jsonObj, undefined, 2);
}

export function customStringifySingleLine(jsonObj: {}): string {
  return JSON.stringify(jsonObj, undefined, 0);
}

export function isVectorSearchUseCase(workflow: Workflow | undefined): boolean {
  return (
    workflow?.ui_metadata?.type !== undefined &&
    [
      WORKFLOW_TYPE.HYBRID_SEARCH,
      WORKFLOW_TYPE.MULTIMODAL_SEARCH,
      WORKFLOW_TYPE.SEMANTIC_SEARCH,
      WORKFLOW_TYPE.VECTOR_SEARCH_WITH_RAG,
    ].includes(workflow?.ui_metadata?.type)
  );
}
