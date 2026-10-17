/**
 * Template oficial AEROCAD para impressão e salvamento em PDF (formato A4)
 * de relatórios contábeis e financeiros, balancetes e demonstrativos gerenciais.
 * Identidade: Laranja #FF6A13, cinza escuro #2D2D2D, tipografia Arial técnica,
 * logotipo oficial, tabela zebrada limpa e rodapé com emissão e responsabilidade técnica.
 */

import React from 'react'
import { AerocadLogo } from '@/components/common/AerocadLogo'
import { INSTITUTIONAL_DATA } from '@/lib/documentCatalogo'
import { isValoresOcultos, VALOR_MASCARADO } from '@/lib/format'

export interface RelatorioA4Props {
  titulo: string
  subtitulo?: string
  referenciaPeriodo?: string
  responsavelNome?: string
  dataEmissao?: string
  orientacao?: 'portrait' | 'landscape'
  resumoKpis?: Array<{
    rotulo: string
    valorFormatado: string
    destaque?: boolean
    cor?: 'laranja' | 'verde' | 'vermelho' | 'neutro'
  }>
  secoes?: Array<{
    titulo: string
    subtitulo?: string
    tabela?: {
      colunas: Array<{
        cabecalho: string
        alinhamento?: 'left' | 'center' | 'right'
        largura?: string
      }>
      linhas: Array<
        Array<{
          conteudo: React.ReactNode | string
          alinhamento?: 'left' | 'center' | 'right'
          destaque?: boolean
        }>
      >
      linhaTotal?: Array<{
        conteudo: React.ReactNode | string
        alinhamento?: 'left' | 'center' | 'right'
        destaque?: boolean
      }>
    }
    conteudoLivre?: React.ReactNode
  }>
  observacoesFinais?: string
}

