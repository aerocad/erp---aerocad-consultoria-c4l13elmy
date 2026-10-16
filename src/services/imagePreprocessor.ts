/**
 * Serviço de Pré-processamento e Otimização de Imagens de Documentos Fiscais
 * AEROCAD CONSULTORIA - Módulo Financeiro
 *
 * Cupons fiscais (NFC-e / SAT / CF-e), boletos e comprovantes frequentemente possuem:
 * 1. Fontes muito pequenas (letras condensadas e papel térmico de cupons).
 * 2. Fotos de alta resolução (12MP a 50MP) tiradas pelo celular que excedem limites de payload
 *    ou ficam com ruído/compressão inadequada.
 * 3. Baixo contraste e iluminação desigual.
 *
 * Este pré-processador:
 * - Mantém PDFs e arquivos vetoriais intactos sem alteração.
 * - Redimensiona imagens muito grandes para o tamanho ideal de OCR/Visão (ex: largura máxima 2048px).
 * - Aplica ajuste suave de contraste / nitidez quando necessário para evidenciar caracteres térmicos miúdos.
 * - Converte fotos HEIC/PNG pesadas para JPEG de alta qualidade (qualidade 0.92) sem corromper o arquivo.
 */

export interface PreprocessamentoOpcoes {
  maxLargura?: number
  maxAltura?: number
  qualidade?: number
  aumentarContraste?: boolean
}

const OPCOES_PADRAO: PreprocessamentoOpcoes = {
  maxLargura: 2048,
  maxAltura: 2048,
  qualidade: 0.92,
  aumentarContraste: true,
}

/**
 * Carrega um arquivo de imagem em um elemento HTMLImageElement
 */
function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = (err) => {
      URL.revokeObjectURL(url)
      reject(new Error(`Falha ao decodificar imagem: ${err}`))
    }
    img.src = url
  })
}

/**
 * Aplica um leve ganho de contraste e nitidez no ImageData do Canvas
 * para destacar caracteres miúdos de cupom térmico e códigos de barras.
 */
function otimizarContrasteTexto(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height)
    const data = imgData.data
    // Fator de contraste moderado (+12%): destaca texto escuro em fundo claro térmico
    const factor = (259 * (15 + 255)) / (255 * (259 - 15))

    for (let i = 0; i < data.length; i += 4) {
      // Ajusta R, G, B
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128))
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128))
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128))
    }

    ctx.putImageData(imgData, 0, 0)
  } catch (err) {
    // Se o canvas estiver sujo ou em ambiente sem permissão de ImageData, mantém o original
    console.warn('Otimização de contraste não pôde ser aplicada diretamente:', err)
  }
}

/**
 * Pré-processa uma foto/imagem de documento antes do envio à IA de extração.
 * Se for PDF, retorna o arquivo original imediatamente sem tocar em nada.
 * Se for imagem (JPG, PNG, WEBP), redimensiona proporcionalmente mantendo alta nitidez
 * e tamanho compatível.
 */
export async function preProcessarImagemDocumento(
  file: File,
  opcoes?: PreprocessamentoOpcoes,
): Promise<{
  fileOtimizado: File
  alterado: boolean
  dimensoesOriginais?: { largura: number; altura: number }
}> {
  // 1. Se for PDF ou se não estiver no ambiente de navegador com Canvas, mantém o original
  const nomeLower = file.name.toLowerCase()
  if (file.type === 'application/pdf' || nomeLower.endsWith('.pdf')) {
    return { fileOtimizado: file, alterado: false }
  }

  // Verifica suporte a window/document/HTMLCanvasElement
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { fileOtimizado: file, alterado: false }
  }

  const config = { ...OPCOES_PADRAO, ...opcoes }

  try {
    const img = await carregarImagem(file)
    const origWidth = img.naturalWidth || img.width
    const origHeight = img.naturalHeight || img.height

    const maxW = config.maxLargura || 2048
    const maxH = config.maxAltura || 2048

    // Calcula dimensões preservando proporção
    let targetW = origWidth
    let targetH = origHeight

    if (origWidth > maxW || origHeight > maxH) {
      const ratio = Math.min(maxW / origWidth, maxH / origHeight)
      targetW = Math.round(origWidth * ratio)
      targetH = Math.round(origHeight * ratio)
    }

    // Se a imagem já for pequena/ideal (< 1.5MB) e não precisar de resize nem contraste, devolve o original
    const precisaResize = targetW !== origWidth || targetH !== origHeight
    const precisaOtimizar = precisaResize || file.size > 2 * 1024 * 1024 || config.aumentarContraste

    if (!precisaOtimizar) {
      return {
        fileOtimizado: file,
        alterado: false,
        dimensoesOriginais: { largura: origWidth, altura: origHeight },
      }
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      return { fileOtimizado: file, alterado: false }
    }

    // Configura interpolação de alta qualidade para não desfocar letras pequenas
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    // Fundo branco caso haja transparência (ex: PNG ou cantos de foto)
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, targetW, targetH)

    // Desenha a imagem redimensionada
    ctx.drawImage(img, 0, 0, targetW, targetH)

    // Otimização de contraste se solicitado
    if (config.aumentarContraste) {
      otimizarContrasteTexto(ctx, targetW, targetH)
    }

    // Converte para Blob JPEG otimizado
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', config.qualidade || 0.92)
    })

    if (!blob) {
      return { fileOtimizado: file, alterado: false }
    }

    // Se o arquivo resultante for maior que o original sem redução de dimensão, prefira o original
    if (blob.size >= file.size && !precisaResize) {
      return {
        fileOtimizado: file,
        alterado: false,
        dimensoesOriginais: { largura: origWidth, altura: origHeight },
      }
    }

    const novoNome = file.name.replace(/\.[^/.]+$/, '') + '-otimizado.jpg'
    const novoFile = new File([blob], novoNome, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })

    return {
      fileOtimizado: novoFile,
      alterado: true,
      dimensoesOriginais: { largura: origWidth, altura: origHeight },
    }
  } catch (err) {
    console.warn('Falha no pré-processamento de imagem, usando original:', err)
    return { fileOtimizado: file, alterado: false }
  }
}
