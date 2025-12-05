import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CampaignService } from '@/services/campaign.service';
import type { Campaign } from '@/services/campaign.service';
import { SearchBar } from '@/components/common/SearchBar';
import { CampaignGrid } from '@/components/common/CampaignGrid';
import { CampaignCard } from '@/components/common/CampaignCard';
import { Dialog } from '@/components/ui/Dialog';
import { LeadFormModal } from '@/components/common/LeadFormModal';
import { EmptyState } from '@/components/common/EmptyState';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/store/auth';
import { useToast } from '@/components/common/Toasts';
import { APP_ROUTES } from '@/utils/constants';
import { formatCurrency, formatDate } from '@/utils/helpers';
import { t } from '@/i18n';

type Filters = {
  search?: string;
};

export const Home = () => {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>({});
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const queryFilters = useMemo(
    () => ({
      ...(filters.search ? { search: filters.search } : {}),
    }),
    [filters],
  );

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['campaigns', queryFilters],
    queryFn: () => CampaignService.getAll(queryFilters),
  });

  const campaigns = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

  const handleSearch = (term: string) => {
    setFilters((prev) => ({ ...prev, search: term || undefined }));
  };

  const campaignDetailQuery = useQuery({
    queryKey: ['campaign-detail', selectedCampaignId],
    queryFn: () => CampaignService.getById(selectedCampaignId ?? 0),
    enabled: selectedCampaignId !== null,
  });

  useEffect(() => {
    if (campaignDetailQuery.data) {
      setSelectedCampaign(campaignDetailQuery.data as Campaign);
    }
  }, [campaignDetailQuery.data]);

  const handleRefer = (campaign: Campaign) => {
    if (!user || user.type !== 'freeler') {
      push({
        title: 'Inicia sesion como Freeler',
        description: 'Necesitas iniciar sesion para crear un referido.',
        variant: 'warning',
      });
      navigate(APP_ROUTES.referidos.login);
      return;
    }
    setSelectedCampaign(campaign);
    setLeadModalOpen(true);
  };

  const handleOpenDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedCampaignId(campaign.id_campania);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-content">{t('referidosHome.title')}</h1>
            <p className="text-sm text-content-muted">{t('referidosHome.subtitle')}</p>
          </div>
          <div className="w-full lg:max-w-md">
            <SearchBar
              onSearch={handleSearch}
              placeholder={t('referidosHome.searchPlaceholder')}
              className="flex-nowrap"
              stackOnMobile={false}
            />
          </div>
        </div>
      </section>

      {isError && (
        <EmptyState
          title={t('referidosHome.errorTitle')}
          description={t('referidosHome.errorDescription')}
          actionLabel={t('referidosHome.errorAction')}
          onAction={() => refetch()}
        />
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-48 animate-pulse rounded-lg border border-border bg-surface-muted"
            />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <EmptyState
          title={t('referidosHome.emptyTitle')}
          description={t('referidosHome.emptyDescription')}
        />
      ) : (
        <CampaignGrid>
          {campaigns.map((campaign) => {
            const commissionValue =
              typeof campaign.comision === 'string' ? Number(campaign.comision) : campaign.comision;
            return (
              <CampaignCard
                key={campaign.id_campania}
                name={campaign.nombre}
                commission={commissionValue}
                company={campaign.empresa?.razon_social ?? undefined}
                location={campaign.ubicacion ?? undefined}
                startDate={campaign.fecha_inicio}
                endDate={campaign.fecha_fin}
                referidosCount={campaign.totalReferidos}
                onOpen={() => handleOpenDetails(campaign)}
                onRefer={() => handleRefer(campaign)}
                disabledRefer={!user || user.type !== 'freeler'}
              />
            );
          })}
        </CampaignGrid>
      )}

      <Dialog
        open={Boolean(selectedCampaign)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCampaign(null);
            setSelectedCampaignId(null);
          }
        }}
        title={selectedCampaign?.nombre}
        description={selectedCampaign?.descripcion ?? 'Esta campana no tiene descripcion.'}
        footer={
          selectedCampaign ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSelectedCampaign(null)}>
                Cerrar
              </Button>
              <Button onClick={() => handleRefer(selectedCampaign)}>Anadir referido</Button>
            </div>
          ) : undefined
        }
      >
        {selectedCampaign ? (
          <div className="space-y-3 text-sm text-content">
            <div>
              <p className="text-xs uppercase text-content-muted">Empresa</p>
              <p className="font-medium">{selectedCampaign.empresa?.razon_social ?? 'Sin empresa asociada'}</p>
              {selectedCampaign.empresa?.ruc && (
                <p className="text-xs text-content-subtle">RUC {selectedCampaign.empresa.ruc}</p>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-content-muted">Vigencia</p>
                <p className="font-medium">
                  {formatDate(selectedCampaign.fecha_inicio)} - {formatDate(selectedCampaign.fecha_fin)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-content-muted">Ubicacion</p>
                <p className="font-medium">{selectedCampaign.ubicacion ?? 'No especificada'}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase text-content-muted">Comision estimada</p>
              <p className="text-lg font-semibold">{formatCurrency(Number(selectedCampaign.comision) || 0)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-content-muted">Referidos totales</p>
              <Badge variant="outline">{selectedCampaign.totalReferidos ?? 0}</Badge>
            </div>
          </div>
        ) : null}
      </Dialog>

      <LeadFormModal
        open={leadModalOpen}
        onClose={() => {
          setLeadModalOpen(false);
          setSelectedCampaign(null);
          setSelectedCampaignId(null);
        }}
        campaignId={selectedCampaign?.id_campania}
      />
    </div>
  );
};

export default Home;