export function AerocadRelatorioA4({
  titulo = 'Relatório Contábil AEROCAD',
  subtitulo,
  referenciaPeriodo,
  responsavelNome,
  dataEmissao,
  orientacao = 'portrait',
  resumoKpis = [],
  secoes = [],
  observacoesFinais,
}: RelatorioA4Props) {
  const ocultar = isValoresOcultos()
  const dataHoje = dataEmissao || new Date().toLocaleDateString('pt-BR')
  const horaHoje = new Date().toLocaleTimeString('pt-BR')
  const isLandscape = orientacao === 'landscape'

  return (
    <div
      id="print-document"
      className={`bg-white text-[#2D2D2D] font-sans p-8 print:p-0 ${
        isLandscape ? 'max-w-[297mm] min-h-[210mm] landscape-mode' : 'max-w-[210mm] min-h-[297mm]'
      } mx-auto flex flex-col justify-between text-xs`}
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div>
        {/* Cabeçalho Oficial AEROCAD */}
        <header className="border-b-2 border-[#FF6A13] pb-4 mb-6 aerocad-doc-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="aerocad-logo-header-wrapper shrink-0">
                <AerocadLogo
                  className="h-9 w-auto max-w-[190px] object-contain block"
                  style={{ maxHeight: '38px', maxWidth: '190px', width: 'auto', height: '38px' }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#FF6A13] uppercase">
                  {INSTITUTIONAL_DATA.nomeComercial}
                </p>
                <h1 className="text-base sm:text-lg font-black text-[#2D2D2D] tracking-tight uppercase leading-tight">
                  {titulo}
                </h1>
                <p className="text-[9px] text-neutral-500 font-mono mt-0.5">
                  {INSTITUTIONAL_DATA.razaoSocial} · CNPJ {INSTITUTIONAL_DATA.cnpj}
                </p>
              </div>
            </div>

            <div className="text-right font-mono text-[10px] text-neutral-500 space-y-0.5">
              <div>
                Referência:{' '}
                <strong className="text-neutral-800">
                  {referenciaPeriodo || 'Exercício Corrente'}
                </strong>
              </div>
              <div>
                Emissão: {dataHoje} · {horaHoje}
              </div>
              {responsavelNome && <div>Emissor: {responsavelNome}</div>}
            </div>
          </div>

          {subtitulo && (
            <p className="text-[11px] text-neutral-600 mt-2 font-medium italic">{subtitulo}</p>
          )}

          {ocultar && (
            <div className="mt-2 text-[10px] bg-amber-50 text-amber-800 border border-amber-300 px-2 py-0.5 rounded font-semibold">
              ATENÇÃO: Valores exportados em modo de privacidade mascarado ({VALOR_MASCARADO}).
            </div>
          )}
        </header>

        {/* Bloco de KPIs se fornecido */}
        {resumoKpis && resumoKpis.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {resumoKpis.map((kpi, idx) => {
              const corEstilo =
                kpi.cor === 'verde'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : kpi.cor === 'vermelho'
                    ? 'border-rose-300 bg-rose-50 text-rose-900'
                    : kpi.cor === 'laranja' || kpi.destaque
                      ? 'border-orange-300 bg-orange-50/70 text-[#D65100]'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-800'

              return (
                <div key={idx} className={`p-3 rounded-lg border ${corEstilo}`}>
                  <p className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                    {kpi.rotulo}
                  </p>
                  <p className="text-base font-black font-mono mt-1">{kpi.valorFormatado}</p>
                </div>
              )
            })}
          </div>
        )}

        {/* Seções e Tabelas */}
        <div className="space-y-6">
          {(secoes || []).map((sec, secIdx) => (
            <section key={secIdx} className="space-y-2.5">
              <div className="border-l-4 border-[#FF6A13] pl-2.5 py-0.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                  {sec?.titulo || 'Seção'}
                </h2>
                {sec?.subtitulo && <p className="text-[10px] text-neutral-500">{sec.subtitulo}</p>}
              </div>

              {sec?.tabela && (
                <div className="border border-neutral-200 rounded overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-[#2D2D2D] text-white">
                        {(sec.tabela.colunas || []).map((col, colIdx) => (
                          <th
                            key={colIdx}
                            style={{ width: col?.largura }}
                            className={`px-3 py-2 font-bold tracking-tight ${
                              col?.alinhamento === 'right'
                                ? 'text-right'
                                : col?.alinhamento === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {col?.cabecalho || ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                      {(sec.tabela.linhas || []).map((row, rowIdx) => (
                        <tr
                          key={rowIdx}
                          className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/70'}
                        >
                          {(row || []).map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-3 py-2 ${
                                cell?.alinhamento === 'right'
                                  ? 'text-right font-mono'
                                  : cell?.alinhamento === 'center'
                                    ? 'text-center'
                                    : 'text-left'
                              } ${cell?.destaque ? 'font-bold text-neutral-900' : 'text-neutral-700'}`}
                            >
                              {cell?.conteudo !== undefined && cell?.conteudo !== null
                                ? cell.conteudo
                                : '—'}
                            </td>
                          ))}
                        </tr>
                      ))}

                      {sec.tabela.linhaTotal && (
                        <tr className="bg-[#FFF6EC] border-t-2 border-[#FF6A13] font-bold text-neutral-900">
                          {sec.tabela.linhaTotal.map((cell, cellIdx) => (
                            <td
                              key={cellIdx}
                              className={`px-3 py-2.5 ${
                                cell?.alinhamento === 'right'
                                  ? 'text-right font-mono text-[#D65100]'
                                  : cell?.alinhamento === 'center'
                                    ? 'text-center'
                                    : 'text-left'
                              }`}
                            >
                              {cell?.conteudo !== undefined && cell?.conteudo !== null
                                ? cell.conteudo
                                : '—'}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {sec?.conteudoLivre}
            </section>
          ))}
        </div>

        {observacoesFinais && (
          <div className="mt-6 p-3 bg-neutral-50 rounded border border-neutral-200 text-[10px] text-neutral-600 space-y-1">
            <strong className="block font-bold text-neutral-800 uppercase tracking-wider">
              Notas Explicativas:
            </strong>
            <p>{observacoesFinais}</p>
          </div>
        )}
      </div>

      {/* Rodapé Oficial da Prancheta AEROCAD */}
      <footer className="border-t border-neutral-300 pt-4 mt-8">
        <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono">
          <div>
            {INSTITUTIONAL_DATA.nomeComercial} · {INSTITUTIONAL_DATA.razaoSocial} · CNPJ{' '}
            {INSTITUTIONAL_DATA.cnpj} · CHAVE PIX: {INSTITUTIONAL_DATA.chavePix}
          </div>
          <div>Documento Oficial emitido pelo CRM AEROCAD · Folha 1/1</div>
        </div>
        <div className="text-[8px] text-neutral-400 font-mono mt-1">
          {INSTITUTIONAL_DATA.endereco}
        </div>
      </footer>
    </div>
  )
}
