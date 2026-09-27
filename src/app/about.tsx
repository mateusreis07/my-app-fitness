import { useTranslation } from 'react-i18next';

import { Card, Copy, IconTile, NavButton, Page } from '@/components/ui';
import { theme } from '@/theme/tokens';

export default function AboutScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('about.title')} subtitle={t('about.body')}>
      <Card>
        <IconTile name="sun" />
        <Copy style={{ fontSize: 20, fontWeight: '600' }}>{t('about.purposeTitle')}</Copy>
        <Copy>{t('about.purposeBody')}</Copy>
      </Card>
      <Card>
        <Copy style={{ fontWeight: '600' }}>{t('about.previewTitle')}</Copy>
        <Copy>{t('about.previewBody')}</Copy>
      </Card>
      <Copy style={{ color: theme.colors.muted, fontSize: 13 }}>{t('about.wellness')}</Copy>
      <NavButton href="/" label={t('common.backHome')} />
    </Page>
  );
}
