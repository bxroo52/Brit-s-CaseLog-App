'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ASSIGNMENT_TYPES } from '@/lib/constants';
import { CaseFormData, Case } from '@/types';
import { useAppStore } from '@/stores/useAppStore';
import { toast } from 'sonner';

// Normalize legacy assignment types (e.g. old "Initial Review" data) to current exact labels.
// Value stored/used is always one of the ASSIGNMENT_TYPES (sensible short strings like "Initial").
function normalizeAssignmentType(val: any): 'Initial' | 'Review' | 'Three-Year Review' | 'Medication' {
  if (!val) return 'Initial';
  if (val === 'Initial Review' || val === 'InitialReview') return 'Initial';
  // If it's already a valid one from current constant, keep; else default
  if (ASSIGNMENT_TYPES.includes(val as any)) return val as any;
  return 'Initial';
}

interface CaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCase?: Case;
}

export function CaseDialog({ open, onOpenChange, existingCase }: CaseDialogProps) {
  const { addCase, editCase } = useAppStore();

  interface LocalCaseForm extends Omit<CaseFormData, 'hourlyRate'> {}

  const [form, setForm] = useState<LocalCaseForm>(() => ({
    respondentName: existingCase?.respondentName || '',
    caseNumber: (existingCase?.caseNumber || '').toUpperCase(),
    assignmentType: normalizeAssignmentType(existingCase?.assignmentType) || 'Initial',
    status: existingCase?.status || 'Open',
    firstTimeBilling: existingCase?.firstTimeBilling ?? false,
    caseNotes: existingCase?.caseNotes || '',
  }));

  const [caseNumberError, setCaseNumberError] = useState<string>('');

  const isEditing = !!existingCase;

  // Sync form when dialog opens or case changes (important for switching new/edit)
  useEffect(() => {
    if (open) {
      setForm({
        respondentName: existingCase?.respondentName || '',
        caseNumber: (existingCase?.caseNumber || '').toUpperCase(),
        assignmentType: normalizeAssignmentType(existingCase?.assignmentType) || 'Initial',
        status: existingCase?.status || 'Open',
        firstTimeBilling: existingCase?.firstTimeBilling ?? false,
        caseNotes: existingCase?.caseNotes || '',
      });
      setCaseNumberError('');
    }
  }, [open, existingCase]);

  const validateCaseNumber = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Case number is required.';
    }
    // Regex for common Alaska court case formats: uppercase letters, numbers, dashes
    if (!/^[0-9A-Z-]+$/.test(trimmed)) {
      return 'Case number must contain letters, numbers, and dashes only (e.g. 3AN-24-00123).';
    }
    return '';
  };

  const handleSubmit = async () => {
    const cnError = validateCaseNumber(form.caseNumber);
    setCaseNumberError(cnError);

    if (cnError) {
      return;
    }

    if (!form.respondentName.trim()) {
      toast.error('Respondent name is required.');
      return;
    }

    // Provide default hourlyRate (now managed at time entry level)
    const submitData: CaseFormData = {
      ...form,
      hourlyRate: existingCase?.hourlyRate ?? 0,
    };

    try {
      if (isEditing && existingCase) {
        await editCase(existingCase.id, submitData);
        toast.success('Case updated. Future You is pleased.');
      } else {
        await addCase(submitData);
        toast.success('Case created. Go log your shit.');
      }
      onOpenChange(false);
      // reset for next time
      if (!isEditing) {
        setForm({
          respondentName: '',
          caseNumber: '',
          assignmentType: 'Initial',
          status: 'Open',
          firstTimeBilling: false,
          caseNotes: '',
        });
        setCaseNumberError('');
      }
    } catch (e) {
      toast.error('Failed to save case.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Case' : 'New Case'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="respondent">Respondent Name</Label>
              <Input
                id="respondent"
                value={form.respondentName}
                onChange={(e) => setForm({ ...form, respondentName: e.target.value })}
                placeholder="Last, First"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="casenum">Case Number</Label>
              <Input
                id="casenum"
                value={form.caseNumber}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setForm({ ...form, caseNumber: upper });
                  setCaseNumberError(validateCaseNumber(upper));
                }}
                onBlur={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setCaseNumberError(validateCaseNumber(upper));
                }}
                placeholder="3AN-24-00123"
                className="mt-1.5 uppercase"
              />
              {caseNumberError && (
                <p className="text-xs text-destructive mt-1">{caseNumberError}</p>
              )}
            </div>
          </div>

          <div>
            <Label>Assignment Type</Label>
            <Select
              value={form.assignmentType}
              onValueChange={(val) => setForm({ ...form, assignmentType: val as any })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {/* Use ASSIGNMENT_TYPES for exact labels: "Initial", "Review", "Three-Year Review", "Medication".
                    value and displayed text are identical; sensible short values stored in DB. */}
                {ASSIGNMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(val) => setForm({ ...form, status: val as any })}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Open">Open</SelectItem>
                <SelectItem value="Closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="firstTime"
              checked={form.firstTimeBilling}
              onCheckedChange={(checked) => setForm({ ...form, firstTimeBilling: !!checked })}
            />
            <Label htmlFor="firstTime" className="cursor-pointer select-none">
              First time billing for this case
            </Label>
          </div>

          <div>
            <Label htmlFor="notes">Case Notes (optional)</Label>
            <Textarea
              id="notes"
              value={form.caseNotes}
              onChange={(e) => setForm({ ...form, caseNotes: e.target.value })}
              placeholder="Special instructions, prior contacts, etc."
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Create Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
