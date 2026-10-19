export interface Task {
  status: string;
  priority?: string;
  owner?: string;
  title: string;
  description: string;
  label?: string;
}

export interface TaskLabelInput {
  priority?: unknown;
  owner?: unknown;
}