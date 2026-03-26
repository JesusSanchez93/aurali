import type { NodeTypes } from '@xyflow/react';
import { CustomNode } from './CustomNode';

export const nodeTypes: NodeTypes = {
  start: CustomNode,
  send_email: CustomNode,
  send_documents: CustomNode,
  client_form: CustomNode,
  status_update: CustomNode,
  generate_document: CustomNode,
  notify_lawyer: CustomNode,
  manual_action: CustomNode,
  end: CustomNode,
};
