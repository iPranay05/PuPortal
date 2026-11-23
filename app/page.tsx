import Workspace from '@/components/accreditation-workspace'
import catalog from '@/lib/catalog.json'

export default function Page() {
  return <Workspace initialCatalog={catalog} />
}
