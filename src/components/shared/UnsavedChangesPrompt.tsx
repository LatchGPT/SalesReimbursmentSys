import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Modal } from './Modal';

interface UnsavedChangesPromptOptions {
  isDirty: boolean;
  onSaveDraft: () => Promise<boolean>;
  formName: string;
}

/**
 * Protects in-app links and browser unloads while a form has unsaved input.
 * The browser owns the prompt for a tab close/refresh; route changes use the
 * application dialog so a requestor can save a draft before leaving.
 */
export function useUnsavedChangesPrompt({ isDirty, onSaveDraft, formName }: UnsavedChangesPromptOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const requestLeave = useCallback((leave: () => void) => {
    if (!isDirty) {
      leave();
      return;
    }
    setPendingLeave(() => leave);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty) return;

    const interceptInternalLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>('a[href]');
      if (!link || link.target || link.hasAttribute('download')) return;

      const destination = new URL(link.href, window.location.href);
      const current = `${location.pathname}${location.search}${location.hash}`;
      const next = `${destination.pathname}${destination.search}${destination.hash}`;
      if (destination.origin !== window.location.origin || next === current) return;

      event.preventDefault();
      event.stopPropagation();
      requestLeave(() => navigate(next));
    };

    document.addEventListener('click', interceptInternalLink, true);
    return () => document.removeEventListener('click', interceptInternalLink, true);
  }, [isDirty, location.hash, location.pathname, location.search, navigate, requestLeave]);

  const closeDialog = () => setPendingLeave(null);
  const discardAndLeave = () => {
    const leave = pendingLeave;
    setPendingLeave(null);
    leave?.();
  };
  const saveDraftAndLeave = async () => {
    setSavingDraft(true);
    try {
      if (await onSaveDraft()) discardAndLeave();
    } finally {
      setSavingDraft(false);
    }
  };

  return {
    requestLeave,
    unsavedChangesDialog: (
      <Modal
        isOpen={Boolean(pendingLeave)}
        onClose={closeDialog}
        closeOnBackdrop={false}
      >
        <Card className="shadow-lg">
          <div className="p-6">
            <h2 className="font-headline-md text-on-surface mb-3">Leave {formName}?</h2>
            <p className="text-body-md text-on-surface-variant">
              You have unsaved changes. You can discard them, keep working, or save this work as a draft before leaving.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={discardAndLeave} disabled={savingDraft}>Yes</Button>
              <Button variant="outline" onClick={closeDialog} disabled={savingDraft}>Back</Button>
              <Button onClick={saveDraftAndLeave} disabled={savingDraft}>
                {savingDraft ? 'Saving Draft…' : 'Save to Draft'}
              </Button>
            </div>
          </div>
        </Card>
      </Modal>
    ),
  };
}
