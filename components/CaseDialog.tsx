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
    caseNumber: existingCase?.caseNumber || '',
    assignmentType: ((existingCase?.assignmentType as any) === 'Initial Review' ? 'Initial' : existingCase?.assignmentType) || 'Initial',
    status: existingCase?.status || 'Open',
    firstTimeBilling: existingCase?.firstTimeBilling ?? false,
    caseNotes: existingCase?.caseNotes || '',
  }));

  const isEditing = !!existingCase;

  // Sync form when dialog opens or case changes (important for switching new/edit)
  useEffect(() => {
    if (open) {
      setForm({
        respondentName: existingCase?.respondentName || '',
        caseNumber: existingCase?.caseNumber || '',
        assignmentType: ((existingCase?.assignmentType as any) === 'Initial Review' ? 'Initial' : existingCase?.assignmentType) || 'Initial',
        status: existingCase?.status || 'Open',
        firstTimeBilling: existingCase?.firstTimeBilling ?? false,
        caseNotes: existingCase?.caseNotes || '',
      });
    }
  }, [open, existingCase]);

  const handleSubmit = async () => {
    if (!form.respondentName.trim() || !form.caseNumber.trim()) {
      toast.error('Respondent name and case number are required.');
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

        <div className="space-y-4 py-2">
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
                onChange={(e) => setForm({ ...form, caseNumber: e.target.value })}
                placeholder="3AN-24-00123"
                className="mt-1.5"
              />
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
                {/* Render in exact desired order from ASSIGNMENT_TYPES */}
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
