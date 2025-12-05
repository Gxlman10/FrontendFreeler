import LeadsAdmin from '@/pages/crm/LeadsAdmin';
import { t } from '@/i18n';

export const LeadsVendedor = () => {
  return (
    <LeadsAdmin
      variant="vendor"
      showOriginColumn={false}
      showOriginFilter={false}
      title={t('crmVendorLeads.title')}
      subtitle={t('crmVendorLeads.subtitle')}
    />
  );
};

export default LeadsVendedor;
