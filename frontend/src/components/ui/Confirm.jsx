import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Button, Alert } from './index.jsx';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialog.
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete patient?', tone: 'danger' })) { … }
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, options: {} });
  const resolverRef = useRef(null);

  const confirm = useCallback((options = {}) => {
    setState({ open: true, options });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = useCallback((result) => {
    setState((current) => ({ ...current, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = null;
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);
  const { options } = state;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={state.open}
        onClose={() => settle(false)}
        title={options.title || 'Please confirm'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => settle(false)}>{options.cancelLabel || 'Cancel'}</Button>
            <Button variant={options.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)} autoFocus>
              {options.confirmLabel || 'Confirm'}
            </Button>
          </>
        }
      >
        {options.tone === 'danger' ? (
          <Alert tone="danger" title="This action cannot be undone">
            {options.message || 'Are you sure you want to continue?'}
          </Alert>
        ) : (
          <p>{options.message || 'Are you sure you want to continue?'}</p>
        )}
        {options.detail && <p className="text-sm text-muted mt-3">{options.detail}</p>}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside a ConfirmProvider');
  return context.confirm;
}
