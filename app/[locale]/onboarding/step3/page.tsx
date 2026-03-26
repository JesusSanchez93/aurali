import { getCatalogBanks } from './actions';
import { BanksSetupForm } from './_components/banks-setup-form';

export default async function Step3Page() {
  const catalogBanks = await getCatalogBanks();
  return <BanksSetupForm catalogBanks={catalogBanks} />;
}
