import { Dialog } from '@/components/ui/Dialog';
import type { Lead } from '@/services/lead.service';
import { LeadForm } from './LeadForm';

type LeadFormModalProps = {
  open: boolean;
  onClose: () => void;
  campaignId?: number;
  lead?: Lead | null;
  onCompleted?: (leadId: number, status: 'draft' | 'sent') => void;
};

export const LeadFormModal = ({ open, onClose, campaignId, lead, onCompleted }: LeadFormModalProps) => (
  <Dialog
    open={open}
    onOpenChange={(value) => {
      if (!value) onClose();
    }}
    title={lead ? 'Editar referido' : 'Anadir referido'}
  >
    <LeadForm
      campaignId={campaignId}
      lead={lead}
      onSubmitted={(leadId, status) => {
        onCompleted?.(leadId, status);
        onClose();
      }}
    />
  </Dialog>
);
