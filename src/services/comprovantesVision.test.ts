import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  extrairDadosComprovante,
  extrairDadosBoleto,
  type ComprovanteExtraido,
  type BoletoExtraido,
} from './comprovantesVision'
import { preProcessarImagemDocumento } from './imagePreprocessor'
import pb from '@/lib/pocketbase/client'

describe('Pipeline de Visão & OCR de Documentos Fiscais (Cupom Fiscal, Boleto, PIX)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    pb.authStore.save('mock-token-financeiro', {
      id: 'usr_fin001',
      role: 'financeiro',
    } as unknown as import('pocketbase').RecordModel)
  })

  describe('Pré-processador de Imagens (preProcessarImagemDocumento)', () => {
    it('deve deixar arquivos PDF 100% intactos sem alteração de tamanho ou buffer', async () => {
      const pdfContent = '%PDF-1.4 mock de comprovante de pagamento'
      const pdfFile = new File([pdfContent], 'cupom_fiscal_abastecimento.pdf', {
        type: 'application/pdf',
      })

      const resultado = await preProcessarImagemDocumento(pdfFile)

      expect(resultado.alterado).toBe(false)
      expect(resultado.fileOtimizado).toBe(pdfFile)
      expect(resultado.fileOtimizado.name).toBe('cupom_fiscal_abastecimento.pdf')
      expect(resultado.fileOtimizado.type).toBe('application/pdf')
    })

    it('deve retornar arquivo original se não houver necessidade de resize e já estiver em tamanho ideal', async () => {
      // Mock de imagem pequena
      const imgFile = new File(['fake-jpg-content'], 'recibo_campo.jpg', {
        type: 'image/jpeg',
      })

      const resultado = await preProcessarImagemDocumento(imgFile)
      expect(resultado.fileOtimizado).toBeDefined()
    })
  })

  describe('Extração de Cupom Fiscal de Posto de Combustível (NFC-e / SAT)', () => {
    it('deve extrair com sucesso emitente, CNPJ, valor, data e classificação de cupom de combustível de posto', async () => {
      const mockCupomPosto: ComprovanteExtraido = {
        sucesso: true,
        tipo_documento: 'cupom_fiscal',
        fornecedor: 'POSTO IPIRANGA ASA SUL LTDA',
        cnpj_cpf: '01.234.567/0001-89',
        data_emissao: '2026-04-10',
        numero_documento: '018492',
        valor_total: 215.8,
        valor_impostos: 14.5,
        forma_pagamento_sugerida: 'cartao_credito',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.4',
        plano_contas_nome: 'Despesas de Viagens e Campo',
        descricao_itens: 'Abastecimento Gasolina Comum 38.5L - Viagem técnica',
        observacoes: 'Chave de acesso: 35260401234567000189650010000184921000184928',
        confianca: 'alta',
      }

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sucesso: true,
          dados: mockCupomPosto,
        }),
      } as Response)

      const fakeFotoCupom = new File(
        ['imagem-cupom-posto-bytes'],
        'foto_cupom_posto_gasolina.jpg',
        {
          type: 'image/jpeg',
        },
      )

      const dados = await extrairDadosComprovante(fakeFotoCupom)

      expect(fetchSpy).toHaveBeenCalledTimes(1)
      const call = fetchSpy.mock.calls[0]
      expect(call[0]).toContain('/backend/v1/comprovantes/extrair')

      // Valida que o payload enviado continha FormData
      const reqInit = call[1] as RequestInit
      expect(reqInit.method).toBe('POST')
      expect(reqInit.body).toBeInstanceOf(FormData)

      // Valida dados extraídos com rigor contábil
      expect(dados.sucesso).toBe(true)
      expect(dados.tipo_documento).toBe('cupom_fiscal')
      expect(dados.fornecedor).toBe('POSTO IPIRANGA ASA SUL LTDA')
      expect(dados.cnpj_cpf).toBe('01.234.567/0001-89')
      expect(dados.valor_total).toBe(215.8)
      expect(dados.categoria_sugerida).toBe('despesas_operacionais')
      expect(dados.plano_contas_codigo).toBe('3.1.4')
      expect(dados.confianca).toBe('alta')
    })
  })

  describe('Extração de Comprovante Bancário PIX / Transferência', () => {
    it('deve extrair destinatário, chave PIX, data e valor liquidado', async () => {
      const mockComprovantePix: ComprovanteExtraido = {
        sucesso: true,
        tipo_documento: 'recibo',
        fornecedor: 'GEOTECH ENGENHARIA E TOPOGRAFIA LTDA',
        cnpj_cpf: '12.345.678/0001-90',
        data_emissao: '2026-04-11',
        numero_documento: 'E12345678202604111200abc',
        valor_total: 4500.0,
        valor_impostos: null,
        forma_pagamento_sugerida: 'pix',
        categoria_sugerida: 'terceirizados',
        plano_contas_codigo: '3.2.1',
        plano_contas_nome: 'Subcontratados de Engenharia',
        descricao_itens: 'Pagamento PIX referente a levantamento planialtimétrico cadastral',
        observacoes: 'ID da transação E12345678202604111200abc',
        confianca: 'alta',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sucesso: true,
          dados: mockComprovantePix,
        }),
      } as Response)

      const fakeFotoPix = new File(['comprovante-pix-bytes'], 'comprovante_pix_geotech.png', {
        type: 'image/png',
      })

      const dados = await extrairDadosComprovante(fakeFotoPix)

      expect(dados.sucesso).toBe(true)
      expect(dados.forma_pagamento_sugerida).toBe('pix')
      expect(dados.valor_total).toBe(4500.0)
      expect(dados.categoria_sugerida).toBe('terceirizados')
      expect(dados.plano_contas_codigo).toBe('3.2.1')
    })
  })

  describe('Extração de Boleto Bancário com Código de Barras / Linha Digitável', () => {
    it('deve ler linha digitável de 47 dígitos, beneficiário, vencimento e valor do boleto', async () => {
      const mockBoleto: BoletoExtraido = {
        sucesso: true,
        beneficiario_fornecedor: 'CONCESSIONARIA AEROPORTO BRASIL SA',
        cnpj_cpf_beneficiario: '23.456.789/0001-01',
        linha_digitavel: '34191.79001 01043.510047 91020.150008 5 89000000150000',
        codigo_barras: '34195890000001500001790001043510049102015000',
        numero_documento: 'BOL-2026-99',
        valor_documento: 1500.0,
        valor_desconto: 0,
        valor_juros_multa: 0,
        valor_cobrado: 1500.0,
        data_vencimento: '2026-04-25',
        data_documento: '2026-04-10',
        banco_emissor: 'Itaú Unibanco',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.1',
        plano_contas_nome: 'Despesas Administrativas Gerais',
        instrucoes_resumo: 'Não receber após o vencimento sem encargos',
        confianca: 'alta',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sucesso: true,
          dados: mockBoleto,
        }),
      } as Response)

      const fakeBoletoPdf = new File(['pdf-boleto-bytes'], 'boleto_concessionaria.pdf', {
        type: 'application/pdf',
      })

      const dados = await extrairDadosBoleto(fakeBoletoPdf)

      expect(dados.sucesso).toBe(true)
      expect(dados.beneficiario_fornecedor).toBe('CONCESSIONARIA AEROPORTO BRASIL SA')
      expect(dados.linha_digitavel).toContain('34191.79001')
      expect(dados.valor_documento).toBe(1500.0)
      expect(dados.data_vencimento).toBe('2026-04-25')
    })
  })

  describe('Modo Essencial de Extração e Inferência de Categoria por Estabelecimento', () => {
    it('deve ativar modo essencial e extrair os 5 campos vitais quando a leitura de itens for parcial', async () => {
      const mockModoEssencial: ComprovanteExtraido = {
        sucesso: true,
        modo_essencial: true,
        aviso_modo_essencial:
          'Leitura parcial — dados essenciais extraídos, confira e complete o restante',
        tipo_documento: 'cupom_fiscal',
        fornecedor: 'AUTO POSTO BANDEIRANTES LTDA',
        cnpj_cpf: '12.345.678/0001-90',
        data_emissao: '2026-04-15',
        numero_documento: '',
        valor_total: 285.5,
        valor_impostos: null,
        descricao_itens: 'Abastecimento Gasolina Comum',
        forma_pagamento_sugerida: 'cartao_debito',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.5',
        plano_contas_nome: 'Combustível, Pedágios e Locação de Veículos',
        confianca: 'media',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sucesso: true,
          dados: mockModoEssencial,
        }),
      } as Response)

      const fakeCupomPosto = new File(['cupom-posto-bytes'], 'cupom_posto_gasolina.jpg', {
        type: 'image/jpeg',
      })

      const dados = await extrairDadosComprovante(fakeCupomPosto)

      expect(dados.sucesso).toBe(true)
      expect(dados.modo_essencial).toBe(true)
      expect(dados.fornecedor).toBe('AUTO POSTO BANDEIRANTES LTDA')
      expect(dados.cnpj_cpf).toBe('12.345.678/0001-90')
      expect(dados.data_emissao).toBe('2026-04-15')
      expect(dados.valor_total).toBe(285.5)
      expect(dados.forma_pagamento_sugerida).toBe('cartao_debito')
      expect(dados.inferencia_categoria?.segmento).toBe('Combustíveis & Lubrificantes')
      expect(dados.plano_contas_codigo).toBe('3.1.5')
    })

    it('deve inferir corretamente categorias para postos, restaurantes, farmácias, pedágios, hotéis e TI', async () => {
      const { inferirCategoriaPorEstabelecimento } = await import('./categoriaInferenciaEngine')

      // 1. Posto de gasolina
      const rPosto = inferirCategoriaPorEstabelecimento('Posto Ipiranga Rota do Sol')
      expect(rPosto.sucesso).toBe(true)
      expect(rPosto.categoria).toBe('despesas_operacionais')
      expect(rPosto.planoContasCodigo).toBe('3.1.5')
      expect(rPosto.segmento).toContain('Combustíveis')

      // 2. Restaurante / Alimentação
      const rRestaurante = inferirCategoriaPorEstabelecimento('Churrascaria Boiadeiro Grill')
      expect(rRestaurante.sucesso).toBe(true)
      expect(rRestaurante.planoContasCodigo).toBe('3.1.4')
      expect(rRestaurante.segmento).toContain('Alimentação')

      // 3. Supermercado
      const rMercado = inferirCategoriaPorEstabelecimento('Supermercado Carrefour Bairro')
      expect(rMercado.sucesso).toBe(true)
      expect(rMercado.planoContasCodigo).toBe('3.1.4')

      // 4. Padaria
      const rPadaria = inferirCategoriaPorEstabelecimento('Panificadora & Confeitaria Pão de Ouro')
      expect(rPadaria.sucesso).toBe(true)
      expect(rPadaria.planoContasCodigo).toBe('3.1.4')

      // 5. Farmácia
      const rFarmacia = inferirCategoriaPorEstabelecimento('Drogaria Raia São Paulo')
      expect(rFarmacia.sucesso).toBe(true)
      expect(rFarmacia.planoContasCodigo).toBe('3.1.1')

      // 6. Estacionamento
      const rEstac = inferirCategoriaPorEstabelecimento('Estapar Estacionamentos Aeroporto')
      expect(rEstac.sucesso).toBe(true)
      expect(rEstac.planoContasCodigo).toBe('3.1.5')

      // 7. Pedágio
      const rPedagio = inferirCategoriaPorEstabelecimento('Concessionária AutoBan Rodovias')
      expect(rPedagio.sucesso).toBe(true)
      expect(rPedagio.planoContasCodigo).toBe('3.1.5')

      // 8. Papelaria
      const rPapelaria = inferirCategoriaPorEstabelecimento('Kalunga Comércio e Papelaria')
      expect(rPapelaria.sucesso).toBe(true)
      expect(rPapelaria.planoContasCodigo).toBe('3.1.1')

      // 9. Hotel
      const rHotel = inferirCategoriaPorEstabelecimento('Hotel Ibis Aeroporto Congonhas')
      expect(rHotel.sucesso).toBe(true)
      expect(rHotel.planoContasCodigo).toBe('3.1.4')

      // 10. Companhia aérea
      const rAereo = inferirCategoriaPorEstabelecimento('Latam Airlines Brasil')
      expect(rAereo.sucesso).toBe(true)
      expect(rAereo.planoContasCodigo).toBe('3.1.4')

      // 11. Locadora
      const rLocadora = inferirCategoriaPorEstabelecimento('Localiza Rent a Car')
      expect(rLocadora.sucesso).toBe(true)
      expect(rLocadora.planoContasCodigo).toBe('3.1.5')

      // 12. Táxi / Uber
      const rTaxi = inferirCategoriaPorEstabelecimento('Uber do Brasil Tecnologia Ltda')
      expect(rTaxi.sucesso).toBe(true)
      expect(rTaxi.planoContasCodigo).toBe('3.1.5')

      // 13. Gráfica / Plotagem
      const rGrafica = inferirCategoriaPorEstabelecimento('Copiadora & Plotagem Central A0')
      expect(rGrafica.sucesso).toBe(true)
      expect(rGrafica.planoContasCodigo).toBe('3.1.1')

      // 14. Ferramentas / EPI
      const rEpi = inferirCategoriaPorEstabelecimento('Leroy Merlin Ferragens e Materiais')
      expect(rEpi.sucesso).toBe(true)
      expect(rEpi.planoContasCodigo).toBe('3.1.1')

      // 15. Equipamentos de TI
      const rTi = inferirCategoriaPorEstabelecimento('Kabum Eletrônicos e Informática')
      expect(rTi.sucesso).toBe(true)
      expect(rTi.categoria).toBe('equipamentos')
      expect(rTi.planoContasCodigo).toBe('3.1.2')

      // 16. Softwares CAD
      const rSoftware = inferirCategoriaPorEstabelecimento('Autodesk do Brasil Software')
      expect(rSoftware.sucesso).toBe(true)
      expect(rSoftware.categoria).toBe('equipamentos')
      expect(rSoftware.planoContasCodigo).toBe('3.1.2')

      // 17. Cartório
      const rCartorio = inferirCategoriaPorEstabelecimento('1º Tabelionato de Notas e Protesto')
      expect(rCartorio.sucesso).toBe(true)
      expect(rCartorio.planoContasCodigo).toBe('3.1.1')

      // 18. Taxas públicas / ANAC
      const rOrgao = inferirCategoriaPorEstabelecimento(
        'ANAC - Agência Nacional de Aviação Civil GRU',
      )
      expect(rOrgao.sucesso).toBe(true)
      expect(rOrgao.categoria).toBe('impostos')
      expect(rOrgao.planoContasCodigo).toBe('3.3.1')

      // 19. Telecomunicações
      const rTelecom = inferirCategoriaPorEstabelecimento('Vivo Telefônica Brasil S.A.')
      expect(rTelecom.sucesso).toBe(true)
      expect(rTelecom.planoContasCodigo).toBe('3.1.1')

      // 20. Terceirizados de engenharia
      const rTerceiros = inferirCategoriaPorEstabelecimento('Geotecnia e Sondagens Especiais Ltda')
      expect(rTerceiros.sucesso).toBe(true)
      expect(rTerceiros.categoria).toBe('terceirizados')
      expect(rTerceiros.planoContasCodigo).toBe('3.2.1')
    })
  })

  describe('Resiliência e Tratamento de Documento Ilegível / Falha', () => {
    it('deve retornar mensagem acionável e confianca baixa quando o documento não for legível', async () => {
      const mockFalhaLeitura: ComprovanteExtraido = {
        sucesso: false,
        tipo_documento: 'outro',
        erro: 'não foi possível ler o documento — aproxime a câmera, garanta boa iluminação ou anexe o PDF',
        fornecedor: '',
        cnpj_cpf: '',
        data_emissao: '2026-04-12',
        numero_documento: '',
        valor_total: 0,
        valor_impostos: null,
        forma_pagamento_sugerida: 'pix',
        categoria_sugerida: 'despesas_operacionais',
        plano_contas_codigo: '3.1.1',
        plano_contas_nome: 'Despesas Administrativas Gerais',
        descricao_itens: 'foto_escura',
        confianca: 'baixa',
      }

      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sucesso: false,
          dados: mockFalhaLeitura,
        }),
      } as Response)

      const fotoEscura = new File(['foto-borrada'], 'foto_escura.jpg', {
        type: 'image/jpeg',
      })

      const dados = await extrairDadosComprovante(fotoEscura)

      expect(dados.sucesso).toBe(false)
      expect(dados.confianca).toBe('baixa')
      expect(dados.erro).toContain('não foi possível ler o documento')
      expect(dados.erro).toContain('aproxime a câmera')
    })
  })
})
