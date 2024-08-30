/**
 * Copyright 2024 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { PromptTemplate } from "@/template.js";
import { BaseMessage } from "@/llms/primitives/message.js";
import { ValueError } from "@/errors.js";
import { isDefined, mapValues, pickBy } from "remeda";

export interface Template {
  template: PromptTemplate<"messages">;
  messagesToPrompt: (template: PromptTemplate<"messages">) => (messages: BaseMessage[]) => string;
  parameters: {
    stop_sequence: string[];
  };
}

function messagesToPromptFactory(rolesOverride: Record<string, string | undefined> = {}) {
  const roles: Record<string, string> = pickBy(
    {
      system: "system",
      user: "user",
      assistant: "assistant",
      ...rolesOverride,
    },
    isDefined,
  );

  return (template: PromptTemplate<"messages">) => {
    return (messages: BaseMessage[]) => {
      return template.render({
        messages: messages.map((message) =>
          mapValues(roles, (role) => (message.role === role ? [message.text] : [])),
        ),
      });
    };
  };
}

const llama31: Template = {
  template: new PromptTemplate({
    variables: ["messages"],
    template: `{{#messages}}{{#system}}<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{system}}<|eot_id|>{{/system}}{{#user}}<|start_header_id|>user<|end_header_id|>

{{user}}<|eot_id|>{{/user}}{{#assistant}}<|start_header_id|>assistant<|end_header_id|>

{{assistant}}<|eot_id|>{{/assistant}}{{#ipython}}<|start_header_id|>ipython<|end_header_id|>

{{ipython}}<|eot_id|>{{/ipython}}{{/messages}}<|start_header_id|>assistant<|end_header_id|>
`,
  }),
  messagesToPrompt: messagesToPromptFactory({ ipython: "ipython" }),
  parameters: {
    stop_sequence: ["<|eot_id|>"],
  },
};

const llama3: Template = {
  template: new PromptTemplate({
    variables: ["messages"],
    template: `{{#messages}}{{#system}}<|begin_of_text|><|start_header_id|>system<|end_header_id|>

{{system}}<|eot_id|>{{/system}}{{#user}}<|start_header_id|>user<|end_header_id|>

{{user}}<|eot_id|>{{/user}}{{#assistant}}<|start_header_id|>assistant<|end_header_id|>

{{assistant}}<|eot_id|>{{/assistant}}{{/messages}}<|start_header_id|>assistant<|end_header_id|>
`,
  }),
  messagesToPrompt: messagesToPromptFactory(),
  parameters: {
    stop_sequence: ["<|eot_id|>"],
  },
};

const qwen2: Template = {
  template: new PromptTemplate({
    variables: ["messages"],
    template: `{{#messages}}{{#system}}<|im_start|>system
{{system}}<|im_end|>
{{ end }}{{/system}}{{#user}}<|im_start|>user
{{user}}<|im_end|>
{{ end }}{{/user}}{{#assistant}}<|im_start|>assistant
{{assistant}}<|im_end|>
{{ end }}{{/assistant}}{{/messages}}<|im_start|>assistant
`,
  }),
  messagesToPrompt: messagesToPromptFactory(),
  parameters: {
    stop_sequence: ["<|im_end|>"],
  },
};

export class LLMChatTemplates {
  protected static readonly registry = {
    "llama3.1": llama31,
    "llama3": llama3,
    "qwen2": qwen2,
  };

  static register(model: string, template: Template, override = false) {
    if (model in this.registry && !override) {
      throw new ValueError(`Template for model '${model}' already exists!`);
    }
    this.registry[model as keyof typeof this.registry] = template;
  }

  static has(model: string): boolean {
    return Boolean(model && model in this.registry);
  }

  static get(model: keyof typeof LLMChatTemplates.registry): Template;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  static get(model: string): Template;
  static get(model: string): Template {
    if (!this.has(model)) {
      throw new ValueError(`Template for model '${model}' not found!`, [], {
        context: {
          validModels: Object.keys(this.registry),
        },
      });
    }
    return this.registry[model as keyof typeof this.registry];
  }
}