import { SectionHeader } from '@/components/common/SectionHeader'
import { MensagensView } from '@/components/chat/MensagensView'

export function MensagensPage() {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Mensagens & Comunicação Interna"
        description="Troca de informações em tempo real entre operadores e perfis da AEROCAD."
      />
      <MensagensView />
    </div>
  )
}

export default MensagensPage
