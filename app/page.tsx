import TeaserPage from '@/components/marketing/TeaserPage'
import BrowsePageStub from '@/components/marketing/BrowsePageStub'

const LAUNCHED = process.env.NEXT_PUBLIC_LAUNCHED === 'true'

export default function Home() {
  return LAUNCHED ? <BrowsePageStub /> : <TeaserPage />
}
