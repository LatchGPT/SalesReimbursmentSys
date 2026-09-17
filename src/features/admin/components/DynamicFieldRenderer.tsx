import { useAppContext } from '../../../components/AppContext';
import { Input, Select, Label } from '../../../components/ui/Input';
import { FieldDefinitionEntity, ClaimType } from '../../../types';

export interface DynamicFieldRendererProps {
  entity: FieldDefinitionEntity;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  errors?: Record<string, string>;
  claimType?: ClaimType;
  includeKeys?: string[];
  excludeKeys?: string[];
  containerClassName?: string;
}

export function DynamicFieldRenderer({ entity, values, onChange, errors = {}, claimType, includeKeys, excludeKeys, containerClassName }: DynamicFieldRendererProps) {
  const { fieldDefinitions, masterData } = useAppContext();

  const activeFields = fieldDefinitions
    .filter(fd => fd.entity === entity && fd.active)
    .filter(fd => !includeKeys || includeKeys.includes(fd.key))
    .filter(fd => !excludeKeys?.includes(fd.key))
    .filter(fd => {
      if (!claimType) return true;
      return !fd.applicableClaimTypes || fd.applicableClaimTypes.length === 0 || fd.applicableClaimTypes.includes(claimType);
    })
    .sort((a, b) => a.display_order - b.display_order);

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <div className={containerClassName || "grid grid-cols-1 md:grid-cols-2 gap-6 w-full"}>
      {activeFields.map(fd => {
        const rawOptions = fd.master_data_entity 
          ? masterData.filter(m => m.type === fd.master_data_entity && m.active).map(m => m.name)
          : fd.options || [];
        const options = fd.allow_other
          ? rawOptions.filter(opt => !/^other(\s*\(specify\))?$/i.test(opt.trim()))
          : rawOptions;
        const fieldId = `dynamic-${entity}-${fd.key}`.replace(/[^a-zA-Z0-9_-]/g, '-');
        const errorId = `${fieldId}-error`;
        const isOtherSelected = Boolean(fd.allow_other && values[fd.key] === 'Other');
        const otherKey = `${fd.key}_other`;
        const otherFieldId = `${fieldId}-specify`;
        const otherErrorId = `${otherFieldId}-error`;
        const otherError = errors[otherKey] || (isOtherSelected ? errors[fd.key] : undefined);
        const hasBaseError = Boolean(errors[fd.key]);
        const accessibilityProps = {
          id: fieldId,
          'aria-invalid': hasBaseError,
          'aria-describedby': hasBaseError ? errorId : undefined,
          required: fd.required,
        };
        
        return (
          <div key={fd.id} className={fd.input_type === 'textarea' ? "md:col-span-2" : ""}>
            <Label htmlFor={fieldId} required={fd.required}>{fd.label}</Label>
            {fd.input_type === 'dropdown' ? (
              <div className="space-y-2">
                <Select 
                  {...accessibilityProps}
                  value={values[fd.key] || ''} 
                  onChange={e => {
                    const newVal = e.target.value;
                    onChange(fd.key, newVal);
                    if (newVal !== 'Other' && values[otherKey]) {
                      onChange(otherKey, '');
                    }
                  }}
                  className={hasBaseError && !isOtherSelected ? 'border-error' : ''}
                >
                  <option value="">Select...</option>
                  {options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                  {fd.allow_other && <option value="Other">Other (Specify)</option>}
                </Select>
                {hasBaseError && !isOtherSelected && (
                  <p id={errorId} role="alert" className="text-error text-xs mt-1">{errors[fd.key]}</p>
                )}
                {isOtherSelected && (
                  <div className="pt-1 space-y-1">
                    <Label htmlFor={otherFieldId} required={fd.required} className="text-xs text-outline font-medium">
                      Please specify {fd.label.toLowerCase()}
                    </Label>
                    <Input
                      id={otherFieldId}
                      aria-invalid={Boolean(otherError)}
                      aria-describedby={otherError ? otherErrorId : undefined}
                      placeholder={`Please specify...`}
                      value={values[otherKey] || ''}
                      onChange={e => onChange(otherKey, e.target.value)}
                      className={otherError ? 'border-error' : ''}
                      required={fd.required}
                      autoFocus
                    />
                    {otherError && (
                      <p id={otherErrorId} role="alert" className="text-error text-xs mt-1">
                        {otherError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : fd.input_type === 'textarea' ? (
              <>
                <textarea 
                  {...accessibilityProps}
                  className={`w-full bg-white border ${errors[fd.key] ? 'border-error' : 'border-brand-field-border'} rounded-input px-4 py-2.5 text-body-base focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none`}
                  rows={3}
                  value={values[fd.key] || ''} 
                  onChange={e => onChange(fd.key, e.target.value)} 
                />
                {errors[fd.key] && (
                  <p id={errorId} role="alert" className="text-error text-xs mt-1">{errors[fd.key]}</p>
                )}
              </>
            ) : (
              <>
                <Input
                  {...accessibilityProps}
                  type={fd.input_type} 
                  value={values[fd.key] || ''} 
                  onChange={e => onChange(fd.key, e.target.value)} 
                  className={errors[fd.key] ? 'border-error' : ''}
                />
                {errors[fd.key] && (
                  <p id={errorId} role="alert" className="text-error text-xs mt-1">{errors[fd.key]}</p>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  );
}
