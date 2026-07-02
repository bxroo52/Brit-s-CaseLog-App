'use client';

import { useState } from 'react';
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

  const [form, setForm] = useState<CaseFormData>(() => ({
    respondentName: existingCase?.respondentName || '',
    caseNumber: existingCase?.caseNumber || '',
    assignmentType: existingCase?.assignmentType || 'Initial Review',
    status: existingCase?.status || 'Open',
    hourlyRate: existingCase?.hourlyRate || 85,
    firstTimeBilling: existingCase?.firstTimeBilling ?? false,
    caseNotes: existingCase?.caseNotes || '',
  }));

  const isEditing = !!existingCase;

  const handleSubmit = async () => {
    if (!form.respondentName.trim() || !form.caseNumber.trim()) {
      toast.error('Respondent name and case number are required.');
      return;
    }
    if (form.hourlyRate <= 0) {
      toast.error('Hourly rate must be greater than zero.');
      return;
    }

    try {
      if (isEditing && existingCase) {
        await editCase(existingCase.id, form);
        toast.success('Case updated. Future You is pleased.');
      } else {
        await addCase(form);
        toast.success('Case created. Go log your shit.');
      }
      onOpenChange(false);
      // reset for next time
      if (!isEditing) {
        setForm({
          respondentName: '',
          caseNumber: '',
          assignmentType: 'Initial Review',
          status: 'Open',
          hourlyRate: 85,
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
              <p className="text-[10px] text-muted-foreground mt-0.5">Always text. Never a number.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  {ASSIGNMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hourly Rate</Label>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => setForm({ ...form, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="pl-7"
                />
              </div>
            </div>
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
