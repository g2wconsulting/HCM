import { FormRenderer } from './FormRenderer';
import { W4Form } from './standard-forms/W4Form';
import { I9Form } from './standard-forms/I9Form';
import { W9Form } from './standard-forms/W9Form';
import type { FormTemplate } from '../lib/types';

type Responses = Record<string, string | number | boolean>;

export function StandardOrCustomForm({
  template, responses, onChange, readOnly,
}: {
  template: FormTemplate;
  responses: Responses;
  onChange?: (fieldId: string, value: string | number | boolean) => void;
  readOnly?: boolean;
}) {
  if (template.standardKind === 'w4') return <W4Form responses={responses} onChange={onChange} readOnly={readOnly} />;
  if (template.standardKind === 'i9') return <I9Form responses={responses} onChange={onChange} readOnly={readOnly} />;
  if (template.standardKind === 'w9') return <W9Form responses={responses} onChange={onChange} readOnly={readOnly} />;
  return <FormRenderer template={template} responses={responses} onChange={onChange} readOnly={readOnly} />;
}
