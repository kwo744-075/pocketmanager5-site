'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Modal from './Modal';
import EmployeeProfileWizard from './EmployeeProfileWizard';

type Props = {
  staffId?: string | null;
  shopNumber?: string | null;
  label?: React.ReactNode;
  className?: string;
};

export default function EmployeeProfileModalTrigger({ staffId, shopNumber, label, className }: Props) {
  const [open, setOpen] = useState(false);
  const [initialValues, setInitialValues] = useState<Record<string, any> | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  // Open modal if the current URL includes ?wizard=1 and matches this trigger's id (or no id for Add)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const wizard = params.get('wizard');
      const id = params.get('id');
      if (wizard === '1') {
        if (staffId) {
          if (id === staffId) setOpen(true);
        } else if (!id) {
          // Add flow (no id present)
          setOpen(true);
        }
      }
    } catch (err) {
      // ignore
    }
  }, [staffId]);

  const addWizardQuery = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.set('wizard', '1');
    if (staffId) params.set('id', String(staffId));
    const next = `${window.location.pathname}?${params.toString()}`;
    try {
      window.history.pushState({}, '', next);
    } catch (err) {
      // ignore
    }
  };

  const removeWizardQuery = () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    params.delete('wizard');
    params.delete('id');
    const qs = params.toString();
    const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    try {
      window.history.replaceState({}, '', next);
    } catch (err) {
      // ignore
    }
  };

  const openModal = async () => {
    // If editing an existing staff member, fetch initial values first so the FormRenderer mounts with data.
    if (staffId) {
      setLoading(true);
      try {
        const { data: staffRow, error } = await supabase.from('shop_staff').select('*').eq('id', staffId).maybeSingle();
        if (!error && staffRow) {
          const iv: Record<string, any> = {
            staffName: staffRow.staff_name ?? '',
            phoneNumber: staffRow.employee_phone_number ?? '',
            hireDate: staffRow.date_of_hired ?? '',
            dateOfBirth: staffRow.birth_date ?? '',
            favoriteTreat: staffRow.celebration_profile_json?.favoriteTreat ?? '',
            celebrationNotes: staffRow.celebration_profile_json?.celebrationNotes ?? '',
            id: staffRow.id,
            shopNumber: shopNumber ?? undefined,
          };
          setInitialValues(iv);
        } else {
          setInitialValues(undefined);
        }
      } catch (err) {
        console.warn('Unable to load staff data', err);
        setInitialValues(undefined);
      } finally {
        setLoading(false);
      }
    }

    addWizardQuery();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    removeWizardQuery();
  };

  const handleSaved = (payload?: any) => {
    // allow EmployeeProfileWizard to trigger close via callback
    setOpen(false);
    removeWizardQuery();
  };

  return (
    <>
      <button type="button" onClick={openModal} className={className}>
        {label ?? 'Open'}
      </button>

      <Modal open={open} onClose={handleClose} labelledById="employee-wizard-title">
        <div className="p-4">
          <div className="flex items-center justify-between">
            <h2 id="employee-wizard-title" className="text-xl font-semibold">Add / Edit Teammate</h2>
            <button aria-label="Close" className="text-sm text-slate-500" onClick={handleClose}>Close</button>
          </div>
          <div className="mt-4">
            {loading ? (
              <div className="p-8 text-center text-slate-400">Loading…</div>
            ) : (
              <EmployeeProfileWizard
                shopNumber={shopNumber}
                initialValues={initialValues}
                onSaved={handleSaved}
                onCancel={handleClose}
              />
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
