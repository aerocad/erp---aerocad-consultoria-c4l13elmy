import { parseNumero } from './importacaoParser'
import { parseXmlNfse } from './nfseParser'

// Teste unitário e de conformidade para o bug de escala 100x
export function testarNfseParseConformidade(): {
  sucesso: boolean
  resultados: { teste: string; esperado: number; obtido: number; ok: boolean }[]
} {
  const casosNumero = [
    { entrada: '8320.00', esperado: 8320 },
    { entrada: '1234.56', esperado: 1234.56 },
    { entrada: '8.320,00', esperado: 8320 },
    { entrada: '1.234,56', esperado: 1234.56 },
    { entrada: 'R$ 8.320,00', esperado: 8320 },
    { entrada: 'R$ 1.234,56', esperado: 1234.56 },
    { entrada: '8320', esperado: 8320 },
    { entrada: '1234', esperado: 1234 },
    { entrada: 8320, esperado: 8320 },
    { entrada: 1234.56, esperado: 1234.56 },
    { entrada: '8.320', esperado: 8320 },
    { entrada: '100.000', esperado: 100000 },
    { entrada: '100.000,50', esperado: 100000.5 },
    { entrada: '100000.50', esperado: 100000.5 },
  ]

  const resultados = casosNumero.map((c) => {
    const obtido = parseNumero(c.entrada)
    return {
      teste: `parseNumero("${c.entrada}")`,
      esperado: c.esperado,
      obtido,
      ok: Math.abs(obtido - c.esperado) < 0.001,
    }
  })

  // Teste com XML real no padrão ABRASF / GDF / SisGoV
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd">
  <Nfse>
    <InfNfse>
      <Numero>20260012</Numero>
      <CodigoVerificacao>ABC123XYZ</CodigoVerificacao>
      <DataEmissao>2026-10-10T14:30:00</DataEmissao>
      <ValoresNfse>
        <ValorServicos>8320.00</ValorServicos>
        <ValorLiquidoNfse>8320.00</ValorLiquidoNfse>
        <ValorIssRetido>166.40</ValorIssRetido>
      </ValoresNfse>
      <TomadorServico>
        <IdentificacaoTomador>
          <CpfCnpj>
            <Cnpj>00000000000191</Cnpj>
          </CpfCnpj>
        </IdentificacaoTomador>
        <RazaoSocial>EMPRESA EXEMPLO LTDA</RazaoSocial>
        <Endereco>
          <Endereco>SCS Quadra 04 Bloco A</Endereco>
          <Numero>100</Numero>
          <Bairro>Asa Sul</Bairro>
          <Municipio>Brasília</Municipio>
          <Uf>DF</Uf>
          <Cep>70304000</Cep>
        </Endereco>
        <Contato>
          <Email>contato@exemplo.com.br</Email>
          <Telefone>61988887777</Telefone>
        </Contato>
      </TomadorServico>
      <Servico>
        <Discriminacao>Elaboração de PBZPA / OPEA Projeto 2026-232</Discriminacao>
      </Servico>
    </InfNfse>
  </Nfse>
</CompNfse>`

  try {
    const parsedXml = parseXmlNfse(sampleXml)
    if (parsedXml.length > 0) {
      resultados.push({
        teste: 'parseXmlNfse (ABRASF 8320.00)',
        esperado: 8320,
        obtido: parsedXml[0].valorBruto,
        ok: Math.abs(parsedXml[0].valorBruto - 8320) < 0.001,
      })
      resultados.push({
        teste: 'parseXmlNfse ISS retido (ABRASF 166.40)',
        esperado: 166.4,
        obtido: parsedXml[0].issRetido || 0,
        ok: Math.abs((parsedXml[0].issRetido || 0) - 166.4) < 0.001,
      })
      resultados.push({
        teste: 'parseXmlNfse tomador município extraído',
        esperado: 1,
        obtido:
          parsedXml[0].tomadorMunicipio === 'Brasília' && parsedXml[0].tomadorUf === 'DF' ? 1 : 0,
        ok: parsedXml[0].tomadorMunicipio === 'Brasília' && parsedXml[0].tomadorUf === 'DF',
      })
    }
  } catch (err: unknown) {
    resultados.push({
      teste: 'parseXmlNfse erro',
      esperado: 8320,
      obtido: -1,
      ok: false,
    })
  }

  // Teste 2 com R$ 1.234,56
  const sampleXml2 = `<?xml version="1.0" encoding="UTF-8"?>
<NFS-e>
  <infNfse>
    <nNfse>20260099</nNfse>
    <dhEmi>2026-10-10</dhEmi>
    <vServ>1234.56</vServ>
    <vLiq>1234.56</vLiq>
    <Tomador>
      <xNome>CLIENTE TESTE CENTAVOS</xNome>
    </Tomador>
    <xServ>Serviço técnico com centavos</xServ>
  </infNfse>
</NFS-e>`

  try {
    const parsedXml2 = parseXmlNfse(sampleXml2)
    if (parsedXml2.length > 0) {
      resultados.push({
        teste: 'parseXmlNfse (1234.56)',
        esperado: 1234.56,
        obtido: parsedXml2[0].valorBruto,
        ok: Math.abs(parsedXml2[0].valorBruto - 1234.56) < 0.001,
      })
    }
  } catch {
    resultados.push({
      teste: 'parseXmlNfse 2 erro',
      esperado: 1234.56,
      obtido: -1,
      ok: false,
    })
  }

  const sucesso = resultados.every((r) => r.ok)
  return { sucesso, resultados }
}
