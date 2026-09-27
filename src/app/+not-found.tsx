import { useTranslation } from 'react-i18next';
import { NavButton, Page } from '@/components/ui';

export default function NotFoundScreen() {
  const { t } = useTranslation();
  return (
    <Page title={t('error.notFoundTitle')} subtitle={t('error.notFoundBody')}>
      <NavButton href="/" label={t('common.backHome')} />
    </Page>
  );
}
